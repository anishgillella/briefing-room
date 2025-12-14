"""
Analytics router for post-interview analysis using Gemini 2.5 Flash
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import json
import logging

from config import OPENROUTER_API_KEY, GEMINI_ANALYTICS_MODEL
from models.analytics import InterviewAnalytics, QuestionAnswer, QuestionMetrics, OverallMetrics

# Database repositories for saving analytics
from repositories.interview_repository import InterviewRepository
from repositories.analytics_repository import AnalyticsRepository
from repositories.interviewer_analytics_repository import get_interviewer_analytics_repository
from services.interviewer_analyzer import get_interviewer_analyzer

router = APIRouter(prefix="/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)

# Initialize repositories
interview_repo = InterviewRepository()
analytics_repo = AnalyticsRepository()
interviewer_analytics_repo = get_interviewer_analytics_repository()


class AnalyticsRequest(BaseModel):
    transcript: str
    job_description: Optional[str] = None
    resume: Optional[str] = None


ANALYTICS_SYSTEM_PROMPT = """You are an expert interview analyst. Your task is to analyze an interview transcript and provide structured metrics.

Given:
- Job Description (if provided): Expectations for the role
- Candidate Resume (if provided): Their background and experience
- Interview Transcript: The conversation between interviewer and candidate

Your analysis should:
1. Extract ALL question-answer pairs from the transcript
2. Classify each question as: technical, behavioral, situational, or other
3. Score each answer (0-10) on:
   - Relevance: Did they answer what was asked?
   - Clarity: Was the response structured and easy to follow?
   - Depth: Surface-level vs thorough exploration?
   - Type-specific metric:
     * For behavioral: "STAR Adherence" (Situation-Task-Action-Result)
     * For technical: "Technical Accuracy"
     * For situational: "Problem-Solving"
     * For other: "Completeness"
4. Calculate overall metrics
5. Identify red flags (concerns) and highlights (standout moments)
6. Provide a hiring recommendation with confidence level

Be fair but rigorous. Excellent answers get 9-10, good answers 7-8, average 5-6, below average 3-4, poor 1-2."""


ANALYTICS_USER_PROMPT = """Please analyze this interview:

{context}

## Interview Transcript:
{transcript}

Respond with a JSON object matching this exact structure:
{{
  "qa_pairs": [
    {{
      "question": "The question asked",
      "answer": "Summary of candidate's response (max 200 words)",
      "question_type": "technical|behavioral|situational|other",
      "metrics": {{
        "relevance": 0-10,
        "clarity": 0-10,
        "depth": 0-10,
        "type_specific_metric": 0-10,
        "type_specific_label": "STAR Adherence|Technical Accuracy|Problem-Solving|Completeness"
      }},
      "highlight": "Notable quote or null if not standout"
    }}
  ],
  "overall": {{
    "overall_score": 0-100,
    "communication_score": 0.0-10.0,
    "technical_score": 0.0-10.0,
    "cultural_fit_score": 0.0-10.0,
    "total_questions": number,
    "avg_response_length": number (words),
    "red_flags": ["concern 1", "concern 2"],
    "highlights": ["strength 1", "strength 2"],
    "recommendation": "Strong Hire|Hire|Leaning Hire|Leaning No Hire|No Hire",
    "recommendation_reasoning": "1-2 sentence explanation of WHY this recommendation was given, citing specific evidence from the interview",
    "confidence": 0-100
  }},
  "highlights": {{
    "best_answer": {{
      "quote": "Direct quote from their best response",
      "context": "Why this answer was strong"
    }},
    "red_flag": {{
      "quote": "Concerning quote if any, or null",
      "context": "Why this is a concern"
    }},
    "quotable_moment": "A memorable quote that captures the candidate's personality/values",
    "areas_to_probe": ["Topic 1 needing follow-up", "Topic 2"]
  }}
}}

Return ONLY valid JSON, no markdown code blocks or additional text."""

MAX_RETRIES = 2  # Number of retries on validation errors


def normalize_analytics_data(data: dict) -> dict:
    """
    Normalize LLM output to handle common issues like null fields inside objects
    """
    if "highlights" in data and data["highlights"]:
        highlights = data["highlights"]
        
        # Handle red_flag with null inner fields - convert to None
        if "red_flag" in highlights and highlights["red_flag"]:
            rf = highlights["red_flag"]
            if isinstance(rf, dict) and (rf.get("quote") is None or rf.get("context") is None):
                # LLM returned object with null fields - treat as no red flag
                highlights["red_flag"] = None
        
        # Ensure quotable_moment is a string
        if highlights.get("quotable_moment") is None:
            highlights["quotable_moment"] = ""
        
        # Ensure areas_to_probe is a list
        if highlights.get("areas_to_probe") is None:
            highlights["areas_to_probe"] = []
    
    return data


@router.post("/{room_name}")
async def get_interview_analytics(room_name: str, request: AnalyticsRequest) -> InterviewAnalytics:
    """
    Analyze an interview transcript and return structured metrics.
    Includes retry logic for validation errors.
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured")
    
    if not request.transcript or len(request.transcript.strip()) < 50:
        raise HTTPException(status_code=400, detail="Transcript is too short for analysis")
    
    # Build context from optional inputs
    context_parts = []
    if request.job_description:
        context_parts.append(f"## Job Description:\n{request.job_description}")
    if request.resume:
        context_parts.append(f"## Candidate Resume/Background:\n{request.resume}")
    
    context = "\n\n".join(context_parts) if context_parts else "No additional context provided."
    
    user_prompt = ANALYTICS_USER_PROMPT.format(
        context=context,
        transcript=request.transcript
    )
    
    last_error = None
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "Briefing Room Analytics"
                    },
                    json={
                        "model": GEMINI_ANALYTICS_MODEL,
                        "messages": [
                            {"role": "system", "content": ANALYTICS_SYSTEM_PROMPT},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.3 + (attempt * 0.1),  # Slightly increase temp on retry
                        "response_format": {"type": "json_object"}
                    }
                )
                
                if response.status_code != 200:
                    error_text = response.text
                    print(f"[Analytics] OpenRouter error: {response.status_code} - {error_text}")
                    raise HTTPException(status_code=500, detail=f"Analytics API error: {response.status_code}")
                
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                
                # Parse and validate with Pydantic
                try:
                    analytics_data = json.loads(content)
                    
                    # Normalize data to handle common LLM output issues
                    analytics_data = normalize_analytics_data(analytics_data)
                    
                    analytics = InterviewAnalytics(**analytics_data)
                    print(f"[Analytics] Successfully analyzed {analytics.overall.total_questions} Q&A pairs (attempt {attempt + 1})")
                    
                    # Save to database if this room is linked to an interview
                    try:
                        interview = interview_repo.get_by_room_name(room_name)
                        if interview:
                            # Prepare analytics for DB
                            db_analytics = {
                                "interview_id": interview["id"],
                                "overall_score": analytics.overall.overall_score,
                                "recommendation": analytics.overall.recommendation,
                                "synthesis": analytics.overall.recommendation_reasoning,
                                "question_analytics": [qa.model_dump() for qa in analytics.qa_pairs],
                                "skill_evidence": [],
                                "behavioral_profile": {},
                                "topics_to_probe": analytics.highlights.areas_to_probe if analytics.highlights else [],
                            }
                            
                            # Save or update analytics
                            existing = analytics_repo.get_analytics_by_interview(interview["id"])
                            if existing:
                                analytics_repo.update_analytics(interview["id"], db_analytics)
                                logger.info(f"[Analytics] Updated DB for interview {interview['id'][:8]}...")
                            else:
                                analytics_repo.create_analytics(db_analytics)
                                logger.info(f"[Analytics] Saved to DB for interview {interview['id'][:8]}...")
                            
                            # Save questions to questions_asked table
                            question_data = [
                                {
                                    "question": qa.question,
                                    "topic": qa.question_type,
                                    "quality_score": int((qa.metrics.relevance + qa.metrics.clarity + qa.metrics.depth) / 3 * 10)
                                }
                                for qa in analytics.qa_pairs
                            ]
                            analytics_repo.bulk_add_questions(interview["id"], question_data)
                        
                            # ===== INTERVIEWER ANALYTICS =====
                            # Trigger interviewer analytics if interviewer is assigned
                            interviewer_id = interview.get("interviewer_id")
                            if interviewer_id:
                                try:
                                    logger.info(f"[Analytics] Generating interviewer analytics for {interviewer_id[:8]}...")
                                    analyzer = get_interviewer_analyzer()
                                    
                                    # Extract questions for the analyzer
                                    questions_list = [qa.question for qa in analytics.qa_pairs]
                                    
                                    # Analyze interviewer performance
                                    interviewer_result = await analyzer.analyze_interview(
                                        transcript=request.transcript,
                                        questions=questions_list
                                    )
                                    
                                    # Save to interviewer_analytics table
                                    interviewer_analytics_repo.save_analytics(
                                        interview_id=interview["id"],
                                        interviewer_id=interviewer_id,
                                        analytics=interviewer_result
                                    )
                                    logger.info(f"[Analytics] Interviewer analytics saved. Score: {interviewer_result.overall_score}")
                                except Exception as int_err:
                                    logger.warning(f"[Analytics] Interviewer analytics failed (non-critical): {int_err}")
                            else:
                                logger.info(f"[Analytics] No interviewer assigned - skipping interviewer analytics")
                        else:
                            logger.info(f"[Analytics] Room {room_name} not linked to DB interview - skipping DB save")
                    except Exception as db_err:
                        # Don't fail the request if DB save fails
                        logger.warning(f"[Analytics] DB save failed (non-critical): {db_err}")
                    
                    return analytics
                    
                except json.JSONDecodeError as e:
                    print(f"[Analytics] JSON parse error (attempt {attempt + 1}): {e}")
                    print(f"[Analytics] Raw content: {content[:500]}")
                    last_error = f"Failed to parse analytics response: {str(e)}"
                    if attempt < MAX_RETRIES:
                        continue  # Retry
                    raise HTTPException(status_code=500, detail=last_error)
                    
                except Exception as e:
                    print(f"[Analytics] Validation error (attempt {attempt + 1}): {e}")
                    last_error = f"Analytics validation error: {str(e)}"
                    if attempt < MAX_RETRIES:
                        print(f"[Analytics] Retrying... ({attempt + 2}/{MAX_RETRIES + 1})")
                        continue  # Retry with different temperature
                    raise HTTPException(status_code=500, detail=last_error)
                    
        except httpx.TimeoutException:
            last_error = "Analytics request timed out"
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=504, detail=last_error)
        except HTTPException:
            raise
        except Exception as e:
            print(f"[Analytics] Unexpected error (attempt {attempt + 1}): {type(e).__name__}: {str(e)}")
            last_error = f"Analytics failed: {str(e)}"
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=500, detail=last_error)
    
    # Should not reach here, but just in case
    raise HTTPException(status_code=500, detail=last_error or "Analytics failed after retries")

