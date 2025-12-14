"""
Pluto processor service - handles CSV processing, extraction, and scoring.
Adapted from Pluto/backend/extract_data.py and score_candidates.py
"""

import json
import asyncio
import logging
from typing import Any, List, Optional, Literal
from datetime import datetime

import pandas as pd
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from config import OPENROUTER_API_KEY, LLM_MODEL

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# OpenRouter configuration
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
EXTRACTION_MODEL = LLM_MODEL  # Controlled via LLM_MODEL env var
SCORING_MODEL = LLM_MODEL     # Controlled via LLM_MODEL env var
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


# ============================================================================
# Deep Analytics Models (Pydantic)
# ============================================================================

class QuestionAnalytics(BaseModel):
    """Analysis of a single Q&A exchange."""
    question: str
    answer_summary: str
    quality_score: int = Field(ge=0, le=100, description="Overall quality 0-100")
    key_insight: str = Field(description="One sentence takeaway")
    topic: str = Field(description="Primary skill or competency area demonstrated (e.g. Leadership, Problem Solving, Technical Skills, Communication, Strategic Thinking, Domain Expertise)")
    relevance_score: int = Field(ge=0, le=10, description="How relevant the answer was to the question (0-10)")
    clarity_score: int = Field(ge=0, le=10, description="How clear/concise the answer was (0-10)")
    depth_score: int = Field(ge=0, le=10, description="Depth of technical/functional knowledge shown (0-10)")

class SkillEvidence(BaseModel):
    """Quote validation for a skill."""
    skill: str
    quote: str = Field(description="Exact quote from transcript proving the skill")
    confidence: str = Field(description="High/Medium/Low")

class BehavioralProfile(BaseModel):
    """Soft skills radar chart scores (0-10)."""
    leadership: int = Field(ge=0, le=10)
    resilience: int = Field(ge=0, le=10)
    communication: int = Field(ge=0, le=10)
    problem_solving: int = Field(ge=0, le=10)
    coachability: int = Field(ge=0, le=10)

class CommunicationMetrics(BaseModel):
    """Communication telemetry."""
    speaking_pace_wpm: int = Field(description="Words per minute")
    filler_word_frequency: str = Field(description="Low/Medium/High")
    listen_to_talk_ratio: float = Field(description="Ratio of listening time to speaking time")

class DeepAnalytics(BaseModel):
    """Comprehensive post-interview analysis."""
    overall_score: int = Field(ge=0, le=100)
    recommendation: Literal["Strong Hire", "Hire", "No Hire"]
    overall_synthesis: str = Field(description="Executive summary combining Resume, JD, and Performance.")
    question_analytics: List[QuestionAnalytics]
    skill_evidence: List[SkillEvidence]
    behavioral_profile: BehavioralProfile
    communication_metrics: CommunicationMetrics
    topics_to_probe: List[str] = Field(description="Specific topics for next interviewer")

# ... (Legacy Evaluation model omitted for brevity as it was not targeted by this edit)

# ...


# ============================================================================
# Evaluation Models (Legacy - keeping for backward compatibility if needed)
# ============================================================================
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

# Generic profile fields - applicable to any role
REQUIRED_FIELDS = [
    ("years_experience", "Years of Experience"),
    ("bio_summary", "Professional Summary"),
    ("job_title", "Current/Target Role"),
]

PREFERRED_FIELDS = [
    ("industries", "Industry Background"),
    ("skills", "Key Skills"),
    ("education", "Education"),
    ("notable_achievements", "Notable Achievements"),
    ("certifications", "Certifications"),
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


def sanitize_json(content: str) -> str:
    """Sanitize LLM JSON output to fix common errors like trailing commas."""
    import re
    # Remove trailing commas before ] or }
    content = re.sub(r',\s*]', ']', content)
    content = re.sub(r',\s*}', '}', content)
    # Fix unescaped quotes within strings (common LLM error)
    # This is tricky so we just try parsing first
    return content.strip()


async def evaluate_candidate(candidate: dict, job_description: str = "", scoring_criteria: list = None, red_flag_indicators: list = None) -> Evaluation:
    """Get AI evaluation for a candidate with optional job description context."""
    prompt = build_evaluation_prompt(candidate, job_description, scoring_criteria, red_flag_indicators)
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.chat.completions.create(
                model=SCORING_MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert recruiter. Return only valid JSON. Never include trailing commas."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.4,
            )
            
            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response")
            
            # Sanitize JSON before parsing
            sanitized = sanitize_json(content)
            
            try:
                return Evaluation.model_validate_json(sanitized)
            except Exception as parse_error:
                # Try fallback: parse as dict and construct manually
                logger.warning(f"JSON parse failed, trying fallback for {candidate.get('name')}: {parse_error}")
                data = json.loads(sanitized)
                return Evaluation(
                    score=data.get("score", 50),
                    one_line_summary=data.get("one_line_summary", "Evaluation parsed with fallback"),
                    pros=data.get("pros", [])[:5] if isinstance(data.get("pros"), list) else [],
                    cons=data.get("cons", [])[:5] if isinstance(data.get("cons"), list) else [],
                    reasoning=data.get("reasoning", ""),
                    interview_questions=data.get("interview_questions", [])[:3] if isinstance(data.get("interview_questions"), list) else [],
                )
            
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
    
    # Calculate completeness based on weighted fields
    total_weight = len(REQUIRED_FIELDS) * 2 + len(PREFERRED_FIELDS)  # Required fields weighted 2x
    present_weight = (len(REQUIRED_FIELDS) - len(missing_required)) * 2 + \
                     (len(PREFERRED_FIELDS) - len(missing_preferred))
    completeness = round((present_weight / total_weight) * 100) if total_weight > 0 else 0
    
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
# Deep Analytics Generation
# ============================================================================

def calculate_telemetry(transcript_text: str) -> CommunicationMetrics:
    """Calculate basic communication metrics from transcript text."""
    # This is an approximation since we don't have per-word timestamps in the plain text
    # Assuming average speaking rate for calculation if duration unknown
    
    words = transcript_text.split()
    word_count = len(words)
    
    # Estimate filler words
    filler_words = ["um", "uh", "like", "you know", "actually", "basically", "literally"]
    filler_count = sum(1 for w in words if w.lower().strip(",.") in filler_words)
    filler_ratio = filler_count / max(word_count, 1)
    
    filler_freq = "Low"
    if filler_ratio > 0.05: filler_freq = "High"
    elif filler_ratio > 0.02: filler_freq = "Medium"
    
    # Default values for now - would need deeper audio analysis for true WPM/Interruption
    return CommunicationMetrics(
        speaking_pace_wpm=140, # Average placeholder
        filler_word_frequency=filler_freq,
        listen_to_talk_ratio=0.4 # Placeholder
    )

async def generate_deep_analytics(transcript: str, candidate_data: dict, job_description: str = "") -> Optional[DeepAnalytics]:
    """Generate comprehensive post-interview analytics."""
    
    telemetry = calculate_telemetry(transcript)
    
    # Generate JSON schema from Pydantic models (excluding communication_metrics as it's calculated)
    schema_for_llm = {
        "overall_score": "integer 0-100",
        "recommendation": "Strong Hire | Hire | No Hire",
        "overall_synthesis": "string (executive summary)",
        "question_analytics": [QuestionAnalytics.model_json_schema()],
        "skill_evidence": [SkillEvidence.model_json_schema()],
        "behavioral_profile": BehavioralProfile.model_json_schema(),
        "topics_to_probe": ["string (follow-up topics)"]
    }
    
    prompt = f"""You are an expert Interview Analyst evaluating candidate performance.

CONTEXT:
- Candidate: {candidate_data.get('name', 'Unknown')}
- Role: {candidate_data.get('job_title', 'Not specified')}
- Job Description: {job_description[:2000] if job_description else 'Not provided'}
- Resume Summary: {candidate_data.get('bio_summary', 'Not provided')}

TRANSCRIPT:
{transcript[:15000]}

TASK:
Generate a comprehensive Deep Analytics report in JSON format:

1. **Question Analytics**: For EACH question-answer exchange in the transcript, analyze:
   - The exact question asked
   - Summary of the candidate's answer
   - Quality score (0-100)
   - Relevance score (0-10): How well the answer addressed the question
   - Clarity score (0-10): How clear and concise the response was
   - Depth score (0-10): Level of expertise/insight demonstrated
   - Key insight: One-sentence takeaway
   - Topic: Primary competency area (e.g., Leadership, Problem Solving, Technical Skills, Communication, Strategic Thinking, Domain Expertise, Collaboration, Adaptability)

2. **Skill Evidence**: Extract specific quotes that prove claimed skills

3. **Behavioral Profile**: Rate soft skills 0-10 (leadership, resilience, communication, problem_solving, coachability)

4. **Overall**: Synthesize into score (0-100), recommendation, and executive summary

5. **Topics to Probe**: Suggest follow-up areas for next interview round

OUTPUT SCHEMA:
{json.dumps(schema_for_llm, indent=2)}

Return ONLY valid JSON matching this schema."""

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.chat.completions.create(
                model=SCORING_MODEL,
                messages=[
                    {"role": "system", "content": "You are a precise analytics engine. Output valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )
            
            content = response.choices[0].message.content
            # Sanitize and parse
            sanitized = sanitize_json(content)
            data = json.loads(sanitized)
            
            # Merge calculated telemetry if not provided by LLM (LLM won't prompt for it, so we add it)
            data["communication_metrics"] = telemetry.model_dump()
            
            return DeepAnalytics.model_validate(data)
            
        except Exception as e:
            logger.error(f"Deep analytics generation failed (Attempt {attempt}): {e}")
            if attempt == MAX_RETRIES:
                 # Return a safe fallback
                 return DeepAnalytics(
                     overall_score=0,
                     recommendation="No Hire",
                     overall_synthesis="Analysis Failed",
                     question_analytics=[],
                     skill_evidence=[],
                     behavioral_profile=BehavioralProfile(leadership=0, resilience=0, communication=0, problem_solving=0, coachability=0),
                     communication_metrics=telemetry,
                     topics_to_probe=[]
                 )
            await asyncio.sleep(1)

    return None



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
    # PHASE 1: Extract ALL candidates (with semantic extraction) - BATCHED
    # ========================================================================
    import time
    all_extracted = []
    extraction_start = time.time()
    
    # First pass: deterministic extraction (fast, no API)
    logger.info(f"⏱️ Starting deterministic extraction for {total_candidates} candidates...")
    det_start = time.time()
    
    candidates_with_enrichment = []
    for idx, row in df.iterrows():
        enrichment = parse_enrichment_json(row.get("crustdata_enrichment_data", ""))
        base_data = extract_deterministic(row, enrichment)
        base_data["_enrichment"] = enrichment  # Store for later
        base_data["_idx"] = idx
        candidates_with_enrichment.append(base_data)
    
    logger.info(f"⏱️ Deterministic extraction complete: {time.time() - det_start:.2f}s")
    
    # Second pass: semantic extraction in BATCHES
    logger.info(f"⏱️ Starting semantic extraction (batches of {BATCH_SIZE})...")
    sem_start = time.time()
    
    for i in range(0, len(candidates_with_enrichment), BATCH_SIZE):
        batch = candidates_with_enrichment[i : i + BATCH_SIZE]
        batch_start = time.time()
        
        # Create extraction tasks for this batch
        extraction_tasks = []
        candidate_meta = []  # Store (candidate, enrichment) pairs
        
        for candidate in batch:
            enrichment = candidate.pop("_enrichment")
            candidate.pop("_idx")
            
            if enrichment:
                if extraction_fields:
                    task = extract_dynamic_fields(candidate.copy(), enrichment, extraction_fields)
                else:
                    task = extract_semantic(candidate.copy(), enrichment)
                extraction_tasks.append(task)
                candidate_meta.append((candidate, enrichment))
            else:
                # No enrichment, no API call needed
                extraction_tasks.append(None)
                candidate_meta.append((candidate, None))
        
        # Run all extractions in parallel using asyncio.gather
        api_tasks = [t for t in extraction_tasks if t is not None]
        if api_tasks:
            api_results = await asyncio.gather(*api_tasks, return_exceptions=True)
        else:
            api_results = []
        
        # Map results back
        api_result_iter = iter(api_results)
        results = []
        for i, (candidate, enrichment) in enumerate(candidate_meta):
            if extraction_tasks[i] is not None:
                result = next(api_result_iter)
                if isinstance(result, Exception):
                    logger.error(f"Extraction failed for {candidate['name']}: {result}")
                    result = None
                results.append((candidate, enrichment, result))
            else:
                results.append((candidate, None, None))
        
        # Process results
        for candidate, enrichment, result in results:
            if result:
                if extraction_fields and isinstance(result, dict):
                    # Dynamic extraction result
                    extraction = result.get("extraction", {})
                    candidate["bio_summary"] = extraction.get("bio_summary", "")
                    for field in extraction_fields:
                        field_name = field.get("field_name", "")
                        if field_name in extraction and field_name != "bio_summary":
                            candidate[field_name] = extraction[field_name]
                    candidate["red_flags"] = result.get("red_flags", [])
                    candidate["red_flag_count"] = result.get("red_flag_count", 0)
                elif hasattr(result, 'extraction'):
                    # Standard ExtractionResult
                    candidate.update({
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
            
            # Calculate algo score
            algo_score = calculate_algo_score(candidate)
            candidate["algo_score"] = algo_score
            
            # Initialize default fields
            candidate.update({
                "source": "csv_upload",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "ai_score": 0,
                "combined_score": algo_score,
                "tier": "Evaluate",
                "interview_status": "not_scheduled",
                "has_enrichment_data": enrichment is not None
            })
            
            all_extracted.append(candidate)
        
        batch_time = time.time() - batch_start
        logger.info(f"⏱️ Batch {i // BATCH_SIZE + 1} extracted: {len(batch)} candidates in {batch_time:.2f}s")
        
        # Progress update
        if progress_callback:
            progress = int((len(all_extracted) / total_candidates) * 40)
            await progress_callback(
                "extracting", 
                progress, 
                f"Extracted {len(all_extracted)}/{total_candidates}...",
                {"extracted_batch": all_extracted.copy()}
            )
    
    total_extraction_time = time.time() - extraction_start
    logger.info(f"⏱️ TOTAL EXTRACTION TIME: {total_extraction_time:.2f}s for {total_candidates} candidates ({total_extraction_time/total_candidates:.2f}s/candidate)")
    
    # Save extracted candidates
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
    Run AI scoring on a list of already extracted candidates with batch processing.
    """
    from services.candidate_store import save_candidates
    import time
    
    total_candidates = len(candidates_list)
    all_scored = []
    
    scoring_start = time.time()
    logger.info(f"⏱️ Starting AI scoring for {total_candidates} candidates (Batch Size: {BATCH_SIZE})...")
    
    # Process in batches
    for i in range(0, total_candidates, BATCH_SIZE):
        batch = candidates_list[i : i + BATCH_SIZE]
        batch_start = time.time()
        batch_tasks = []
        
        # Create tasks for the batch
        for candidate_obj in batch:
            candidate_data = candidate_obj.model_dump() if hasattr(candidate_obj, "model_dump") else candidate_obj
            
            # Create a coroutine for each candidate
            task = process_single_candidate(
                candidate_data, 
                job_description, 
                scoring_criteria, 
                red_flag_indicators
            )
            batch_tasks.append(task)
        
        # Run batch concurrently
        batch_results = await asyncio.gather(*batch_tasks)
        
        batch_time = time.time() - batch_start
        logger.info(f"⏱️ Scoring batch {i // BATCH_SIZE + 1} complete: {len(batch)} candidates in {batch_time:.2f}s")
        
        # Collect results and update progress
        for scored_candidate in batch_results:
            all_scored.append(scored_candidate_obj(scored_candidate))

        # Progress update after batch
        if progress_callback:
            current_count = len(all_scored)
            progress = 40 + int((current_count / total_candidates) * 60)
            
            # Send the last scored candidate in this batch as the "latest" for the UI preview
            latest_dict = all_scored[-1].model_dump() if all_scored else {}
            
            await progress_callback(
                "scoring", 
                progress, 
                f"AI scored {current_count}/{total_candidates}...",
                {"candidates_scored": current_count, "latest_scored": latest_dict}
            )
        
        # Save incrementally
        save_candidates(all_scored + candidates_list[len(all_scored):])
        
        # Small delay to respect rate limits if needed, but keeping it fast for user
        if i + BATCH_SIZE < total_candidates:
            await asyncio.sleep(0.5)

    # Sort by combined score
    all_scored.sort(key=lambda c: c.combined_score or 0, reverse=True)
    
    # Final Save
    save_candidates(all_scored)
    
    if progress_callback:
        await progress_callback("complete", 100, f"Processed {len(all_scored)} candidates")
    
    return [c.model_dump() for c in all_scored]


def scored_candidate_obj(candidate_data: dict) -> Any:
    """Helper to convert dict back to Candidate object."""
    from models.candidate import Candidate
    return Candidate(**candidate_data)


async def process_single_candidate(candidate_data: dict, job_description: str, scoring_criteria: list, red_flag_indicators: list) -> dict:
    """Helper function to process a single candidate for batching."""
    algo_score = candidate_data.get("algo_score", 0)
    
    # Get AI evaluation
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
    
    # Update candidate_data
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
    
    return candidate_data

