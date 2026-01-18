"""
Candidate Extractor Service - LLM-based attribute extraction from CSV row data.

This service extracts comprehensive candidate profile attributes from any CSV row data
using LLM, regardless of the column structure. It can handle:
- Raw text fields (name, bio, notes)
- Resume/CV text
- LinkedIn URLs or data
- Any free-form candidate information
"""

import json
import asyncio
import logging
from typing import Any, Dict, List, Optional

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
EXTRACTION_MODEL = LLM_MODEL
MAX_RETRIES = 2
RATE_LIMIT_RETRY_DELAY = 1.0

# Initialize OpenRouter client
client = AsyncOpenAI(
    base_url=OPENROUTER_BASE_URL,
    api_key=OPENROUTER_API_KEY,
)


# ============================================================================
# Pydantic Models for Extracted Profile
# ============================================================================

class WorkExperience(BaseModel):
    """A single work experience entry."""
    company: str = Field(description="Company name")
    title: str = Field(description="Job title")
    start_date: Optional[str] = Field(None, description="Start date (YYYY-MM or YYYY)")
    end_date: Optional[str] = Field(None, description="End date or 'Present'")
    duration_months: Optional[int] = Field(None, description="Estimated duration in months")
    description: Optional[str] = Field(None, description="Brief description of role/achievements")
    is_current: bool = Field(default=False, description="Is this the current role?")


class Education(BaseModel):
    """A single education entry."""
    institution: str = Field(description="School/University name")
    degree: Optional[str] = Field(None, description="Degree type (BS, MS, PhD, etc.)")
    field_of_study: Optional[str] = Field(None, description="Major/Field of study")
    graduation_year: Optional[str] = Field(None, description="Graduation year")


class ExtractedCandidateProfile(BaseModel):
    """Comprehensive profile extracted from CSV row data via LLM."""
    # Basic Info
    name: str = Field(description="Full name of the candidate")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    location: Optional[str] = Field(None, description="City, State/Country")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")

    # Professional Summary
    headline: Optional[str] = Field(None, description="Professional headline/tagline (max 100 chars)")
    summary: Optional[str] = Field(None, description="Professional summary (2-3 sentences)")

    # Current Position
    current_title: Optional[str] = Field(None, description="Current job title")
    current_company: Optional[str] = Field(None, description="Current company name")

    # Experience
    years_experience: Optional[float] = Field(None, description="Total years of professional experience")
    work_history: List[WorkExperience] = Field(default_factory=list, description="Work history (most recent first)")

    # Education
    education: List[Education] = Field(default_factory=list, description="Education history")
    highest_education: Optional[str] = Field(None, description="Highest degree and field")

    # Skills
    technical_skills: List[str] = Field(default_factory=list, description="Technical/hard skills")
    soft_skills: List[str] = Field(default_factory=list, description="Soft skills/interpersonal skills")
    tools_technologies: List[str] = Field(default_factory=list, description="Tools, technologies, platforms")
    certifications: List[str] = Field(default_factory=list, description="Certifications and licenses")
    languages: List[str] = Field(default_factory=list, description="Languages spoken")

    # Industries & Domains
    industries: List[str] = Field(default_factory=list, description="Industries worked in")
    domains: List[str] = Field(default_factory=list, description="Functional domains (sales, marketing, etc.)")

    # Career Indicators
    career_trajectory: Optional[str] = Field(None, description="Career growth pattern (ascending, lateral, etc.)")
    notable_achievements: List[str] = Field(default_factory=list, description="Key achievements/accomplishments")
    leadership_experience: Optional[str] = Field(None, description="Leadership/management experience description")

    # Behavioral Indicators (inferred from data)
    inferred_strengths: List[str] = Field(default_factory=list, description="Strengths inferred from profile")
    potential_concerns: List[str] = Field(default_factory=list, description="Potential concerns (gaps, job hopping, etc.)")

    # Extraction Metadata
    extraction_confidence: float = Field(
        default=0.8,
        ge=0,
        le=1,
        description="Confidence in extraction quality (0-1)"
    )
    data_completeness: float = Field(
        default=0.5,
        ge=0,
        le=1,
        description="How complete the extracted data is (0-1)"
    )


# ============================================================================
# Extraction Functions
# ============================================================================

def build_extraction_prompt(row_data: Dict[str, Any]) -> str:
    """Build the prompt for extracting candidate profile from CSV row data."""

    # Convert row data to readable format
    row_str = ""
    for key, value in row_data.items():
        if value and str(value).strip():
            row_str += f"{key}: {value}\n"

    return f"""You are an expert HR data analyst. Extract a comprehensive candidate profile from the following CSV row data.

== RAW CSV ROW DATA ==
{row_str}

== INSTRUCTIONS ==

Extract ALL possible information about this candidate. Look for:

1. BASIC INFO:
   - Full name (combine first/last if separate)
   - Email, phone, location, LinkedIn URL

2. PROFESSIONAL PROFILE:
   - Create a compelling headline based on their role/experience
   - Write a 2-3 sentence professional summary
   - Identify current title and company

3. WORK EXPERIENCE:
   - Extract or infer years of experience
   - Identify work history (companies, titles, dates)
   - Note if they're currently employed

4. EDUCATION:
   - Schools, degrees, fields of study
   - Graduation years if available

5. SKILLS (be comprehensive):
   - Technical/hard skills (programming, tools, methodologies)
   - Soft skills (communication, leadership, teamwork)
   - Tools and technologies (specific platforms, software)
   - Certifications and languages

6. CAREER ANALYSIS:
   - Industries they've worked in
   - Functional domains (engineering, sales, etc.)
   - Career trajectory (growing, stable, lateral)
   - Notable achievements or accomplishments
   - Leadership/management experience

7. BEHAVIORAL INDICATORS:
   - Inferred strengths based on their profile
   - Potential concerns (job hopping, gaps, overqualified, etc.)

IMPORTANT:
- If data is limited, infer what you can reasonably from context
- Set extraction_confidence lower if data is sparse
- Set data_completeness based on how much you could extract
- Never make up specific facts (dates, companies) - only infer patterns
- If a field cannot be determined, leave it null or empty

Return ONLY valid JSON matching the exact schema provided."""


async def extract_candidate_profile(
    row_data: Dict[str, Any],
) -> ExtractedCandidateProfile:
    """
    Extract comprehensive candidate profile from CSV row data using LLM.

    Args:
        row_data: Dictionary of CSV row data (column_name: value)

    Returns:
        ExtractedCandidateProfile with all extractable attributes
    """
    # Check if we have any meaningful data
    meaningful_data = {k: v for k, v in row_data.items()
                       if v and str(v).strip() and k.lower() not in ['id', 'row']}

    if not meaningful_data:
        return ExtractedCandidateProfile(
            name="Unknown",
            extraction_confidence=0.0,
            data_completeness=0.0,
        )

    prompt = build_extraction_prompt(meaningful_data)

    for attempt in range(MAX_RETRIES + 1):
        try:
            completion = await client.beta.chat.completions.parse(
                model=EXTRACTION_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert HR data analyst. Extract comprehensive candidate profiles from raw data. Return precise, evidence-based JSON."
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format=ExtractedCandidateProfile,
                temperature=0.2,
            )

            result = completion.choices[0].message.parsed
            logger.info(f"Extracted profile for: {result.name} (confidence: {result.extraction_confidence})")
            return result

        except Exception as e:
            error_str = str(e).lower()
            is_rate_limit = "rate" in error_str or "limit" in error_str or "429" in error_str

            if is_rate_limit and attempt < MAX_RETRIES:
                delay = RATE_LIMIT_RETRY_DELAY * (2 ** attempt)
                logger.warning(f"Rate limit hit, retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})")
                await asyncio.sleep(delay)
                continue

            logger.error(f"Profile extraction failed: {e}")

            # Return a minimal profile with what we can get from raw data
            return ExtractedCandidateProfile(
                name=row_data.get("name", "") or row_data.get("full_name", "") or "Unknown",
                email=row_data.get("email"),
                phone=row_data.get("phone"),
                current_title=row_data.get("current_title") or row_data.get("title"),
                current_company=row_data.get("current_company") or row_data.get("company"),
                extraction_confidence=0.1,
                data_completeness=0.1,
            )

    # Fallback
    return ExtractedCandidateProfile(
        name=row_data.get("name", "Unknown"),
        extraction_confidence=0.0,
        data_completeness=0.0,
    )


async def extract_candidates_batch(
    rows: List[Dict[str, Any]],
    batch_size: int = 5,
    progress_callback=None,
) -> List[ExtractedCandidateProfile]:
    """
    Extract profiles for multiple candidates in batches.

    Args:
        rows: List of CSV row dictionaries
        batch_size: Number of concurrent LLM calls
        progress_callback: Optional async callback(current, total, profile)

    Returns:
        List of ExtractedCandidateProfile objects
    """
    results = []
    total = len(rows)

    for i in range(0, total, batch_size):
        batch = rows[i:i + batch_size]

        # Create tasks for this batch
        tasks = [extract_candidate_profile(row) for row in batch]

        # Run batch concurrently
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for j, result in enumerate(batch_results):
            if isinstance(result, Exception):
                logger.error(f"Batch extraction failed: {result}")
                result = ExtractedCandidateProfile(
                    name=batch[j].get("name", "Unknown"),
                    extraction_confidence=0.0,
                    data_completeness=0.0,
                )

            results.append(result)

            if progress_callback:
                await progress_callback(len(results), total, result)

        logger.info(f"Extracted batch {i // batch_size + 1}: {len(batch)} profiles")

    return results


def profile_to_enrichment_format(profile: ExtractedCandidateProfile) -> Dict[str, Any]:
    """
    Convert ExtractedCandidateProfile to the enrichment data format
    expected by the screening service.
    """
    # Build work history in expected format
    work_history = []
    for exp in profile.work_history:
        work_history.append({
            "employer_name": exp.company,
            "employee_title": exp.title,
            "start_date": exp.start_date,
            "end_date": exp.end_date,
            "is_current": exp.is_current,
        })

    # Build education in expected format
    education = []
    for edu in profile.education:
        education.append({
            "school_name": edu.institution,
            "degree": edu.degree,
            "field_of_study": edu.field_of_study,
            "graduation_year": edu.graduation_year,
        })

    # Combine all skills
    all_skills = (
        profile.technical_skills +
        profile.soft_skills +
        profile.tools_technologies
    )

    return {
        "full_name": profile.name,
        "email": profile.email,
        "phone": profile.phone,
        "linkedin_url": profile.linkedin_url,
        "headline": profile.headline,
        "summary": profile.summary,
        "location": profile.location,
        "title": profile.current_title,
        "current_employers": [{
            "employer_name": profile.current_company,
            "employee_title": profile.current_title,
        }] if profile.current_company else [],
        "past_employers": work_history[1:] if len(work_history) > 1 else [],
        "skills": [{"name": s} for s in all_skills],
        "education": education,
        "certifications": profile.certifications,
        "languages": profile.languages,
        "industries": profile.industries,
        "years_experience": profile.years_experience,
        # Additional extracted data
        "domains": profile.domains,
        "notable_achievements": profile.notable_achievements,
        "leadership_experience": profile.leadership_experience,
        "career_trajectory": profile.career_trajectory,
        "inferred_strengths": profile.inferred_strengths,
        "potential_concerns": profile.potential_concerns,
        "extraction_confidence": profile.extraction_confidence,
        "data_completeness": profile.data_completeness,
    }
