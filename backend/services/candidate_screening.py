"""
Candidate Screening Service - Combined LLM extraction and scoring with weighted attributes.

This service performs profile extraction AND job-fit scoring in a single LLM call
using the full weighted attributes from ExtractedRequirements (skills, red_flags,
success_signals, behavioral_traits, cultural_indicators, deal_breakers).
"""

import json
import asyncio
import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from config import OPENROUTER_API_KEY, LLM_MODEL
from models.streamlined.job import ExtractedRequirements, WeightedAttribute

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


class WeightedAttributeMatch(BaseModel):
    """Evaluation of how a candidate matches a weighted attribute."""
    attribute: str = Field(description="The attribute being evaluated")
    weight: float = Field(description="The attribute's weight from job requirements")
    match_score: float = Field(ge=0, le=1, description="Match score 0-1 (1 = fully matches)")
    evidence: str = Field(description="Evidence from candidate profile supporting this score")


class CategoryScore(BaseModel):
    """Score for a category of weighted attributes."""
    category: str = Field(description="Category name (required_skills, red_flags, etc.)")
    category_weight: float = Field(description="Weight of this category in overall scoring")
    raw_score: float = Field(ge=0, le=1, description="Raw score for this category (0-1)")
    weighted_score: float = Field(description="Category score * category weight")
    attribute_matches: List[WeightedAttributeMatch] = Field(
        default_factory=list,
        description="Individual attribute evaluations"
    )


class RedFlag(BaseModel):
    """A potential concern about the candidate."""
    concern: str = Field(description="Brief description of the concern")
    severity: str = Field(description="High, Medium, or Low")
    evidence: str = Field(description="What in the profile suggests this")
    matched_job_red_flag: Optional[str] = Field(None, description="If this matches a job-defined red flag")


class GreenFlag(BaseModel):
    """A positive signal about the candidate."""
    strength: str = Field(description="Brief description of the strength")
    evidence: str = Field(description="What in the profile demonstrates this")
    matched_success_signal: Optional[str] = Field(None, description="If this matches a job-defined success signal")


class SkillMatch(BaseModel):
    """How a candidate skill matches job requirements."""
    skill: str = Field(description="The skill being evaluated")
    match_level: str = Field(description="Strong Match, Partial Match, or No Match")
    weight: float = Field(default=1.0, description="Skill weight from job requirements")
    notes: Optional[str] = Field(None, description="Additional context")


class ScreeningResult(BaseModel):
    """Combined extraction and scoring result from LLM."""
    # Extracted Profile
    profile: ExtractedProfile

    # Overall Scoring
    overall_score: int = Field(ge=0, le=100, description="Overall fit score 0-100")
    recommendation: str = Field(description="Strong Fit, Good Fit, Potential Fit, or Not a Fit")
    fit_summary: str = Field(description="2-3 sentence summary of fit assessment")

    # Category-Level Scores
    category_scores: List[CategoryScore] = Field(
        default_factory=list,
        description="Detailed scores for each category"
    )

    # Skill Analysis
    skill_matches: List[SkillMatch] = Field(default_factory=list, description="How skills match job requirements")

    # Flags
    green_flags: List[GreenFlag] = Field(default_factory=list, description="Positive signals")
    red_flags: List[RedFlag] = Field(default_factory=list, description="Concerns or risks")

    # Deal Breaker Assessment
    deal_breakers_triggered: List[str] = Field(
        default_factory=list,
        description="Any deal breakers from job requirements that were triggered"
    )
    has_deal_breaker: bool = Field(default=False, description="True if any deal breaker is triggered")

    # Behavioral & Cultural Fit
    behavioral_assessment: Optional[str] = Field(None, description="Assessment of behavioral traits fit")
    cultural_fit_assessment: Optional[str] = Field(None, description="Assessment of cultural fit")

    # Interview Guidance
    interview_questions: List[str] = Field(default_factory=list, description="3-5 tailored interview questions")


# ============================================================================
# Screening Functions
# ============================================================================

def format_weighted_attributes(attrs: List[WeightedAttribute], name: str) -> str:
    """Format weighted attributes for the prompt."""
    if not attrs:
        return f"{name}: (none specified)"

    lines = [f"{name}:"]
    for attr in attrs:
        lines.append(f"  - {attr.value} (weight: {attr.weight:.2f})")
    return "\n".join(lines)


def build_screening_prompt(
    enrichment_data: Dict[str, Any],
    job_title: str,
    job_description: str,
    extracted_requirements: Optional[ExtractedRequirements] = None,
) -> str:
    """Build the combined extraction + scoring prompt with weighted attributes."""

    # Format enrichment data for the prompt
    enrichment_str = json.dumps(enrichment_data, indent=2, default=str)[:10000]

    # Build requirements section from ExtractedRequirements
    requirements_section = ""
    category_weights_section = ""

    if extracted_requirements:
        req = extracted_requirements

        # Basic requirements
        basic_reqs = []
        if req.years_experience:
            basic_reqs.append(f"Years Experience: {req.years_experience}")
        if req.education:
            basic_reqs.append(f"Education: {req.education}")
        if req.location:
            basic_reqs.append(f"Location: {req.location}")
        if req.work_type:
            basic_reqs.append(f"Work Type: {req.work_type}")

        requirements_section = f"""
== BASIC REQUIREMENTS ==
{chr(10).join(basic_reqs) if basic_reqs else "(none specified)"}

== WEIGHTED SKILL REQUIREMENTS ==
{format_weighted_attributes(req.required_skills, "Required Skills")}

{format_weighted_attributes(req.preferred_skills, "Preferred Skills")}

== SUCCESS SIGNALS (Green Flags) - Look for these positive indicators ==
{format_weighted_attributes(req.success_signals, "Success Signals")}

== RED FLAGS - Watch for these warning signs ==
{format_weighted_attributes(req.red_flags, "Red Flags")}

== BEHAVIORAL TRAITS - Evaluate these work behaviors ==
{format_weighted_attributes(req.behavioral_traits, "Behavioral Traits")}

== CULTURAL INDICATORS - Assess cultural fit ==
{format_weighted_attributes(req.cultural_indicators, "Cultural Indicators")}

== DEAL BREAKERS - Non-negotiable requirements (high priority) ==
{format_weighted_attributes(req.deal_breakers, "Deal Breakers")}

== IDEAL BACKGROUND ==
{req.ideal_background or "(not specified)"}
"""

        # Category weights section
        weights = req.category_weights
        category_weights_section = f"""
== CATEGORY WEIGHTS FOR SCORING ==
- Required Skills: {weights.get('required_skills', 0.25):.0%}
- Preferred Skills: {weights.get('preferred_skills', 0.10):.0%}
- Success Signals: {weights.get('success_signals', 0.20):.0%}
- Red Flags (penalty): {weights.get('red_flags', 0.15):.0%}
- Behavioral Traits: {weights.get('behavioral_traits', 0.15):.0%}
- Cultural Indicators: {weights.get('cultural_indicators', 0.10):.0%}
- Deal Breakers: {weights.get('deal_breakers', 0.05):.0%}
"""
    else:
        requirements_section = """
== JOB REQUIREMENTS ==
(No structured requirements extracted - evaluate based on job description)
"""

    return f"""You are an expert recruiter performing comprehensive candidate screening.

TASK: Analyze the candidate's profile data and evaluate their fit for the role using
the weighted requirements. Do BOTH extraction AND scoring in this single response.

== JOB INFORMATION ==
Title: {job_title}

Description:
{job_description[:4000] if job_description else "Not provided"}

{requirements_section}

{category_weights_section}

== CANDIDATE RAW DATA ==
{enrichment_str}

== SCORING INSTRUCTIONS ==

1. EXTRACT the candidate's profile from the raw data:
   - Full name, headline, current role, company, location
   - Estimate years of experience from work history
   - List key skills (max 20)
   - Identify industries worked in
   - Summarize education

2. EVALUATE EACH WEIGHTED ATTRIBUTE:
   For each category, evaluate how well the candidate matches:

   a) REQUIRED SKILLS: Score each skill 0-1 based on match level
      - 1.0 = Strong match (explicit experience)
      - 0.5 = Partial match (related experience)
      - 0.0 = No match

   b) PREFERRED SKILLS: Same scoring as required skills

   c) SUCCESS SIGNALS: Score each signal 0-1 based on evidence
      - 1.0 = Clear evidence in profile
      - 0.5 = Some indication
      - 0.0 = No evidence

   d) RED FLAGS: Score severity 0-1 (INVERTED for scoring)
      - 1.0 = Red flag clearly present (BAD)
      - 0.5 = Potential concern
      - 0.0 = No red flag detected (GOOD)

   e) BEHAVIORAL TRAITS: Score 0-1 based on evidence

   f) CULTURAL INDICATORS: Score 0-1 based on evidence

   g) DEAL BREAKERS: Check each one - ANY triggered = major penalty
      - List ALL triggered deal breakers
      - If ANY deal breaker is triggered, overall score should be < 40

3. CALCULATE CATEGORY SCORES:
   - For each category: sum(attribute_score * attribute_weight) / sum(weights)
   - Then apply category weight: category_score * category_weight
   - Red flags are PENALTY: (1 - red_flag_score) * category_weight

4. CALCULATE OVERALL SCORE:
   - Sum all weighted category scores
   - Scale to 0-100
   - Apply deal breaker penalty if triggered

5. PROVIDE RECOMMENDATION:
   - "Strong Fit" (80-100): Exceeds requirements, minimal concerns
   - "Good Fit" (60-79): Meets most requirements, coachable gaps
   - "Potential Fit" (40-59): Some relevant experience, significant gaps
   - "Not a Fit" (0-39): Missing critical requirements or deal breakers triggered

6. IDENTIFY FLAGS:
   - Green flags: Match with success_signals AND other positive indicators
   - Red flags: Match with job red_flags AND detected concerns

7. ASSESS BEHAVIORAL & CULTURAL FIT:
   - Summarize how candidate matches behavioral traits
   - Summarize cultural fit indicators

8. GENERATE INTERVIEW QUESTIONS:
   - 3-5 questions to validate strengths
   - Probe any concerns or gaps
   - Assess cultural/behavioral fit

Return ONLY valid JSON matching the exact schema provided."""


async def screen_candidate(
    enrichment_data: Dict[str, Any],
    job_title: str,
    job_description: str,
    extracted_requirements: Optional[ExtractedRequirements] = None,
    required_skills: List[str] = None,  # Legacy parameter for backwards compatibility
) -> ScreeningResult:
    """
    Perform combined extraction and scoring for a candidate.

    Args:
        enrichment_data: Raw enrichment/LinkedIn data for the candidate
        job_title: The job title
        job_description: Full job description text
        extracted_requirements: Full ExtractedRequirements with weighted attributes
        required_skills: Legacy parameter (ignored if extracted_requirements provided)

    Returns:
        ScreeningResult with extracted profile and comprehensive scoring
    """
    # If we have extracted_requirements, use full screening
    # Otherwise fall back to legacy behavior
    if not extracted_requirements and required_skills:
        # Create minimal ExtractedRequirements from legacy required_skills
        extracted_requirements = ExtractedRequirements(
            required_skills=[
                WeightedAttribute(value=skill, weight=1.0)
                for skill in required_skills
            ]
        )

    prompt = build_screening_prompt(
        enrichment_data=enrichment_data,
        job_title=job_title,
        job_description=job_description,
        extracted_requirements=extracted_requirements,
    )

    for attempt in range(MAX_RETRIES + 1):
        try:
            completion = await client.beta.chat.completions.parse(
                model=SCREENING_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert recruiter performing comprehensive candidate screening.
Evaluate candidates against ALL weighted requirements. Return precise, evidence-based JSON.
Be thorough in evaluating each weighted attribute and calculating scores."""
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
                category_scores=[],
                skill_matches=[],
                green_flags=[],
                red_flags=[],
                deal_breakers_triggered=[],
                has_deal_breaker=False,
                interview_questions=[],
            )

    # Should not reach here, but just in case
    return ScreeningResult(
        profile=ExtractedProfile(name="Unknown"),
        overall_score=0,
        recommendation="Unable to Score",
        fit_summary="Screening failed after retries",
        category_scores=[],
        skill_matches=[],
        green_flags=[],
        red_flags=[],
        deal_breakers_triggered=[],
        has_deal_breaker=False,
        interview_questions=[],
    )


async def screen_candidates_batch(
    candidates: List[Dict[str, Any]],
    job_title: str,
    job_description: str,
    extracted_requirements: Optional[ExtractedRequirements] = None,
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
        extracted_requirements: Full ExtractedRequirements with weighted attributes
        required_skills: Legacy parameter
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
                extracted_requirements=extracted_requirements,
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
                    category_scores=[],
                    skill_matches=[],
                    green_flags=[],
                    red_flags=[],
                    deal_breakers_triggered=[],
                    has_deal_breaker=False,
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
    extracted_requirements: Optional[ExtractedRequirements] = None,
    required_skills: List[str] = None,  # Legacy parameter
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
        # Run the screening with full weighted attributes
        result = await screen_candidate(
            enrichment_data=enrichment_data,
            job_title=job_title,
            job_description=job_description,
            extracted_requirements=extracted_requirements,
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

        # Build comprehensive screening notes
        screening_data = {
            "fit_summary": result.fit_summary,
            "recommendation": result.recommendation,
            # Category-level scores
            "category_scores": [cs.model_dump() for cs in result.category_scores],
            # Skill analysis
            "skill_matches": [m.model_dump() for m in result.skill_matches],
            # Flags
            "green_flags": [g.model_dump() for g in result.green_flags],
            "red_flags": [r.model_dump() for r in result.red_flags],
            # Deal breakers
            "deal_breakers_triggered": result.deal_breakers_triggered,
            "has_deal_breaker": result.has_deal_breaker,
            # Assessments
            "behavioral_assessment": result.behavioral_assessment,
            "cultural_fit_assessment": result.cultural_fit_assessment,
            # Interview guidance
            "interview_questions": result.interview_questions,
        }

        candidate_update = CandidateUpdate(
            combined_score=result.overall_score,
            screening_notes=json.dumps(screening_data),
        )
        candidate_repo.update_sync(candidate_id, candidate_update)

        logger.info(f"Screening complete for candidate {candidate_id}: Score {result.overall_score}")

        # Send email if Strong Fit
        if result.recommendation == "Strong Fit" and enrichment_data.get("email"):
            from services.email_service import EmailService
            
            logger.info(f"Candidate {candidate_id} is a Strong Fit. Generating email...")
            
            email_content = await EmailService.generate_strong_fit_email(
                candidate_name=result.profile.name,
                job_title=job_title,
                fit_summary=result.fit_summary,
                green_flags=[g.model_dump() for g in result.green_flags]
            )
            
            await EmailService.send_email(
                to_email=enrichment_data.get("email"),
                subject=email_content["subject"],
                body=email_content["body"]
            )

    except Exception as e:
        logger.error(f"Background screening failed for candidate {candidate_id}: {e}")
