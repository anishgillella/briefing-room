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


def build_evaluation_prompt(candidate: dict, job_description: str = "") -> str:
    """Build evaluation prompt for AI scoring with optional job description context."""
    # Build JD context section if provided
    jd_context = ""
    if job_description and job_description.strip():
        jd_context = f"""
== JOB DESCRIPTION (evaluate candidate against this) ==
{job_description.strip()}

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

== SCORING RUBRIC (be strict) ==
90-100: Exceptional - Exceeds ALL requirements{' from the JD' if jd_context else ''}
75-89: Strong - Meets critical requirements
60-74: Potential - Some gaps but coachable
40-59: Weak - Missing key requirements
0-39: Not a fit - Wrong background

RETURN ONLY VALID JSON:
{{
  "score": <0-100>,
  "one_line_summary": "<10-word punchy summary>",
  "pros": ["strength 1", "strength 2", "strength 3"],
  "cons": ["concern 1", "concern 2", "concern 3"],
  "reasoning": "<2-3 sentence explanation{' referencing JD requirements' if jd_context else ''}>"
}}"""


async def evaluate_candidate(candidate: dict, job_description: str = "") -> Evaluation:
    """Get AI evaluation for a candidate with optional job description context."""
    prompt = build_evaluation_prompt(candidate, job_description)
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.chat.completions.create(
                model=SCORING_MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert recruiter. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
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

async def process_csv_file(file_content: bytes, progress_callback=None, job_description: str = "") -> List[dict]:
    """
    Process a CSV file and return scored candidates.
    
    Args:
        file_content: Raw bytes of the CSV file
        progress_callback: Optional async callback(phase, progress, message)
        job_description: Optional job description for contextualized AI scoring
    
    Returns:
        List of candidate dictionaries with scores
    """
    from models.candidate import Candidate
    from services.candidate_store import save_candidates, clear_all_candidates
    import io
    
    # Parse CSV
    df = pd.read_csv(io.BytesIO(file_content))
    total_candidates = len(df)
    
    if progress_callback:
        await progress_callback("extracting", 0, f"Processing {total_candidates} candidates...")
    
    # Clear existing candidates
    clear_all_candidates()
    
    all_candidates = []
    
    # Process in batches
    for batch_start in range(0, total_candidates, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, total_candidates)
        batch_df = df.iloc[batch_start:batch_end]
        
        # Phase 1: Extract data
        extracted_batch = []
        for idx, row in batch_df.iterrows():
            enrichment = parse_enrichment_json(row.get("crustdata_enrichment_data", ""))
            base_data = extract_deterministic(row, enrichment)
            
            # Get semantic extraction if we have enrichment
            if enrichment:
                try:
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
            
            extracted_batch.append(base_data)
        
        extracted_count = batch_end
        if progress_callback:
            progress = int((extracted_count / total_candidates) * 50)
            # Pass extracted batch for streaming algo preview
            await progress_callback(
                "extracting", 
                progress, 
                f"Extracted {extracted_count}/{total_candidates}",
                {"extracted_batch": extracted_batch}
            )
        
        # Phase 2: Score candidates
        if progress_callback:
            await progress_callback("scoring", 50, f"Scoring batch {batch_start}-{batch_end}...")
        
        for candidate_data in extracted_batch:
            # Calculate algo score
            algo_score = calculate_algo_score(candidate_data)
            
            # Get AI evaluation with job description context
            try:
                evaluation = await evaluate_candidate(candidate_data, job_description)
                ai_score = evaluation.score
            except Exception as e:
                logger.error(f"AI evaluation failed for {candidate_data['name']}: {e}")
                evaluation = Evaluation(score=50, one_line_summary="Evaluation failed")
                ai_score = 50
            
            # Calculate combined score and tier
            combined_score = round((algo_score + ai_score) / 2)
            tier = assign_tier(combined_score)
            
            # Get missing fields
            missing_required, missing_preferred, completeness = get_missing_fields(candidate_data)
            
            # Create unified Candidate object
            candidate = Candidate(
                id=candidate_data.get("id", str(len(all_candidates))),
                name=candidate_data.get("name", "Unknown"),
                job_title=candidate_data.get("job_title"),
                location_city=candidate_data.get("location_city"),
                location_state=candidate_data.get("location_state"),
                years_experience=candidate_data.get("years_experience"),
                bio_summary=candidate_data.get("bio_summary"),
                industries=candidate_data.get("industries", []),
                skills=candidate_data.get("skills", []),
                sales_methodologies=candidate_data.get("sales_methodologies", []),
                sold_to_finance=candidate_data.get("sold_to_finance", False),
                is_founder=candidate_data.get("is_founder", False),
                startup_experience=candidate_data.get("startup_experience", False),
                enterprise_experience=candidate_data.get("enterprise_experience", False),
                max_acv_mentioned=candidate_data.get("max_acv_mentioned"),
                quota_attainment=candidate_data.get("quota_attainment"),
                algo_score=algo_score,
                ai_score=ai_score,
                combined_score=combined_score,
                tier=tier,
                one_line_summary=evaluation.one_line_summary,
                pros=evaluation.pros,
                cons=evaluation.cons,
                reasoning=evaluation.reasoning,
                missing_required=missing_required,
                missing_preferred=missing_preferred,
                red_flags=candidate_data.get("red_flags", []),
                red_flag_count=candidate_data.get("red_flag_count", 0),
                completeness=completeness,
                has_enrichment_data=candidate_data.get("has_enrichment_data", False),
                source="csv_upload",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            all_candidates.append(candidate)
        
        scored_count = batch_end
        if progress_callback:
            progress = 50 + int((scored_count / total_candidates) * 50)
            await progress_callback(
                "scoring", 
                progress, 
                f"AI analyzing {scored_count}/{total_candidates}...",
                {"candidates_scored": scored_count}
            )
    
    # Sort by combined score
    all_candidates.sort(key=lambda c: c.combined_score or 0, reverse=True)
    
    # Save to store
    save_candidates(all_candidates)
    
    if progress_callback:
        await progress_callback("complete", 100, f"Processed {len(all_candidates)} candidates")
    
    return [c.model_dump() for c in all_candidates]
