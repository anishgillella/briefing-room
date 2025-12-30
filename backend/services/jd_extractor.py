"""
JD Extractor service.
Extracts structured job profile data from pasted job description text.
Uses Gemini 2.5 Flash via OpenRouter with Pydantic structured outputs.
"""
import httpx
import json
import logging
import uuid
from typing import Dict, Any, Optional, List, Tuple

from config import OPENROUTER_API_KEY, LLM_MODEL
from models.voice_ingest import (
    JobProfile,
    CompanyIntelligence,
    HardRequirements,
    CandidateTrait,
    InterviewStage,
    OutreachConfig,
    FieldConfidence,
)
from models.voice_ingest.enums import (
    ExtractionSource,
    LocationType,
    TraitPriority,
)

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class JDExtractor:
    """Extract structured job profile from JD text."""

    def __init__(self):
        self.api_key = OPENROUTER_API_KEY
        self.model = LLM_MODEL
        self.timeout = 60.0  # Longer timeout for complex extraction

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers for OpenRouter."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://briefingroom.ai",
            "X-Title": "Briefing Room JD Extraction",
        }

    async def extract(
        self,
        jd_text: str,
        company_context: Optional[CompanyIntelligence] = None
    ) -> Tuple[Dict[str, Any], Dict[str, float], List[str]]:
        """
        Extract all possible fields from JD text.

        Args:
            jd_text: Raw job description text
            company_context: Optional company context from Parallel.ai

        Returns:
            Tuple of (extracted_data, confidence_scores, missing_fields)
        """
        if not self.api_key:
            logger.warning("OpenRouter API key not configured")
            return {}, {}, ["all"]

        # Build prompt with optional company context
        prompt = self._build_extraction_prompt(jd_text, company_context)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    OPENROUTER_URL,
                    headers=self._get_headers(),
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.2,  # Low temp for extraction
                    }
                )
                response.raise_for_status()
                result = response.json()

            # Parse the response
            content = result["choices"][0]["message"]["content"]
            data = json.loads(content)

            # Extract confidence scores
            confidence_scores = data.pop("confidence_scores", {})

            # Calculate missing fields
            missing_fields = self._calculate_missing_fields(data, confidence_scores)

            return data, confidence_scores, missing_fields

        except httpx.TimeoutException:
            logger.error("Timeout extracting JD data")
            return {}, {}, ["extraction_failed"]

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in JD extraction: {e}")
            return {}, {}, ["extraction_failed"]

        except Exception as e:
            logger.error(f"Error extracting JD data: {e}")
            return {}, {}, ["extraction_failed"]

    def _build_extraction_prompt(
        self,
        jd_text: str,
        company_context: Optional[CompanyIntelligence]
    ) -> str:
        """Build the extraction prompt for the LLM."""

        company_hint = ""
        if company_context:
            company_hint = f"""
Company Context (already known):
- Name: {company_context.name}
- Industry: {company_context.industry or 'Unknown'}
- Stage: {company_context.funding_stage.value if company_context.funding_stage else 'Unknown'}
- Product: {company_context.product_description or 'Unknown'}
- Tech hints: {', '.join(company_context.tech_stack_hints) if company_context.tech_stack_hints else 'Unknown'}
"""

        return f"""
You are extracting structured information from a job description.
Extract ALL information that is explicitly stated or clearly implied.
Do NOT make up information. If something is not mentioned, use null.

{company_hint}

Job Description:
---
{jd_text}
---

Extract into this JSON structure:

{{
    "requirements": {{
        "job_title": "Exact title from JD or null",
        "location_type": "onsite/hybrid/remote or null if not stated",
        "location_city": "City name or null",
        "onsite_days_per_week": "Number 0-5 or null",
        "timezone_requirements": "e.g., 'PST hours' or null",
        "visa_sponsorship": "true/false or null if not stated",
        "work_authorization_notes": "Any notes about work auth or null",
        "experience_min_years": "Number or null",
        "experience_max_years": "Number or null",
        "salary_min": "Number (USD annual) or null",
        "salary_max": "Number (USD annual) or null",
        "equity_offered": "true/false or null",
        "equity_range": "e.g., '0.1-0.25%' or null",
        "bonus_structure": "Description or null"
    }},
    "traits": [
        {{
            "name": "Conceptual trait name (NOT individual tech like 'React')",
            "description": "1-2 sentence description of what this means",
            "priority": "must_have or nice_to_have",
            "signals": ["What to look for in candidates"],
            "anti_signals": ["Red flags"]
        }}
    ],
    "interview_stages": [
        {{
            "name": "Stage name",
            "description": "What this stage evaluates",
            "order": 1,
            "duration_minutes": "Number or null",
            "interviewer_role": "Who conducts this or null",
            "actions": ["Recruiter instructions"]
        }}
    ],
    "outreach": {{
        "tone": "formal/casual/direct/enthusiastic or null",
        "key_hook": "What makes this role compelling or null",
        "selling_points": ["Reasons to take this job"]
    }},
    "confidence_scores": {{
        "job_title": 0.0-1.0,
        "location": 0.0-1.0,
        "experience": 0.0-1.0,
        "compensation": 0.0-1.0,
        "visa": 0.0-1.0,
        "equity": 0.0-1.0,
        "traits": 0.0-1.0,
        "interview_stages": 0.0-1.0
    }}
}}

IMPORTANT RULES:

1. **Traits must be CONCEPTUAL**, not individual technologies:
   - GOOD: "Frontend Development" with signals ["React", "Vue", "TypeScript"]
   - BAD: Separate traits for "React", "Vue", "TypeScript"
   - Group related technologies into conceptual categories

2. **Every trait MUST have a description** (1-2 sentences)

3. **For compensation**:
   - If only one number given, use it as salary_min
   - Look for equity mentions separately
   - "Competitive salary" = null (not specific enough)
   - Convert salary to annual USD (e.g., "$150k" → 150000)

4. **For interview stages**:
   - Only include if JD explicitly describes the process
   - Don't invent stages that aren't mentioned

5. **Confidence scores** (how certain you are):
   - 1.0 = Explicitly stated verbatim
   - 0.7-0.9 = Clearly implied or stated with minor inference
   - 0.4-0.6 = Inferred from context
   - 0.1-0.3 = Guessed, needs confirmation
   - 0.0 = Not mentioned at all

6. **Be conservative**: Only extract what's actually there
"""

    def _calculate_missing_fields(
        self,
        data: Dict[str, Any],
        confidence: Dict[str, float]
    ) -> List[str]:
        """Calculate which required fields are still missing."""
        missing = []

        req = data.get("requirements", {})

        # Check required fields
        if not req.get("job_title") or confidence.get("job_title", 0) < 0.3:
            missing.append("job_title")

        if not req.get("location_type") or confidence.get("location", 0) < 0.3:
            missing.append("location_type")

        if req.get("experience_min_years") is None or confidence.get("experience", 0) < 0.3:
            missing.append("experience_min_years")

        if req.get("salary_min") is None or confidence.get("compensation", 0) < 0.3:
            missing.append("compensation")

        if req.get("visa_sponsorship") is None or confidence.get("visa", 0) < 0.3:
            missing.append("visa_sponsorship")

        if req.get("equity_offered") is None or confidence.get("equity", 0) < 0.3:
            missing.append("equity")

        # Check traits
        traits = data.get("traits", [])
        if len(traits) == 0 or confidence.get("traits", 0) < 0.3:
            missing.append("traits")

        # Check interview stages
        stages = data.get("interview_stages", [])
        if len(stages) == 0 or confidence.get("interview_stages", 0) < 0.3:
            missing.append("interview_stages")

        return missing

    def build_job_profile_from_extraction(
        self,
        extracted_data: Dict[str, Any],
        confidence_scores: Dict[str, float],
        existing_profile: JobProfile
    ) -> JobProfile:
        """
        Merge extracted data into an existing job profile.

        Args:
            extracted_data: Data from extract()
            confidence_scores: Confidence scores from extract()
            existing_profile: Profile to update

        Returns:
            Updated JobProfile
        """
        req_data = extracted_data.get("requirements", {})
        traits_data = extracted_data.get("traits", [])
        stages_data = extracted_data.get("interview_stages", [])
        outreach_data = extracted_data.get("outreach", {})

        # Update requirements
        if req_data:
            existing_req = existing_profile.requirements

            if req_data.get("job_title"):
                existing_req.job_title = req_data["job_title"]
            if req_data.get("location_type"):
                try:
                    existing_req.location_type = LocationType(req_data["location_type"])
                except ValueError:
                    pass
            if req_data.get("location_city"):
                existing_req.location_city = req_data["location_city"]
            if req_data.get("onsite_days_per_week") is not None:
                existing_req.onsite_days_per_week = req_data["onsite_days_per_week"]
            if req_data.get("timezone_requirements"):
                existing_req.timezone_requirements = req_data["timezone_requirements"]
            if req_data.get("visa_sponsorship") is not None:
                existing_req.visa_sponsorship = req_data["visa_sponsorship"]
            if req_data.get("experience_min_years") is not None:
                existing_req.experience_min_years = req_data["experience_min_years"]
            if req_data.get("experience_max_years") is not None:
                existing_req.experience_max_years = req_data["experience_max_years"]
            if req_data.get("salary_min") is not None:
                existing_req.salary_min = req_data["salary_min"]
            if req_data.get("salary_max") is not None:
                existing_req.salary_max = req_data["salary_max"]
            if req_data.get("equity_offered") is not None:
                existing_req.equity_offered = req_data["equity_offered"]
            if req_data.get("equity_range"):
                existing_req.equity_range = req_data["equity_range"]

            existing_profile.requirements = existing_req

        # Add traits
        for trait_data in traits_data:
            if trait_data.get("name") and trait_data.get("description"):
                trait = CandidateTrait(
                    id=str(uuid.uuid4()),
                    name=trait_data["name"],
                    description=trait_data["description"],
                    priority=TraitPriority(trait_data.get("priority", "must_have")),
                    signals=trait_data.get("signals", []),
                    anti_signals=trait_data.get("anti_signals", []),
                )
                existing_profile.traits.append(trait)

        # Add interview stages
        for i, stage_data in enumerate(stages_data):
            if stage_data.get("name") and stage_data.get("description"):
                stage = InterviewStage(
                    id=str(uuid.uuid4()),
                    name=stage_data["name"],
                    description=stage_data["description"],
                    order=stage_data.get("order", i + 1),
                    duration_minutes=stage_data.get("duration_minutes"),
                    interviewer_role=stage_data.get("interviewer_role"),
                    actions=stage_data.get("actions", []),
                )
                existing_profile.interview_stages.append(stage)

        # Update outreach
        if outreach_data:
            if outreach_data.get("key_hook"):
                existing_profile.outreach.key_hook = outreach_data["key_hook"]
            if outreach_data.get("selling_points"):
                existing_profile.outreach.selling_points = outreach_data["selling_points"]

        # Update field confidence
        for field, conf in confidence_scores.items():
            existing_profile.field_confidence.append(
                FieldConfidence(
                    field_name=field,
                    confidence=conf,
                    source=ExtractionSource.JD_PASTE,
                    needs_confirmation=conf < 0.7
                )
            )

        # Update extraction source
        if existing_profile.extraction_source == ExtractionSource.CONVERSATION:
            existing_profile.extraction_source = ExtractionSource.JD_PASTE
        else:
            existing_profile.extraction_source = ExtractionSource.MIXED

        # Recalculate completion
        existing_profile.update_completion_status()

        return existing_profile


# Global instance
jd_extractor = JDExtractor()


# ============================================================================
# Streamlined Flow Extraction Functions
# ============================================================================

STREAMLINED_EXTRACTION_PROMPT = """You are an expert HR analyst. Extract structured information from the following job description.

Job Description:
{job_description}

Extract the following information in JSON format:
{{
    "years_experience": "e.g., '3-5 years' or '5+ years' or null if not specified",
    "education": "e.g., 'Bachelor's in Computer Science' or null",
    "required_skills": ["list", "of", "required", "skills"],
    "preferred_skills": ["list", "of", "nice-to-have", "skills"],
    "certifications": ["any", "required", "certifications"],
    "location": "e.g., 'San Francisco, CA' or 'Remote' or null",
    "work_type": "one of: 'remote', 'hybrid', 'onsite', or null",
    "salary_range": "e.g., '$120k-$150k' or null"
}}

Be precise and only include information explicitly stated or strongly implied in the JD.
Return ONLY valid JSON, no other text.
"""


async def extract_requirements_for_streamlined(
    raw_description: str
) -> Dict[str, Any]:
    """
    Extract structured requirements from job description for streamlined flow.

    Args:
        raw_description: The raw job description text

    Returns:
        Dict with extracted requirements
    """
    from models.streamlined.job import ExtractedRequirements

    if not raw_description or len(raw_description.strip()) < 50:
        logger.warning("Job description too short for extraction")
        return {}

    if not OPENROUTER_API_KEY:
        logger.warning("OpenRouter API key not configured")
        return {}

    prompt = STREAMLINED_EXTRACTION_PROMPT.format(
        job_description=raw_description[:5000]
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                    "max_tokens": 1000,
                }
            )
            response.raise_for_status()
            result = response.json()

        content = result["choices"][0]["message"]["content"]

        # Clean the response
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        data = json.loads(content)
        return data

    except Exception as e:
        logger.error(f"Error extracting requirements: {e}")
        return {}


def extract_requirements_for_streamlined_sync(
    raw_description: str
) -> Dict[str, Any]:
    """
    Synchronous version of extract_requirements_for_streamlined.
    """
    import asyncio

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(
        extract_requirements_for_streamlined(raw_description)
    )


async def trigger_jd_extraction_for_job(job_id: str, raw_description: str):
    """
    Trigger async JD extraction and update job.
    This runs in the background after job creation.
    """
    from repositories.streamlined.job_repo import JobRepository
    from models.streamlined.job import JobUpdate, ExtractedRequirements

    repo = JobRepository()

    try:
        # Extract requirements
        data = await extract_requirements_for_streamlined(raw_description)

        if data:
            requirements = ExtractedRequirements(**data)

            # Update job with extracted data
            await repo.update(job_id, JobUpdate(
                extracted_requirements=requirements
            ))

            logger.info(f"Successfully extracted requirements for job {job_id}")
        else:
            logger.warning(f"No requirements extracted for job {job_id}")

    except Exception as e:
        logger.error(f"Failed to extract requirements for job {job_id}: {e}")
