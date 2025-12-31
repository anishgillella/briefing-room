"""
Analytics Generator Service - Generates job-specific analytics from interview transcripts.

Phase 6 Implementation:
- Uses full job context (scoring criteria, red flags, competencies) for evaluation
- Generates competency scores, strengths, concerns, and recommendations
- Uses Gemini 2.5 Flash via OpenRouter
"""
import httpx
import json
import logging
import re
from typing import Dict, Any, Optional, List
from uuid import UUID

from config import OPENROUTER_API_KEY, LLM_MODEL
from models.streamlined.job import Job, ScoringCriteria
from models.streamlined.candidate import Candidate
from models.streamlined.interview import Interview
from models.streamlined.analytics import (
    Analytics, AnalyticsCreate, CompetencyScore, Recommendation
)
from repositories.streamlined.analytics_repo import AnalyticsRepository
from repositories.streamlined.interview_repo import InterviewRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from repositories.streamlined.job_repo import JobRepository

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Default competencies if job doesn't have specific ones
DEFAULT_COMPETENCIES = [
    "Technical Knowledge",
    "Problem Solving",
    "Communication",
    "Teamwork",
    "Leadership Potential",
    "Cultural Fit",
]


def build_analytics_prompt(
    transcript: str,
    job: Job,
    candidate: Candidate,
) -> str:
    """Build the prompt for analytics generation."""

    # Get competencies from job or use defaults
    competencies = []
    if job.scoring_criteria:
        if job.scoring_criteria.technical_competencies:
            competencies.extend(job.scoring_criteria.technical_competencies)
        if job.scoring_criteria.cultural_fit_traits:
            competencies.extend(job.scoring_criteria.cultural_fit_traits)
    if not competencies:
        competencies = DEFAULT_COMPETENCIES

    # Get must-haves and red flags
    must_haves = []
    if job.scoring_criteria:
        must_haves = job.scoring_criteria.must_haves or []

    red_flags = job.red_flags or []

    # Get weights
    weight_technical = 0.5
    weight_experience = 0.3
    weight_cultural = 0.2
    if job.scoring_criteria:
        weight_technical = job.scoring_criteria.weight_technical or 0.5
        weight_experience = job.scoring_criteria.weight_experience or 0.3
        weight_cultural = job.scoring_criteria.weight_cultural or 0.2

    # Build candidate context
    candidate_name = candidate.person_name or "Candidate"
    candidate_skills = ", ".join(candidate.skills[:10]) if candidate.skills else "Not provided"
    candidate_bio = candidate.bio_summary or "Not provided"

    # Build job context
    job_description = job.raw_description[:2000] if job.raw_description else "Not provided"

    prompt = f"""You are an expert interviewer and talent evaluator. Analyze this interview transcript and provide a detailed assessment.

## JOB CONTEXT
Title: {job.title}
Description: {job_description}

## CANDIDATE CONTEXT
Name: {candidate_name}
Background: {candidate_bio}
Skills: {candidate_skills}

## INTERVIEW TRANSCRIPT
{transcript or "No transcript available"}

---

## YOUR ANALYSIS TASK

Evaluate the candidate against these specific criteria:

### COMPETENCIES TO EVALUATE
{json.dumps(competencies, indent=2)}

### MUST-HAVES (Critical Requirements)
{json.dumps(must_haves, indent=2) if must_haves else "None specified"}

### RED FLAGS TO WATCH FOR
{json.dumps(red_flags, indent=2) if red_flags else "None specified"}

### SCORING WEIGHTS
- Technical/Skills: {weight_technical * 100}%
- Experience: {weight_experience * 100}%
- Cultural Fit: {weight_cultural * 100}%

---

## OUTPUT FORMAT

Return a JSON object with this exact structure:

{{
    "competency_scores": [
        {{
            "name": "Competency Name",
            "score": 85,
            "evidence": ["Quote from transcript showing this", "Another relevant quote"],
            "notes": "Brief analysis of their performance in this area"
        }}
    ],
    "must_have_assessment": [
        {{
            "requirement": "Must-have requirement",
            "demonstrated": true,
            "evidence": "How they demonstrated it"
        }}
    ],
    "red_flags_detected": [
        {{
            "flag": "Red flag description",
            "evidence": "Quote or observation from transcript"
        }}
    ],
    "strengths": [
        "Key strength 1",
        "Key strength 2",
        "Key strength 3"
    ],
    "concerns": [
        "Concern or area for improvement 1",
        "Concern or area for improvement 2"
    ],
    "overall_score": 78,
    "recommendation": "hire",
    "recommendation_reasoning": "1-2 sentence explanation",
    "summary": "2-3 sentence overall summary of the candidate"
}}

SCORING GUIDELINES:
- 90-100: Exceptional, exceeded expectations
- 80-89: Strong, fully meets requirements
- 70-79: Good, meets most requirements
- 60-69: Adequate, some gaps
- 50-59: Below average, significant gaps
- Below 50: Does not meet requirements

RECOMMENDATION OPTIONS:
- "strong_hire": Score 85+, no red flags, all must-haves demonstrated
- "hire": Score 70+, no critical red flags
- "maybe": Score 50-69, minor concerns worth discussing
- "no_hire": Score below 50, or critical red flags, or missing must-haves

Return ONLY the JSON object, no other text."""

    return prompt


async def call_llm_for_analytics(prompt: str, model: str = None) -> str:
    """Call OpenRouter LLM for analytics generation."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OpenRouter API key not configured")

    use_model = model or LLM_MODEL

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://briefingroom.ai",
        "X-Title": "Briefing Room Analytics",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            OPENROUTER_URL,
            headers=headers,
            json={
                "model": use_model,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,  # Low temperature for analysis
                "max_tokens": 4000,
            }
        )
        response.raise_for_status()
        result = response.json()

    return result["choices"][0]["message"]["content"]


def call_llm_for_analytics_sync(prompt: str, model: str = None) -> str:
    """Synchronous version of call_llm_for_analytics."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OpenRouter API key not configured")

    use_model = model or LLM_MODEL

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://briefingroom.ai",
        "X-Title": "Briefing Room Analytics",
    }

    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            OPENROUTER_URL,
            headers=headers,
            json={
                "model": use_model,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
                "max_tokens": 4000,
            }
        )
        response.raise_for_status()
        result = response.json()

    return result["choices"][0]["message"]["content"]


def parse_analytics_response(response: str) -> Dict[str, Any]:
    """Parse the LLM response into analytics data."""
    # Try direct JSON parse
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass

    # Try to extract JSON from response
    json_match = re.search(r'\{[\s\S]*\}', response)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError("Failed to parse analytics response as JSON")


async def generate_analytics(interview_id: UUID) -> Analytics:
    """
    Generate analytics for a completed interview.

    This is the main entry point for analytics generation.
    """
    interview_repo = InterviewRepository()
    candidate_repo = CandidateRepository()
    job_repo = JobRepository()
    analytics_repo = AnalyticsRepository()

    # Load interview
    interview = await interview_repo.get_by_id(interview_id)
    if not interview:
        raise ValueError(f"Interview {interview_id} not found")

    # Load candidate
    candidate = await candidate_repo.get_by_id(interview.candidate_id)
    if not candidate:
        raise ValueError(f"Candidate {interview.candidate_id} not found")

    # Load job
    job = await job_repo.get_by_id(candidate.job_id)
    if not job:
        raise ValueError(f"Job {candidate.job_id} not found")

    # Build prompt and call LLM
    prompt = build_analytics_prompt(
        transcript=interview.transcript or "",
        job=job,
        candidate=candidate,
    )

    response = await call_llm_for_analytics(prompt)
    data = parse_analytics_response(response)

    # Transform competency scores
    competency_scores = [
        CompetencyScore(
            name=cs["name"],
            score=cs["score"],
            evidence=cs.get("evidence", []),
            notes=cs.get("notes"),
        )
        for cs in data.get("competency_scores", [])
    ]

    # Extract red flags as simple list
    red_flags_detected = [
        rf["flag"] for rf in data.get("red_flags_detected", [])
    ]

    # Map recommendation string to enum
    rec_str = data.get("recommendation", "maybe")
    recommendation = _map_recommendation_string(rec_str)

    # Create analytics record
    analytics = await analytics_repo.create(AnalyticsCreate(
        interview_id=interview_id,
        overall_score=data.get("overall_score", 0),
        competency_scores=competency_scores,
        strengths=data.get("strengths", []),
        concerns=data.get("concerns", []),
        red_flags_detected=red_flags_detected,
        recommendation=recommendation,
        summary=data.get("summary", ""),
    ))

    # Store raw response and metadata
    await analytics_repo.update(analytics.id, {
        "raw_ai_response": data,
        "recommendation_reasoning": data.get("recommendation_reasoning"),
        "model_used": LLM_MODEL,
    })

    logger.info(f"Generated analytics for interview {interview_id}: score={data.get('overall_score')}, rec={rec_str}")

    return analytics


def generate_analytics_sync(interview_id: UUID) -> Analytics:
    """
    Synchronous version of generate_analytics.
    """
    interview_repo = InterviewRepository()
    candidate_repo = CandidateRepository()
    job_repo = JobRepository()
    analytics_repo = AnalyticsRepository()

    # Load interview
    interview = interview_repo.get_by_id_sync(interview_id)
    if not interview:
        raise ValueError(f"Interview {interview_id} not found")

    # Load candidate
    candidate = candidate_repo.get_by_id_sync(interview.candidate_id)
    if not candidate:
        raise ValueError(f"Candidate {interview.candidate_id} not found")

    # Load job
    job = job_repo.get_by_id_sync(candidate.job_id)
    if not job:
        raise ValueError(f"Job {candidate.job_id} not found")

    # Build prompt and call LLM
    prompt = build_analytics_prompt(
        transcript=interview.transcript or "",
        job=job,
        candidate=candidate,
    )

    response = call_llm_for_analytics_sync(prompt)
    data = parse_analytics_response(response)

    # Transform competency scores
    competency_scores = [
        CompetencyScore(
            name=cs["name"],
            score=cs["score"],
            evidence=cs.get("evidence", []),
            notes=cs.get("notes"),
        )
        for cs in data.get("competency_scores", [])
    ]

    # Extract red flags as simple list
    red_flags_detected = [
        rf["flag"] for rf in data.get("red_flags_detected", [])
    ]

    # Map recommendation string to enum
    rec_str = data.get("recommendation", "maybe")
    recommendation = _map_recommendation_string(rec_str)

    # Create analytics record
    analytics = analytics_repo.create_sync(AnalyticsCreate(
        interview_id=interview_id,
        overall_score=data.get("overall_score", 0),
        competency_scores=competency_scores,
        strengths=data.get("strengths", []),
        concerns=data.get("concerns", []),
        red_flags_detected=red_flags_detected,
        recommendation=recommendation,
        summary=data.get("summary", ""),
    ))

    # Store raw response and metadata
    analytics_repo.update_sync(analytics.id, {
        "raw_ai_response": data,
        "recommendation_reasoning": data.get("recommendation_reasoning"),
        "model_used": LLM_MODEL,
    })

    logger.info(f"Generated analytics for interview {interview_id}: score={data.get('overall_score')}, rec={rec_str}")

    return analytics


def _map_recommendation_string(rec_str: str) -> Recommendation:
    """Map recommendation string from LLM to enum."""
    rec_map = {
        "strong_hire": Recommendation.STRONG_HIRE,
        "hire": Recommendation.HIRE,
        "maybe": Recommendation.MAYBE,
        "no_hire": Recommendation.NO_HIRE,
    }
    return rec_map.get(rec_str.lower(), Recommendation.MAYBE)


async def generate_analytics_async(interview_id: UUID):
    """
    Async wrapper for analytics generation (for background tasks).
    """
    try:
        await generate_analytics(interview_id)
    except Exception as e:
        logger.error(f"Failed to generate analytics for interview {interview_id}: {e}")
        # Could add error tracking/notification here


def generate_analytics_background(interview_id: str):
    """
    Synchronous wrapper for background task execution.
    Uses sync version to avoid event loop issues in background tasks.
    """
    try:
        generate_analytics_sync(UUID(interview_id))
    except Exception as e:
        logger.error(f"Failed to generate analytics for interview {interview_id}: {e}")
