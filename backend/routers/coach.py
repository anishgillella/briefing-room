"""
Coach Mode router for real-time interview suggestions after each Q&A exchange
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import json

from config import OPENROUTER_API_KEY, GEMINI_ANALYTICS_MODEL
from models.analytics import CoachSuggestion

router = APIRouter(prefix="/coach", tags=["coach"])


class CoachRequest(BaseModel):
    last_exchange: str  # The most recent Q&A exchange (Interviewer: X, Candidate: Y)
    full_transcript: str  # Full transcript so far for context
    elapsed_minutes: int
    briefing_context: Optional[str] = None  # Job description, resume summary


COACH_SYSTEM_PROMPT = """You are an expert interview coach helping an interviewer in real-time.
You just received the latest Q&A exchange. Analyze the candidate's answer and suggest the next question.

Your goal is to:
1. Assess how well the candidate answered the last question
2. Suggest a specific, actionable next question
3. Recommend whether to stay on the current topic or move to a new area
4. Be concise and practical

Consider:
- What topics haven't been covered yet (technical, behavioral, cultural fit, leadership)
- Whether the candidate's answer was vague and needs deeper probing
- Time management - make sure key areas are covered
- Connection to the job requirements"""


COACH_USER_PROMPT = """## Interview Context:
{briefing_context}

## Full Transcript So Far:
{full_transcript}

## Latest Exchange (just completed):
{last_exchange}

## Time Elapsed: {elapsed_minutes} minutes

Based on the candidate's last answer, provide coaching guidance as JSON:
{{
  "last_question_type": "technical|behavioral|situational|other",
  "answer_quality": "strong|adequate|weak|unclear",
  "suggested_next_question": "The specific question to ask next",
  "reasoning": "Brief explanation of why this question (max 50 words)",
  "should_change_topic": true/false,
  "topic_suggestion": "If changing topic, what area to explore (or null)"
}}

Return ONLY valid JSON."""


@router.post("/suggest")
async def get_coach_suggestion(request: CoachRequest) -> CoachSuggestion:
    """
    Get a coaching suggestion based on the latest Q&A exchange
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured")
    
    if not request.last_exchange or len(request.last_exchange.strip()) < 20:
        # Return a default if no real exchange yet
        return CoachSuggestion(
            last_question_type="other",
            answer_quality="adequate",
            suggested_next_question="Start with an open-ended question about their background or experience.",
            reasoning="No exchange provided yet - recommend an opening question.",
            should_change_topic=False,
            topic_suggestion=None
        )
    
    user_prompt = COACH_USER_PROMPT.format(
        briefing_context=request.briefing_context or "No specific context provided",
        full_transcript=request.full_transcript[-2000:] if len(request.full_transcript) > 2000 else request.full_transcript,
        last_exchange=request.last_exchange,
        elapsed_minutes=request.elapsed_minutes
    )
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "Briefing Room Coach"
                },
                json={
                    "model": GEMINI_ANALYTICS_MODEL,
                    "messages": [
                        {"role": "system", "content": COACH_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.4,
                    "max_tokens": 300,
                    "response_format": {"type": "json_object"}
                }
            )
            
            if response.status_code != 200:
                print(f"[Coach] OpenRouter error: {response.status_code}")
                return CoachSuggestion(
                    last_question_type="other",
                    answer_quality="adequate",
                    suggested_next_question="Continue exploring the topic further.",
                    reasoning="API error - providing default suggestion.",
                    should_change_topic=False,
                    topic_suggestion=None
                )
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            try:
                suggestion_data = json.loads(content)
                return CoachSuggestion(**suggestion_data)
            except (json.JSONDecodeError, Exception) as e:
                print(f"[Coach] Parse error: {e}")
                return CoachSuggestion(
                    last_question_type="other",
                    answer_quality="adequate",
                    suggested_next_question="Tell me more about your experience with that.",
                    reasoning="Parse error - providing generic follow-up.",
                    should_change_topic=False,
                    topic_suggestion=None
                )
                
    except Exception as e:
        print(f"[Coach] Unexpected error: {e}")
        return CoachSuggestion(
            last_question_type="other",
            answer_quality="adequate",
            suggested_next_question="Can you elaborate on that point?",
            reasoning="Technical issue - providing safe follow-up.",
            should_change_topic=False,
            topic_suggestion=None
        )
