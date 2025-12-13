"""
Phase 1: Data Extraction Pipeline

Extracts and enriches candidate data from CSV using:
1. Deterministic parsing (Python) for structured fields
2. Semantic extraction (Gemini 2.5 Flash) for nuanced fields

Output: result.csv with all extracted data

Usage:
    python -m backend.extract_data
"""

import json
import asyncio
import logging
from typing import Any

import pandas as pd
from openai import AsyncOpenAI
from pydantic import ValidationError

from backend.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    CSV_PATH,
    RESULT_CSV_PATH,
    PROCESSED_JSON_PATH,
    EXTRACTION_MODEL,
    BATCH_SIZE,
    MAX_RETRIES,
    validate_config,
)
from backend.models import (
    CandidateExtraction,
    RedFlags,
    ExtractionResult,
    ProcessedCandidate,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Initialize OpenRouter client
client = AsyncOpenAI(
    base_url=OPENROUTER_BASE_URL,
    api_key=OPENROUTER_API_KEY,
)


def parse_enrichment_json(raw_json: str) -> dict[str, Any] | None:
    """
    Safely parse the crustdata_enrichment_data JSON column.
    Returns None if parsing fails or data is not a dict.
    """
    if pd.isna(raw_json) or not raw_json:
        return None
    try:
        data = json.loads(raw_json)
        # Handle edge case where data is a list instead of dict
        if isinstance(data, list):
            if len(data) > 0 and isinstance(data[0], dict):
                return data[0]  # Take first item if it's a dict
            return None
        if not isinstance(data, dict):
            return None
        return data
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse enrichment JSON: {e}")
        return None


def extract_deterministic(row: pd.Series, enrichment: dict | None) -> dict[str, Any]:
    """
    Extract structured data that doesn't require AI.
    Uses CSV columns first, falls back to enrichment data.
    """
    # Helper functions for safe type conversion
    def safe_str(val: Any, default: str = "") -> str:
        if pd.isna(val) or val is None:
            return default
        return str(val)
    
    def safe_bool(val: Any) -> bool:
        if pd.isna(val):
            return False
        return bool(val)
    
    def safe_int(val: Any) -> int | None:
        if pd.isna(val):
            return None
        try:
            return int(val)
        except (ValueError, TypeError):
            return None
    
    def safe_float(val: Any, default: float = 0.0) -> float:
        if pd.isna(val):
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default
    
    # Name - fix "Unknown User"
    name = safe_str(row.get("name"), "Unknown User")
    if name == "Unknown User" and enrichment:
        name = enrichment.get("name", "Unknown User")
    
    # Job Title
    job_title = safe_str(row.get("job_title"))
    if not job_title and enrichment:
        current_employers = enrichment.get("current_employers", [])
        if current_employers and isinstance(current_employers, list) and len(current_employers) > 0:
            job_title = safe_str(current_employers[0].get("employee_title"))
        if not job_title:
            job_title = safe_str(enrichment.get("title"))
    
    # Location parsing
    location_city = safe_str(row.get("location_city"))
    location_state = safe_str(row.get("location_state"))
    
    if enrichment and not location_city:
        loc_str = enrichment.get("location", "")
        if loc_str and "," in loc_str:
            parts = [p.strip() for p in loc_str.split(",")]
            location_city = parts[0] if len(parts) > 0 else ""
            location_state = parts[1] if len(parts) > 1 else ""
    
    # Skills - top 15 relevant
    skills: list[str] = []
    if enrichment and "skills" in enrichment:
        raw_skills = enrichment["skills"][:15]
        skills = [
            s.get("name", str(s)) if isinstance(s, dict) else str(s)
            for s in raw_skills
        ]
    
    # Years of sales experience
    years_sales = safe_float(row.get("years_sales_experience"), 0.0)
    
    return {
        "id": str(row.name),  # DataFrame index as ID
        "name": name,
        "job_title": job_title,
        "location_city": location_city,
        "location_state": location_state,
        "years_sales_experience": years_sales,
        "skills": skills,
        "willing_to_relocate": safe_bool(row.get("willing_to_relocate")),
        "work_style_remote": safe_bool(row.get("work_style_remote")),
        "work_style_hybrid": safe_bool(row.get("work_style_hybrid")),
        "work_style_in_person": safe_bool(row.get("work_style_in_person")),
        "base_salary_min": safe_int(row.get("base_salary_min")),
        "ote_min": safe_int(row.get("ote_min")),
        "availability_days": safe_int(row.get("availability_days")),
        "has_enrichment_data": enrichment is not None,
    }


def build_extraction_prompt(enrichment: dict, candidate_name: str) -> str:
    """
    Build the prompt for semantic extraction.
    Only includes relevant fields to minimize token usage.
    """
    context = {
        "headline": enrichment.get("headline", ""),
        "summary": enrichment.get("summary", ""),
        "current_job": enrichment.get("current_employers", [])[:1],
        "work_history": enrichment.get("past_employers", [])[:5],
        "education": enrichment.get("education", [])[:2],
    }
    
    context_str = json.dumps(context, indent=2, default=str)
    
    return f"""Analyze this LinkedIn profile for {candidate_name} and extract structured data.

PROFILE DATA:
{context_str}

EXTRACT the following information. Return ONLY valid JSON matching this exact schema:

{{
  "extraction": {{
    "bio_summary": "WRITE IN FIRST PERSON ('I am...', 'I have...'). 2 sentences about sales achievements and career focus.",
    "sold_to_finance": true/false,
    "is_founder": true/false,
    "startup_experience": true/false,
    "enterprise_experience": true/false,
    "max_acv_mentioned": number or null,
    "quota_attainment": number or null,
    "industries": ["list", "of", "industries"],
    "sales_methodologies": ["list", "of", "methodologies"]
  }},
  "red_flags": {{
    "job_hopping": true/false,
    "title_inflation": true/false,
    "gaps_in_employment": true/false,
    "overqualified": true/false,
    "concerns": ["list of specific concerns"]
  }}
}}

RULES:
- bio_summary: MUST be in FIRST PERSON (start with "I am" or "I have"). Focus on sales achievements.
- sold_to_finance: Only true if explicitly mentions selling to CFOs, Controllers, VP Finance, or accounting teams
- is_founder: Only true if they held a Founder/Co-Founder title
- startup_experience: True if worked at Series A/B stage companies or earlier, or small startups
- enterprise_experience: True if mentions selling to large companies (Fortune 500, 1000+ employees)
- max_acv_mentioned: Extract the largest deal size mentioned (e.g., "$500k deal" = 500000). If not explicitly mentioned, return null.
- quota_attainment: Extract highest percentage mentioned (e.g., "150% of quota" = 150). If not mentioned, return null.
- industries: INFER from company names and descriptions. Examples: "Fintech", "SaaS", "Healthcare", "AI/ML", "EdTech"
- sales_methodologies: INFER from their approach descriptions. Common ones: "Consultative Sales", "Full-Cycle Sales", "Account-Based Selling", "MEDDIC", "SPIN", "Challenger", "Solution Selling". If they mention "full sales cycle" or "outbound", include relevant methodologies.
- job_hopping: True if average tenure across roles appears to be under 18 months
- overqualified: True if their seniority/compensation history suggests they'd want above $200k OTE
"""


async def extract_semantic(
    candidate_data: dict,
    enrichment: dict,
) -> ExtractionResult:
    """
    Call Gemini 2.5 Flash to extract semantic data.
    Returns ExtractionResult with extraction and red_flags.
    """
    prompt = build_extraction_prompt(enrichment, candidate_data["name"])
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.chat.completions.create(
                model=EXTRACTION_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a precise data extraction engine. Return only valid JSON, no markdown.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,  # Low temperature for consistent extraction
            )
            
            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response from model")
            
            # Parse and validate with Pydantic
            data = json.loads(content)
            return ExtractionResult.model_validate(data)
            
        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(
                f"Attempt {attempt + 1}/{MAX_RETRIES + 1} failed for "
                f"{candidate_data['name']}: {e}"
            )
            if attempt == MAX_RETRIES:
                logger.error(f"All retries failed for {candidate_data['name']}")
                return ExtractionResult(
                    extraction=CandidateExtraction(
                        bio_summary="Unable to extract profile summary.",
                        sold_to_finance=False,
                        is_founder=False,
                        startup_experience=False,
                        enterprise_experience=False,
                    ),
                    red_flags=RedFlags(),
                )
        except Exception as e:
            logger.error(f"API error for {candidate_data['name']}: {e}")
            if attempt == MAX_RETRIES:
                return ExtractionResult(
                    extraction=CandidateExtraction(
                        bio_summary="Unable to extract profile summary.",
                        sold_to_finance=False,
                        is_founder=False,
                        startup_experience=False,
                        enterprise_experience=False,
                    ),
                    red_flags=RedFlags(),
                )
            await asyncio.sleep(1)
    
    return ExtractionResult(
        extraction=CandidateExtraction(
            bio_summary="",
            sold_to_finance=False,
            is_founder=False,
            startup_experience=False,
            enterprise_experience=False,
        ),
        red_flags=RedFlags(),
    )


async def process_batch(batch: list[tuple[dict, dict | None]]) -> list[ProcessedCandidate]:
    """
    Process a batch of candidates concurrently (PARALLEL LLM calls).
    """
    tasks = []
    
    for base_data, enrichment in batch:
        if enrichment:
            tasks.append(extract_semantic(base_data, enrichment))
        else:
            # No enrichment data - create a coroutine that returns default
            async def default_extraction():
                return ExtractionResult(
                    extraction=CandidateExtraction(
                        bio_summary="No profile data available.",
                        sold_to_finance=False,
                        is_founder=False,
                        startup_experience=False,
                        enterprise_experience=False,
                    ),
                    red_flags=RedFlags(),
                )
            tasks.append(default_extraction())
    
    # Run ALL extractions in parallel
    extraction_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    results = []
    for (base_data, _), extraction_result in zip(batch, extraction_results):
        if isinstance(extraction_result, Exception):
            logger.error(f"Batch extraction failed for {base_data['name']}: {extraction_result}")
            extraction_result = ExtractionResult(
                extraction=CandidateExtraction(
                    bio_summary="Extraction failed.",
                    sold_to_finance=False,
                    is_founder=False,
                    startup_experience=False,
                    enterprise_experience=False,
                ),
                red_flags=RedFlags(),
            )
        
        # Merge deterministic and semantic data
        candidate = ProcessedCandidate(
            **base_data,
            bio_summary=extraction_result.extraction.bio_summary,
            sold_to_finance=extraction_result.extraction.sold_to_finance,
            is_founder=extraction_result.extraction.is_founder,
            startup_experience=extraction_result.extraction.startup_experience,
            enterprise_experience=extraction_result.extraction.enterprise_experience,
            max_acv_mentioned=extraction_result.extraction.max_acv_mentioned,
            quota_attainment=extraction_result.extraction.quota_attainment,
            industries=extraction_result.extraction.industries,
            sales_methodologies=extraction_result.extraction.sales_methodologies,
            red_flags=extraction_result.red_flags,
        )
        results.append(candidate)
    
    return results


def save_to_csv(
    original_df: pd.DataFrame,
    candidates: list[ProcessedCandidate],
    path,
) -> None:
    """
    Save processed candidates to CSV format.
    FILLS MISSING VALUES in original columns and ADDS only new columns.
    """
    result_df = original_df.copy()
    
    def is_empty(val) -> bool:
        """Check if value is empty (NaN, empty string, or '[]')"""
        if pd.isna(val):
            return True
        if val == "" or val == "[]":
            return True
        return False
    
    for i, c in enumerate(candidates):
        # FILL MISSING VALUES in original columns (in-place updates)
        
        # Name: Replace "Unknown User" with extracted name
        if is_empty(result_df.at[i, "name"]) or result_df.at[i, "name"] == "Unknown User":
            result_df.at[i, "name"] = c.name
        
        # Job Title: Fill if empty
        if is_empty(result_df.at[i, "job_title"]):
            result_df.at[i, "job_title"] = c.job_title
        
        # Location: Fill if empty
        if is_empty(result_df.at[i, "location_city"]):
            result_df.at[i, "location_city"] = c.location_city
        if is_empty(result_df.at[i, "location_state"]):
            result_df.at[i, "location_state"] = c.location_state
        
        # Skills: Fill if empty or "[]"
        if is_empty(result_df.at[i, "skills"]):
            result_df.at[i, "skills"] = "|".join(c.skills) if c.skills else ""
        
        # Bio Summary: Fill if empty
        if is_empty(result_df.at[i, "bio_summary"]):
            result_df.at[i, "bio_summary"] = c.bio_summary
        
        # Industries: Fill if empty or "[]"
        if is_empty(result_df.at[i, "industries"]):
            result_df.at[i, "industries"] = "|".join(c.industries) if c.industries else ""
        
        # Sales Methodologies: Fill if empty or "[]"
        if is_empty(result_df.at[i, "sales_methodologies"]):
            result_df.at[i, "sales_methodologies"] = "|".join(c.sales_methodologies) if c.sales_methodologies else ""
    
    # ADD ONLY TRULY NEW COLUMNS (semantic extraction results)
    result_df["sold_to_finance"] = [c.sold_to_finance for c in candidates]
    result_df["is_founder"] = [c.is_founder for c in candidates]
    result_df["startup_experience"] = [c.startup_experience for c in candidates]
    result_df["enterprise_experience"] = [c.enterprise_experience for c in candidates]
    result_df["max_acv_mentioned"] = [c.max_acv_mentioned for c in candidates]
    result_df["quota_attainment"] = [c.quota_attainment for c in candidates]
    
    # Red flags
    result_df["red_flag_job_hopping"] = [c.red_flags.job_hopping for c in candidates]
    result_df["red_flag_title_inflation"] = [c.red_flags.title_inflation for c in candidates]
    result_df["red_flag_gaps"] = [c.red_flags.gaps_in_employment for c in candidates]
    result_df["red_flag_overqualified"] = [c.red_flags.overqualified for c in candidates]
    result_df["red_flag_count"] = [c.red_flags.red_flag_count for c in candidates]
    result_df["red_flag_concerns"] = ["|".join(c.red_flags.concerns) for c in candidates]
    
    result_df.to_csv(path, index=False)
    logger.info(f"Saved CSV to {path}")
    logger.info(f"Total columns: {len(result_df.columns)} (18 original + 12 new)")
