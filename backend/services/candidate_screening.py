"""
Candidate Screening Service - Combined LLM extraction and scoring.

This service performs profile extraction AND job-fit scoring in a single LLM call
for maximum efficiency during candidate upload.
"""

import json
import asyncio
import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

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
SCREENING_MODEL = LLM_MODEL
MAX_RETRIES = 2
RATE_LIMIT_RETRY_DELAY = 1.0

# Initialize OpenRouter client
client = AsyncOpenAI(
    base_url=OPENROUTER_BASE_URL,
    api_key=OPENROUTER_API_KEY,
)


# ============================================================================
# Pydantic Models for Structured Output
# ============================================================================

class ExtractedProfile(BaseModel):
    """Profile data extracted from enrichment data."""
    name: str = Field(description="Full name of the candidate")
    headline: Optional[str] = Field(None, description="Professional headline/tagline")
    summary: Optional[str] = Field(None, description="Professional summary (2-3 sentences)")
    current_title: Optional[str] = Field(None, description="Current job title")
    current_company: Optional[str] = Field(None, description="Current company name")
    location: Optional[str] = Field(None, description="Location (city, state/country)")
    years_experience: Optional[float] = Field(None, description="Estimated total years of experience")
    skills: List[str] = Field(default_factory=list, description="List of key skills")
    industries: List[str] = Field(default_factory=list, description="Industries worked in")
    education_summary: Optional[str] = Field(None, description="Highest degree and school")


class RedFlag(BaseModel):
    """A potential concern about the candidate."""
    concern: str = Field(description="Brief description of the concern")
    severity: str = Field(description="High, Medium, or Low")
    evidence: str = Field(description="What in the profile suggests this")


class GreenFlag(BaseModel):
    """A positive signal about the candidate."""
    strength: str = Field(description="Brief description of the strength")
    evidence: str = Field(description="What in the profile demonstrates this")


class SkillMatch(BaseModel):
    """How a candidate skill matches job requirements."""
    skill: str = Field(description="The skill being evaluated")
    match_level: str = Field(description="Strong Match, Partial Match, or No Match")
    notes: Optional[str] = Field(None, description="Additional context")


class ScreeningResult(BaseModel):
    """Combined extraction and scoring result from LLM."""
    # Extracted Profile
    profile: ExtractedProfile

    # Scoring
    overall_score: int = Field(ge=0, le=100, description="Overall fit score 0-100")
    recommendation: str = Field(description="Strong Fit, Good Fit, Potential Fit, or Not a Fit")
    fit_summary: str = Field(description="2-3 sentence summary of fit assessment")

    # Detailed Analysis
    skill_matches: List[SkillMatch] = Field(default_factory=list, description="How skills match job requirements")
    green_flags: List[GreenFlag] = Field(default_factory=list, description="Positive signals")
    red_flags: List[RedFlag] = Field(default_factory=list, description="Concerns or risks")

    # Interview Guidance
    interview_questions: List[str] = Field(default_factory=list, description="3 tailored interview questions")


# ============================================================================
# Screening Functions
# ============================================================================

def build_screening_prompt(
    enrichment_data: Dict[str, Any],
    job_title: str,
    job_description: str,
    required_skills: List[str] = None,
) -> str:
    """Build the combined extraction + scoring prompt."""

    # Format enrichment data for the prompt
    enrichment_str = json.dumps(enrichment_data, indent=2, default=str)[:8000]  # Limit size

    # Build requirements section
    requirements_section = ""
    if required_skills:
        requirements_section = f"""
REQUIRED SKILLS/QUALIFICATIONS:
{chr(10).join(f"- {skill}" for skill in required_skills)}
"""

    return f"""You are an expert recruiter performing candidate screening.

TASK: Analyze the candidate's LinkedIn/enrichment data and evaluate their fit for the role.
Do BOTH extraction AND scoring in this single response.

== JOB INFORMATION ==
Title: {job_title}

Description:
{job_description[:3000] if job_description else "Not provided - evaluate based on general professional quality"}
{requirements_section}

== CANDIDATE RAW DATA (LinkedIn/Enrichment) ==
{enrichment_str}

== INSTRUCTIONS ==

1. EXTRACT the candidate's profile from the raw data:
   - Find their full name (check: full_name, name, first_name + last_name)
   - Extract headline, summary, current role, company, location
   - Estimate years of experience from work history
   - List their key skills (max 15)
   - Identify industries they've worked in
   - Summarize their education

2. SCORE the candidate against the job requirements:
   - Overall score (0-100): How well do they match this specific role?
   - Recommendation: "Strong Fit" (80+), "Good Fit" (60-79), "Potential Fit" (40-59), "Not a Fit" (<40)
   - Fit summary: 2-3 sentences explaining the score

3. ANALYZE in detail:
   - Skill matches: For each required skill, rate match level
   - Green flags: What makes them stand out positively?
   - Red flags: Any concerns? (job hopping, gaps, overqualified, misalignment)

4. SUGGEST 3 interview questions tailored to:
   - Validate their strongest claimed skills
   - Probe any gaps or concerns
   - Assess fit for this specific role

== SCORING RUBRIC ==
90-100: Exceptional - Exceeds all requirements, strong culture indicators
75-89: Strong Fit - Meets critical requirements, minor gaps
60-74: Good Fit - Meets most requirements, coachable gaps
40-59: Potential Fit - Some relevant experience, significant gaps
0-39: Not a Fit - Missing critical requirements

Return ONLY valid JSON matching the exact schema provided."""


async def screen_candidate(
    enrichment_data: Dict[str, Any],
    job_title: str,
    job_description: str,
    required_skills: List[str] = None,
) -> ScreeningResult:
    """
    Perform combined extraction and scoring for a candidate.

    Args:
        enrichment_data: Raw enrichment/LinkedIn data for the candidate
        job_title: The job title
        job_description: Full job description text
        required_skills: Optional list of required skills/qualifications

    Returns:
        ScreeningResult with extracted profile and scoring
    """
    prompt = build_screening_prompt(
        enrichment_data=enrichment_data,
        job_title=job_title,
        job_description=job_description,
        required_skills=required_skills,
    )

    for attempt in range(MAX_RETRIES + 1):
        try:
            # Use structured output for reliable parsing
            completion = await client.beta.chat.completions.parse(
                model=SCREENING_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert recruiter. Extract candidate data and evaluate job fit. Return precise, evidence-based JSON."
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format=ScreeningResult,
                temperature=0.3,
            )

            result = completion.choices[0].message.parsed
            logger.info(f"Screened candidate: {result.profile.name} - Score: {result.overall_score}")
            return result

        except Exception as e:
            error_str = str(e).lower()
            is_rate_limit = "rate" in error_str or "limit" in error_str or "429" in error_str

            if is_rate_limit and attempt < MAX_RETRIES:
                delay = RATE_LIMIT_RETRY_DELAY * (2 ** attempt)
                logger.warning(f"Rate limit hit, retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})")
                await asyncio.sleep(delay)
                continue

            logger.error(f"Screening failed: {e}")

            # Return a fallback result
            return ScreeningResult(
                profile=ExtractedProfile(
                    name=enrichment_data.get("full_name") or enrichment_data.get("name") or "Unknown",
                    headline=enrichment_data.get("headline"),
                    summary=None,
                    current_title=None,
                    current_company=None,
                    location=enrichment_data.get("location"),
                    years_experience=None,
                    skills=[],
                    industries=[],
                    education_summary=None,
                ),
                overall_score=0,
                recommendation="Unable to Score",
                fit_summary=f"Screening failed: {str(e)[:100]}",
                skill_matches=[],
                green_flags=[],
                red_flags=[],
                interview_questions=[],
            )

    # Should not reach here, but just in case
    return ScreeningResult(
        profile=ExtractedProfile(name="Unknown"),
        overall_score=0,
        recommendation="Unable to Score",
        fit_summary="Screening failed after retries",
        skill_matches=[],
        green_flags=[],
        red_flags=[],
        interview_questions=[],
    )


async def screen_candidates_batch(
    candidates: List[Dict[str, Any]],
    job_title: str,
    job_description: str,
    required_skills: List[str] = None,
    batch_size: int = 5,
    progress_callback=None,
) -> List[Dict[str, Any]]:
    """
    Screen multiple candidates in batches.

    Args:
        candidates: List of dicts with 'enrichment_data' and 'candidate_id'
        job_title: The job title
        job_description: Full job description text
        required_skills: Optional list of required skills
        batch_size: Number of concurrent LLM calls
        progress_callback: Optional async callback(current, total, result)

    Returns:
        List of dicts with candidate_id and screening result
    """
    results = []
    total = len(candidates)

    for i in range(0, total, batch_size):
        batch = candidates[i:i + batch_size]

        # Create tasks for this batch
        tasks = []
        for candidate in batch:
            task = screen_candidate(
                enrichment_data=candidate.get("enrichment_data", {}),
                job_title=job_title,
                job_description=job_description,
                required_skills=required_skills,
            )
            tasks.append(task)

        # Run batch concurrently
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for j, result in enumerate(batch_results):
            candidate = batch[j]
            if isinstance(result, Exception):
                logger.error(f"Batch screening failed for candidate: {result}")
                result = ScreeningResult(
                    profile=ExtractedProfile(name="Unknown"),
                    overall_score=0,
                    recommendation="Error",
                    fit_summary=str(result)[:200],
                    skill_matches=[],
                    green_flags=[],
                    red_flags=[],
                    interview_questions=[],
                )

            results.append({
                "candidate_id": candidate.get("candidate_id"),
                "person_id": candidate.get("person_id"),
                "result": result,
            })

            if progress_callback:
                await progress_callback(len(results), total, result)

        logger.info(f"Screened batch {i // batch_size + 1}: {len(batch)} candidates")

    return results


# ============================================================================
# Background Task for Upload Integration
# ============================================================================

async def process_candidate_screening(
    candidate_id: UUID,
    person_id: UUID,
    enrichment_data: Dict[str, Any],
    job_title: str,
    job_description: str,
    required_skills: List[str] = None,
):
    """
    Background task to screen a single candidate and update the database.

    This is called after a candidate is created during CSV upload.
    """
    from repositories.streamlined.candidate_repo import CandidateRepository
    from repositories.streamlined.person_repo import PersonRepository
    from models.streamlined.candidate import CandidateUpdate
    from models.streamlined.person import PersonUpdate

    candidate_repo = CandidateRepository()
    person_repo = PersonRepository()

    try:
        # Run the screening
        result = await screen_candidate(
            enrichment_data=enrichment_data,
            job_title=job_title,
            job_description=job_description,
            required_skills=required_skills,
        )

        # Update Person with extracted profile data
        person_update = PersonUpdate(
            name=result.profile.name if result.profile.name != "Unknown" else None,
            headline=result.profile.headline,
            summary=result.profile.summary,
            current_title=result.profile.current_title,
            current_company=result.profile.current_company,
            location=result.profile.location,
            years_experience=result.profile.years_experience,
            skills=result.profile.skills if result.profile.skills else None,
        )
        person_repo.update_sync(person_id, person_update)

        # Update Candidate with scoring results
        # Store red flags and green flags as JSON in screening_notes
        screening_data = {
            "fit_summary": result.fit_summary,
            "recommendation": result.recommendation,
            "skill_matches": [m.model_dump() for m in result.skill_matches],
            "green_flags": [g.model_dump() for g in result.green_flags],
            "red_flags": [r.model_dump() for r in result.red_flags],
            "interview_questions": result.interview_questions,
        }

        candidate_update = CandidateUpdate(
            combined_score=result.overall_score,
            screening_notes=json.dumps(screening_data),
        )
        candidate_repo.update_sync(candidate_id, candidate_update)

        logger.info(f"Screening complete for candidate {candidate_id}: Score {result.overall_score}")

    except Exception as e:
        logger.error(f"Background screening failed for candidate {candidate_id}: {e}")
