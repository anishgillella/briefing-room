"""
Pluto processor service - handles CSV processing, extraction, and scoring.
Adapted from Pluto/backend/extract_data.py and score_candidates.py
"""

import json
import asyncio
import logging
from typing import Any, List, Optional
from datetime import datetime

import pandas as pd
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from config import OPENROUTER_API_KEY

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# OpenRouter configuration
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
EXTRACTION_MODEL = "google/gemini-2.5-flash"
SCORING_MODEL = "google/gemini-2.5-flash"
BATCH_SIZE = 5
MAX_RETRIES = 2

# Initialize OpenRouter client
client = AsyncOpenAI(
    base_url=OPENROUTER_BASE_URL,
    api_key=OPENROUTER_API_KEY,
)


# ============================================================================
# Extraction Models (Pydantic)
# ============================================================================

class CandidateExtraction(BaseModel):
    """Schema for semantic data extracted by LLM."""
    bio_summary: str = Field(default="", description="2-sentence first-person sales-focused summary")
    sold_to_finance: bool = Field(default=False)
    is_founder: bool = Field(default=False)
    startup_experience: bool = Field(default=False)
    enterprise_experience: bool = Field(default=False)
    max_acv_mentioned: Optional[int] = Field(default=None)
    quota_attainment: Optional[float] = Field(default=None)
    industries: List[str] = Field(default_factory=list)
    sales_methodologies: List[str] = Field(default_factory=list)


class RedFlags(BaseModel):
    """Schema for potential concerns detected in candidate profile."""
    job_hopping: bool = Field(default=False)
    title_inflation: bool = Field(default=False)
    gaps_in_employment: bool = Field(default=False)
    overqualified: bool = Field(default=False)
    concerns: List[str] = Field(default_factory=list)

    @property
    def red_flag_count(self) -> int:
        return sum([self.job_hopping, self.title_inflation, self.gaps_in_employment, self.overqualified])


class ExtractionResult(BaseModel):
    """Combined extraction result from LLM."""
    extraction: CandidateExtraction
    red_flags: RedFlags


class Evaluation(BaseModel):
    """AI evaluation output."""
    score: int = Field(ge=0, le=100, description="Fit score 0-100")
    one_line_summary: str = Field(default="")
    pros: List[str] = Field(default_factory=list)
    cons: List[str] = Field(default_factory=list)
    reasoning: str = Field(default="")
    interview_questions: List[str] = Field(default_factory=list, description="3 tailored interview questions")


# ============================================================================
# Required and Preferred Fields for Completeness
# ============================================================================

REQUIRED_FIELDS = [
    ("years_experience", "Years Experience"),
    ("sold_to_finance", "CFO/Finance Sales"),
    ("bio_summary", "Bio Summary"),
    ("job_title", "Job Title"),
]

PREFERRED_FIELDS = [
    ("max_acv_mentioned", "Deal Size/ACV"),
    ("quota_attainment", "Quota %"),
    ("enterprise_experience", "Enterprise Sales"),
    ("industries", "Industry Background"),
    ("startup_experience", "Startup Experience"),
    ("skills", "Skills/Methodologies"),
]


# ============================================================================
# Extraction Functions
# ============================================================================

def parse_enrichment_json(raw_json: str) -> Optional[dict]:
    """Safely parse the crustdata_enrichment_data JSON column."""
    if pd.isna(raw_json) or not raw_json:
        return None
    try:
        data = json.loads(raw_json)
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            return data[0]
        if isinstance(data, dict):
            return data
        return None
    except json.JSONDecodeError:
        return None


def extract_deterministic(row: pd.Series, enrichment: Optional[dict]) -> dict:
    """Extract structured data that doesn't require AI."""
    
    def safe_str(val: Any, default: str = "") -> str:
        if pd.isna(val) or val is None:
            return default
        return str(val)
    
    def safe_float(val: Any, default: float = 0.0) -> float:
        if pd.isna(val):
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default
    
    # Name
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
    
    # Location
    location_city = safe_str(row.get("location_city"))
    location_state = safe_str(row.get("location_state"))
    
    if enrichment and not location_city:
        loc_str = enrichment.get("location", "")
        if loc_str and "," in loc_str:
            parts = [p.strip() for p in loc_str.split(",")]
            location_city = parts[0] if len(parts) > 0 else ""
            location_state = parts[1] if len(parts) > 1 else ""
    
    # Skills
    skills = []
    if enrichment and "skills" in enrichment:
        raw_skills = enrichment["skills"][:15]
        skills = [
            s.get("name", str(s)) if isinstance(s, dict) else str(s)
            for s in raw_skills
        ]
    
    return {
        "id": str(row.name),
        "name": name,
        "job_title": job_title,
        "location_city": location_city,
        "location_state": location_state,
        "years_experience": safe_float(row.get("years_sales_experience"), 0.0),
        "skills": skills,
        "has_enrichment_data": enrichment is not None,
    }


def build_extraction_prompt(enrichment: dict, candidate_name: str) -> str:
    """Build the prompt for semantic extraction."""
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
"""


def build_dynamic_extraction_prompt(enrichment: dict, candidate_name: str, extraction_fields: list) -> str:
    """Build a dynamic extraction prompt based on JD Compiler fields."""
    context = {
        "headline": enrichment.get("headline", ""),
        "summary": enrichment.get("summary", ""),
        "current_job": enrichment.get("current_employers", [])[:1],
        "work_history": enrichment.get("past_employers", [])[:5],
        "education": enrichment.get("education", [])[:2],
    }
    
    context_str = json.dumps(context, indent=2, default=str)
    
    # Build dynamic schema from extraction_fields
    schema_parts = []
    for field in extraction_fields:
        field_name = field.get("field_name", "")
        field_type = field.get("field_type", "string")
        description = field.get("description", "")
        
        if field_type == "boolean":
            schema_parts.append(f'    "{field_name}": true/false  // {description}')
        elif field_type == "number":
            schema_parts.append(f'    "{field_name}": number or null  // {description}')
        elif field_type == "string_list":
            schema_parts.append(f'    "{field_name}": ["list", "of", "values"]  // {description}')
        else:  # string
            schema_parts.append(f'    "{field_name}": "text value"  // {description}')
    
    schema_str = ",\n".join(schema_parts)
    
    return f"""Analyze this LinkedIn profile for {candidate_name} and extract structured data.

PROFILE DATA:
{context_str}

EXTRACT the following information based on the JOB REQUIREMENTS. Return ONLY valid JSON:

{{
  "extraction": {{
    "bio_summary": "WRITE IN FIRST PERSON ('I am...', 'I have...'). 2-3 sentences about achievements and career focus.",
{schema_str}
  }},
  "red_flags": {{
    "job_hopping": true/false,
    "title_inflation": true/false,
    "gaps_in_employment": true/false,
    "overqualified": true/false,
    "concerns": ["list of specific concerns"]
  }}
}}
"""


async def extract_dynamic_fields(candidate_data: dict, enrichment: dict, extraction_fields: list) -> dict:
    """Extract dynamic fields using the JD Compiler schema."""
    prompt = build_dynamic_extraction_prompt(enrichment, candidate_data["name"], extraction_fields)
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.chat.completions.create(
                model=EXTRACTION_MODEL,
                messages=[
                    {"role": "system", "content": "You are a precise data extraction engine. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            
            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response")
            
            data = json.loads(content)
            extraction = data.get("extraction", {})
            red_flags = data.get("red_flags", {})
            
            # Calculate red flag count
            red_flag_count = sum([
                red_flags.get("job_hopping", False),
                red_flags.get("title_inflation", False),
                red_flags.get("gaps_in_employment", False),
                red_flags.get("overqualified", False),
            ])
            
            return {
                "extraction": extraction,
                "red_flags": red_flags.get("concerns", []),
                "red_flag_count": red_flag_count,
            }
            
        except Exception as e:
            logger.warning(f"Dynamic extraction attempt {attempt + 1} failed for {candidate_data['name']}: {e}")
            if attempt == MAX_RETRIES:
                return {
                    "extraction": {"bio_summary": "Unable to extract profile."},
                    "red_flags": [],
                    "red_flag_count": 0,
                }
            await asyncio.sleep(1)
    
    return {"extraction": {}, "red_flags": [], "red_flag_count": 0}


async def extract_semantic(candidate_data: dict, enrichment: dict) -> ExtractionResult:
    """Call LLM to extract semantic data."""
    prompt = build_extraction_prompt(enrichment, candidate_data["name"])
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.chat.completions.create(
                model=EXTRACTION_MODEL,
                messages=[
                    {"role": "system", "content": "You are a precise data extraction engine. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            
            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response")
            
            data = json.loads(content)
            return ExtractionResult.model_validate(data)
            
        except Exception as e:
            logger.warning(f"Attempt {attempt + 1} failed for {candidate_data['name']}: {e}")
            if attempt == MAX_RETRIES:
                return ExtractionResult(
                    extraction=CandidateExtraction(bio_summary="Unable to extract profile."),
                    red_flags=RedFlags(),
                )
            await asyncio.sleep(1)
    
    return ExtractionResult(extraction=CandidateExtraction(), red_flags=RedFlags())


# ============================================================================
# Scoring Functions
# ============================================================================

def calculate_algo_score(candidate: dict) -> int:
    """Calculate algorithmic score based on objective criteria (0-100)."""
    score = 0
    
    # 1. Experience (max 30 pts)
    years = float(candidate.get("years_experience", 0) or 0)
    score += min(int(years * 10), 30)
    
    # 2. Finance Sales Fit (max 25 pts) - CRITICAL
    if candidate.get("sold_to_finance"):
        score += 25
    
    # 3. Startup/Founder DNA (max 20 pts)
    if candidate.get("is_founder"):
        score += 20
    elif candidate.get("startup_experience"):
        score += 10
    
    # 4. Deal Size/ACV (max 15 pts)
    acv = candidate.get("max_acv_mentioned") or 0
    if acv >= 100000:
        score += 15
    elif acv >= 50000:
        score += 10
    elif acv > 0:
        score += 5
    
    # 5. Enterprise Experience (max 10 pts)
    if candidate.get("enterprise_experience"):
        score += 10
    
    # Penalty for red flags
    red_flag_count = int(candidate.get("red_flag_count", 0) or 0)
    score -= red_flag_count * 5
    
    return max(0, min(score, 100))


def build_evaluation_prompt(candidate: dict, job_description: str = "", scoring_criteria: list = None, red_flag_indicators: list = None) -> str:
    """Build evaluation prompt for AI scoring with optional job description context."""
    # Build JD context section if provided
    jd_context = ""
    if job_description and job_description.strip():
        jd_context = f"""
== JOB DESCRIPTION (evaluate candidate against this) ==
{job_description.strip()}

"""

    # Build Scoring Criteria section
    criteria_context = ""
    if scoring_criteria and len(scoring_criteria) > 0:
        criteria_list = "\n".join([f"- {c}" for c in scoring_criteria])
        criteria_context = f"""
== SCORING CRITERIA (PRIORITIZE THESE) ==
{criteria_list}
"""

    # Build Red Flags section
    red_flag_context = ""
    if red_flag_indicators and len(red_flag_indicators) > 0:
        flags_list = "\n".join([f"- {f}" for f in red_flag_indicators])
        red_flag_context = f"""
== RED FLAGS TO WATCH FOR ==
{flags_list}
"""
    
    return f"""You are an expert executive recruiter evaluating candidates.

{jd_context}== CANDIDATE PROFILE ==
Name: {candidate.get('name', 'Unknown')}
Current Title: {candidate.get('job_title', 'N/A')}
Experience: {candidate.get('years_experience', 0)} years in sales
Bio: {candidate.get('bio_summary', 'Not provided')}
Industries: {candidate.get('industries', [])}
Skills: {candidate.get('skills', [])[:10]}

== EXTRACTED SIGNALS ==
- Sold to Finance/CFOs: {candidate.get('sold_to_finance', False)}
- Is Founder: {candidate.get('is_founder', False)}
- Startup Experience: {candidate.get('startup_experience', False)}
- Enterprise Experience: {candidate.get('enterprise_experience', False)}
- Max Deal Size: ${candidate.get('max_acv_mentioned') or 'Not mentioned'}
- Red Flags: {candidate.get('red_flag_count', 0)}
{criteria_context}{red_flag_context}
== SCORING RUBRIC (be strict) ==
90-100: Exceptional - Exceeds ALL requirements{' from the JD' if jd_context else ''}
75-89: Strong - Meets critical requirements
60-74: Potential - Some gaps but coachable
40-59: Weak - Missing key requirements
0-39: Not a fit - Wrong background

RETURN ONLY VALID JSON:
{{
  "score": <0-100>,
  "one_line_summary": "<10-word punchy summary (infer from title/exp if bio missing)>",
  "pros": ["strength 1", "strength 2", "strength 3"],
  "cons": ["concern 1", "concern 2", "concern 3"],
  "reasoning": "<2-3 sentence explanation{' referencing JD requirements' if jd_context else ''}>",
  "interview_questions": [
    "<Specific question about their experience that probes a gap or validates a strength>",
    "<Behavioral question tailored to their background and the role requirements>",
    "<Question that explores concerns from their profile or clarifies missing info>"
  ]
}}"""


async def evaluate_candidate(candidate: dict, job_description: str = "", scoring_criteria: list = None, red_flag_indicators: list = None) -> Evaluation:
    """Get AI evaluation for a candidate with optional job description context."""
    prompt = build_evaluation_prompt(candidate, job_description, scoring_criteria, red_flag_indicators)
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.chat.completions.create(
                model=SCORING_MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert recruiter. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.4,
            )
            
            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response")
            
            return Evaluation.model_validate_json(content)
            
        except Exception as e:
            logger.warning(f"Evaluation failed for {candidate.get('name')}: {e}")
            if attempt == MAX_RETRIES:
                return Evaluation(
                    score=50,
                    one_line_summary="Evaluation incomplete - manual review needed",
                    pros=["Profile available"],
                    cons=["Auto-evaluation failed"],
                    reasoning="AI evaluation failed. Manual review recommended.",
                )
            await asyncio.sleep(1)
    
    return Evaluation(score=50, one_line_summary="Evaluation failed")


def get_missing_fields(candidate: dict) -> tuple:
    """Check which fields are missing. Returns (missing_required, missing_preferred, completeness%)."""
    missing_required = []
    missing_preferred = []
    
    def is_missing(value, field_key: str) -> bool:
        if value is None:
            return True
        if isinstance(value, str) and (value.strip() == "" or value == "[]"):
            return True
        if isinstance(value, (int, float)) and value == 0:
            if field_key in ["years_experience", "max_acv_mentioned", "quota_attainment"]:
                return True
        if isinstance(value, list) and len(value) == 0:
            return True
        return False
    
    for field_key, field_name in REQUIRED_FIELDS:
        if is_missing(candidate.get(field_key), field_key):
            missing_required.append(field_name)
    
    for field_key, field_name in PREFERRED_FIELDS:
        if is_missing(candidate.get(field_key), field_key):
            missing_preferred.append(field_name)
    
    total_weight = len(REQUIRED_FIELDS) * 2 + len(PREFERRED_FIELDS)
    present_weight = (len(REQUIRED_FIELDS) - len(missing_required)) * 2 + \
                     (len(PREFERRED_FIELDS) - len(missing_preferred))
    completeness = round((present_weight / total_weight) * 100)
    
    return missing_required, missing_preferred, completeness


def assign_tier(score: int) -> str:
    """Assign tier based on final score."""
    if score >= 80:
        return "Top Tier"
    elif score >= 65:
        return "Strong"
    elif score >= 50:
        return "Good"
    elif score >= 35:
        return "Evaluate"
    else:
        return "Poor"


# ============================================================================
# Main Processing Pipeline
# ============================================================================

async def process_csv_file(file_content: bytes, progress_callback=None, job_description: str = "", extraction_fields: list = None, skip_ai_scoring: bool = False) -> List[dict]:
    """
    Process a CSV file and return scored candidates.
    
    NEW FLOW:
    1. Extract ALL candidates first (fast)
    2. Calculate ALL algo scores immediately (no API)
    3. Stream full algo table to frontend
    4. AI score progressively (one at a time, updates stream in) - UNLESS SKIP_AI_SCORING IS TRUE
    
    Args:
        file_content: Raw bytes of the CSV file
        progress_callback: Optional async callback(phase, progress, message, data)
        job_description: Optional job description for contextualized AI scoring
        extraction_fields: Optional list of dynamic fields from JD Compiler
        skip_ai_scoring: If True, stop after extraction and algo scoring (Phase 2)
    
    Returns:
        List of candidate dictionaries
    """
    from models.candidate import Candidate
    from services.candidate_store import save_candidates, clear_all_candidates
    import io
    
    # Parse CSV
    df = pd.read_csv(io.BytesIO(file_content))
    total_candidates = len(df)
    
    # Log extraction fields
    if extraction_fields:
        logger.info(f"Rg Received {len(extraction_fields)} extraction fields from JD Compiler:")
        for field in extraction_fields:
            logger.info(f"   - {field.get('field_name')} ({field.get('field_type')}): {field.get('description', '')[:50]}...")
    else:
        logger.info("Rg No custom extraction fields - using standard extraction")
    
    if progress_callback:
        fields_msg = f" with {len(extraction_fields)} custom fields" if extraction_fields else ""
        await progress_callback("extracting", 0, f"Extracting {total_candidates} candidates{fields_msg}...", {"total_candidates": total_candidates})
    
    # Clear existing candidates
    clear_all_candidates()
    
    # ========================================================================
    # PHASE 1: Extract ALL candidates (with semantic extraction)
    # ========================================================================
    all_extracted = []
    
    for idx, row in df.iterrows():
        enrichment = parse_enrichment_json(row.get("crustdata_enrichment_data", ""))
        base_data = extract_deterministic(row, enrichment)
        
        # Get semantic extraction if we have enrichment
        if enrichment:
            try:
                # Use dynamic extraction if custom fields are provided
                if extraction_fields:
                    logger.info(f"Rg Dynamic extraction for {base_data['name']} with {len(extraction_fields)} custom fields")
                    result = await extract_dynamic_fields(base_data, enrichment, extraction_fields)
                    extraction = result.get("extraction", {})
                    
                    # Log what was extracted
                    logger.info(f"Rg Extracted fields for {base_data['name']}: {list(extraction.keys())}")
                    
                    # Map base fields (these are always extracted)
                    base_data["bio_summary"] = extraction.get("bio_summary", "")
                    
                    # Map all dynamic fields directly to base_data
                    for field in extraction_fields:
                        field_name = field.get("field_name", "")
                        if field_name in extraction and field_name != "bio_summary":
                            base_data[field_name] = extraction[field_name]
                            logger.info(f"  ✓ {field_name}: {extraction[field_name]}")
                    
                    # Handle red flags
                    base_data["red_flags"] = result.get("red_flags", [])
                    base_data["red_flag_count"] = result.get("red_flag_count", 0)
                else:
                    # Use standard extraction
                    result = await extract_semantic(base_data, enrichment)
                    base_data.update({
                        "bio_summary": result.extraction.bio_summary,
                        "sold_to_finance": result.extraction.sold_to_finance,
                        "is_founder": result.extraction.is_founder,
                        "startup_experience": result.extraction.startup_experience,
                        "enterprise_experience": result.extraction.enterprise_experience,
                        "max_acv_mentioned": result.extraction.max_acv_mentioned,
                        "quota_attainment": result.extraction.quota_attainment,
                        "industries": result.extraction.industries,
                        "sales_methodologies": result.extraction.sales_methodologies,
                        "red_flags": result.red_flags.concerns,
                        "red_flag_count": result.red_flags.red_flag_count,
                    })
            except Exception as e:
                logger.error(f"Extraction failed for {base_data['name']}: {e}")
        
        # Calculate algo score immediately
        algo_score = calculate_algo_score(base_data)
        base_data["algo_score"] = algo_score
        
        # Initialize default fields for pre-save
        base_data.update({
            "source": "csv_upload",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            # Status flags
            "ai_score": 0,
            "combined_score": algo_score, # Tentative
            "tier": "Evaluate", # Default
            "interview_status": "not_scheduled",
            "has_enrichment_data": enrichment is not None
        })
        
        all_extracted.append(base_data)
        
        # Progress update every 5 candidates
        if progress_callback and (idx + 1) % 5 == 0:
            progress = int(((idx + 1) / total_candidates) * 40)
            await progress_callback(
                "extracting", 
                progress, 
                f"Extracted {idx + 1}/{total_candidates}...",
                {"extracted_batch": all_extracted.copy()}
            )
    
    # Save extracted candidates immediately so they persist even if we stop here
    candidates_to_save = [Candidate(**c) for c in all_extracted]
    save_candidates(candidates_to_save)
    
    # ========================================================================
    # PHASE 2: Stream full algo table (all candidates with algo scores)
    # ========================================================================
    if progress_callback:
        await progress_callback(
            "extracting", 
            40, 
            f"All {total_candidates} profiles extracted!",
            {"extracted_batch": all_extracted, "extraction_complete": True}
        )
    
    # STOP HERE if skip_ai_scoring is True
    if skip_ai_scoring:
        logger.info("Skipping AI scoring as requested")
        if progress_callback:
            await progress_callback("waiting_confirmation", 40, f"Extraction complete. Waiting for scoring confirmation.", {"extraction_complete": True})
        return [c.model_dump() for c in candidates_to_save]

    # ========================================================================
    # PHASE 3: AI score progressively (one candidate at a time)
    # ========================================================================
    return await run_ai_scoring(candidates_to_save, progress_callback, job_description)


async def run_ai_scoring(candidates_list: List[Any], progress_callback=None, job_description: str = "", scoring_criteria: list = None, red_flag_indicators: list = None) -> List[dict]:
    """
    Run AI scoring on a list of already extracted candidates.
    Can be called independently or as part of the pipeline.
    """
    from services.candidate_store import save_candidates
    
    # Convert dicts to Candidate objects if needed, or use as is
    # If passed from process_csv_file, they are Candidate objects
    # If loaded from store, they are Candidate objects
    
    total_candidates = len(candidates_list)
    all_scored = []
    
    logger.info(f"Starting AI scoring for {total_candidates} candidates...")
    
    for idx, candidate_obj in enumerate(candidates_list):
        # Access data (handle both Pydantic model and dict)
        candidate_data = candidate_obj.model_dump() if hasattr(candidate_obj, "model_dump") else candidate_obj
        
        algo_score = candidate_data.get("algo_score", 0)
        
        # Get AI evaluation with job description context
        try:
            evaluation = await evaluate_candidate(candidate_data, job_description, scoring_criteria, red_flag_indicators)
            ai_score = evaluation.score
        except Exception as e:
            logger.error(f"AI evaluation failed for {candidate_data.get('name')}: {e}")
            evaluation = Evaluation(score=50, one_line_summary="Evaluation failed")
            ai_score = 50
        
        # Calculate combined score and tier
        combined_score = round((algo_score + ai_score) / 2)
        tier = assign_tier(combined_score)
        
        # Get missing fields
        missing_required, missing_preferred, completeness = get_missing_fields(candidate_data)
        
        # Update candidate_data with computed values
        candidate_data.update({
            "ai_score": ai_score,
            "combined_score": combined_score,
            "tier": tier,
            "one_line_summary": evaluation.one_line_summary,
            "pros": evaluation.pros,
            "cons": evaluation.cons,
            "reasoning": evaluation.reasoning,
            "interview_questions": evaluation.interview_questions,
            "missing_required": missing_required,
            "missing_preferred": missing_preferred,
            "completeness": completeness,
            "updated_at": datetime.utcnow(),
        })

        # Re-create/Update Candidate object
        # Note: **candidate_data preserves dynamic fields
        from models.candidate import Candidate
        candidate_scored = Candidate(**candidate_data)
        all_scored.append(candidate_scored)
        
        # Progress update after each AI score (for real-time updates)
        if progress_callback:
            progress = 40 + int(((idx + 1) / total_candidates) * 60)
            await progress_callback(
                "scoring", 
                progress, 
                f"AI scored {idx + 1}/{total_candidates}...",
                {"candidates_scored": idx + 1, "latest_scored": candidate_scored.model_dump()}
            )
            
            # Save incrementally every 1 candidate to ensure progress isn't lost
            save_candidates(all_scored + candidates_list[idx+1:])
    
    # Sort by combined score
    all_scored.sort(key=lambda c: c.combined_score or 0, reverse=True)
    
    # Final Save
    save_candidates(all_scored)
    
    if progress_callback:
        await progress_callback("complete", 100, f"Processed {len(all_scored)} candidates")
    
    return [c.model_dump() for c in all_scored]

