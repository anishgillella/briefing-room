"""
Resume Processor Service.

Extracts structured data from resume text using LLM.
Used during candidate CSV upload to populate bio_summary and skills.
"""

import httpx
import json
import logging
from typing import Dict, Any, Optional

from config import OPENROUTER_API_KEY, LLM_MODEL

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

RESUME_EXTRACTION_PROMPT = """You are an expert recruiter. Analyze this resume and extract key information.

Resume:
{resume_text}

Job Requirements (for context):
{job_requirements}

Extract the following in JSON format:
{{
    "bio_summary": "A 2-3 sentence professional summary of this candidate",
    "skills": ["list", "of", "key", "skills"],
    "years_experience": 5,
    "education": "Highest degree and institution",
    "strengths_for_role": ["specific", "strengths", "relevant", "to", "job"],
    "potential_concerns": ["any", "gaps", "or", "concerns"]
}}

Be concise and focus on information relevant to the job requirements.
Return ONLY valid JSON, no other text.
"""


async def extract_resume_data(
    resume_text: str,
    job_requirements: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Extract structured data from resume text.

    Args:
        resume_text: Raw resume text
        job_requirements: Optional ExtractedRequirements for context

    Returns:
        Dict with bio_summary, skills, years_experience, etc.
    """
    if not resume_text or len(resume_text.strip()) < 50:
        logger.warning("Resume text too short for extraction")
        return {}

    if not OPENROUTER_API_KEY:
        logger.warning("OpenRouter API key not configured")
        return {}

    # Format job requirements for context
    job_context = "Not specified"
    if job_requirements:
        parts = []
        if hasattr(job_requirements, 'required_skills') and job_requirements.required_skills:
            parts.append(f"Required Skills: {', '.join(job_requirements.required_skills)}")
        if hasattr(job_requirements, 'years_experience') and job_requirements.years_experience:
            parts.append(f"Experience: {job_requirements.years_experience}")
        if hasattr(job_requirements, 'preferred_skills') and job_requirements.preferred_skills:
            parts.append(f"Preferred Skills: {', '.join(job_requirements.preferred_skills)}")
        if parts:
            job_context = "\n".join(parts)

    prompt = RESUME_EXTRACTION_PROMPT.format(
        resume_text=resume_text[:5000],  # Limit resume length
        job_requirements=job_context
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

        # Ensure skills is a list
        if "skills" in data and not isinstance(data["skills"], list):
            data["skills"] = []

        return data

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error in resume extraction: {e}")
        return {}

    except httpx.TimeoutException:
        logger.error("Timeout during resume extraction")
        return {}

    except Exception as e:
        logger.error(f"Error extracting resume data: {e}")
        return {}


def extract_resume_data_sync(
    resume_text: str,
    job_requirements: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Synchronous version of extract_resume_data.
    """
    import asyncio

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(
        extract_resume_data(resume_text, job_requirements)
    )
