"""
Vapi Interview Router.

Handles candidate-facing voice interviews using Vapi.ai.
"""
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging
import json
import os

from services.vapi_service import vapi_service
from services.interviewer_persona import generate_interviewer_prompt
from services.vapi_interview_assistant import get_or_create_interview_assistant, update_assistant_server_url
from repositories.interview_repository import InterviewRepository
from repositories.candidate_repository import CandidateRepository
from repositories.streamlined.job_repo import JobRepository
from repositories.analytics_repository import AnalyticsRepository

# Import config for LLM model
from config import LLM_MODEL

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vapi-interview", tags=["vapi-interview"])

interview_repo = InterviewRepository()
candidate_repo = CandidateRepository()
job_repo = JobRepository()
analytics_repo = AnalyticsRepository()

class InitInterviewResponse(BaseModel):
    call_config: Dict[str, Any]
    candidate_name: str
    job_title: str

@router.post("/{interview_id}/init", response_model=InitInterviewResponse)
async def init_interview(interview_id: str):
    """
    Initialize a Vapi interview session.
    Generates the dynamic system prompt and returns the Vapi config.
    
    interview_id can be either:
    - A UUID (direct interview ID)
    - An access token (tok_xxx format from email link)
    """
    # 1. Fetch Interview Details (try token first, then UUID)
    if interview_id.startswith("tok_"):
        interview = interview_repo.get_by_access_token(interview_id)
    else:
        interview = interview_repo.get_by_id(interview_id)
        
    if not interview:
        raise HTTPException(404, "Interview not found")
        
    if interview.get("status") == "completed":
        raise HTTPException(400, "Interview already completed")

    candidate_id = interview["candidate_id"]
    candidate = candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    # 2. Fetch Job Details (we need the job description)
    # First check interview record, then candidate record
    job_id = interview.get("job_posting_id") or candidate.get("job_id")
    if not job_id:
        raise HTTPException(500, "Interview/Candidate record missing Job ID")

    job = job_repo.get_by_id_sync(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    # 3. Generate System Prompt
    # Extract resume text (if stored in candidate record or separate)
    # For now, we'll try to get it from fields like 'resume_text' or 'bio'
    resume_text = candidate.get("resume_text") or candidate.get("bio_summary") or candidate.get("notes") or "No resume text available."
    
    # Get screening questions if they exist in the candidate record (from screening result)
    screening_questions = []
    if candidate.get("screening_notes"):
        try:
            notes = json.loads(candidate.get("screening_notes"))
            screening_questions = notes.get("interview_questions", [])
        except:
            pass

    system_prompt = generate_interviewer_prompt(
        candidate_name=candidate.get("name", "Candidate"),
        job_title=job.title,
        company_name="Hirely", # TODO: Get from organization profile
        job_description=job.raw_description or "Standard role.",
        resume_text=resume_text,
        screening_questions=screening_questions
    )

    # 4. Get or Create dedicated Interview Assistant
    # This creates a separate assistant from the job profile builder, specifically for interviews
    webhook_url = os.environ.get("VAPI_WEBHOOK_URL", "https://sustentacular-giada-chunkily.ngrok-free.dev") + "/api/vapi-interview/webhook"
    interview_assistant_id = await get_or_create_interview_assistant(server_url=webhook_url)
    
    if not interview_assistant_id:
        raise HTTPException(500, "Failed to get/create interview assistant")
    
    # 5. INJECT Resume + JD into the assistant's system prompt
    # This is the key step that makes each interview personalized
    from services.vapi_interview_assistant import update_interview_assistant_prompt
    
    first_message = f"Hi {candidate.get('name', 'there')}! I'm Alex, and I'll be conducting your screening interview for the {job.title} role today. It's great to meet you! Before we dive in, could you give me a quick 60-second overview of your background?"
    
    prompt_updated = await update_interview_assistant_prompt(
        assistant_id=interview_assistant_id,
        system_prompt=system_prompt,
        first_message=first_message
    )
    
    if not prompt_updated:
        logger.warning("Failed to update assistant prompt - interview will use default prompt")
    
    # 6. Return config for frontend
    # The frontend only needs the assistantId and optional variableValues
    call_config = {
        "assistantId": interview_assistant_id,
        "sessionId": interview_id,
        "assistantOverrides": {
            "variableValues": {
                "candidate_name": candidate.get("name", "Candidate"),
                "job_title": job.title,
            }
        }
    }

    return InitInterviewResponse(
        call_config=call_config,
        candidate_name=candidate.get("name", "Candidate"),
        job_title=job.title
    )


@router.post("/webhook")
async def vapi_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Handle Vapi webhooks (call.ended, etc.)
    """
    try:
        body = await request.json()
        message_type = body.get("message", {}).get("type")
        
        if message_type == "end-of-call-report":
            call = body.get("message", {}).get("call", {})
            analysis = body.get("message", {}).get("analysis", {})
            artifact = body.get("message", {}).get("artifact", {})
            
            # Extract interview_id from metadata or variable values
            # The structure from Vapi shows 'assistantOverrides' at the top level of the call object
            metadata = call.get("metadata") or call.get("assistantOverrides", {}).get("metadata") or call.get("assistant", {}).get("metadata") or {}
            interview_id = metadata.get("interview_id")
            
            # Fallback: Check variableValues in assistantOverrides
            if not interview_id:
                variable_values = call.get("assistantOverrides", {}).get("variableValues") or call.get("assistant", {}).get("variableValues") or {}
                interview_id = variable_values.get("interview_id")
            
            if not interview_id:
                logger.warning(f"Vapi webhook received without interview_id in metadata or variables. Call ID: {call.get('id')}")
                # Log full call object for debugging - using ERROR to ensure it shows in console
                logger.error(f"Full call object: {json.dumps(call, default=str)}")
                return {"status": "ignored", "reason": "no_interview_id"}
            
            # Resolve access token to UUID if needed
            if interview_id.startswith("tok_"):
                logger.info(f"Resolving access token {interview_id} to interview ID...")
                interview = interview_repo.get_by_access_token(interview_id)
                if interview:
                    interview_id = interview["id"]
                    logger.info(f"Resolved to interview UUID: {interview_id}")
                else:
                    logger.error(f"Failed to find interview for token: {interview_id}")
                    return {"status": "ignored", "reason": "invalid_token"}
            
            # Parsing transcript
            transcript = artifact.get("transcript", "")
            
            logger.info(f"Received Vapi call report for interview {interview_id}. Transcript length: {len(transcript)}")
            
            if transcript:
                # Save transcript via AnalyticsRepository
                # We need to format it as "turns" if possible, or just raw text
                # Vapi transcript is usually a string, capturing turns? Or we might get 'messages' in the artifact.
                # Let's check if 'messages' exists which is more structured
                messages = artifact.get("messages", [])
                
                turns_data = []
                questions_asked = []
                for msg in messages:
                    role = msg.get("role")
                    content = msg.get("message") or msg.get("content")
                    if role and content:
                        speaker = "interviewer" if role == "assistant" else "candidate"
                        turns_data.append({
                            "speaker": speaker,
                            "text": content,
                            "timestamp": msg.get("time", 0) / 1000.0 # Vapi might use ms
                        })
                        # Collect questions asked by the interviewer
                        if role == "assistant" and "?" in content:
                            questions_asked.append(content)
                
                # If we have structured turns, save them
                if turns_data:
                    # Create or update transcript
                    analytics_repo.create_transcript(interview_id, turns_data, transcript)
                    
                    # Mark interview as complete if not already
                    interview_repo.complete_interview(interview_id)
                    
                    # Trigger analytics generation in background
                    background_tasks.add_task(
                        _generate_interview_analytics,
                        interview_id,
                        transcript,
                        questions_asked
                    )
                    
                    logger.info(f"Transcript saved for interview {interview_id}. Analytics task queued.")
                else:
                    logger.warning(f"No structured messages found for interview {interview_id}")

    except Exception as e:
        logger.error(f"Error processing Vapi webhook: {e}")
        return {"status": "error", "message": str(e)}
        
    return {"status": "ok"}


async def _generate_interview_analytics(interview_id: str, transcript: str, questions: list[str]):
    """
    Background task to generate interview analytics using InterviewerAnalyzer.
    """
    from services.interviewer_analyzer import get_interviewer_analyzer
    
    try:
        analyzer = get_interviewer_analyzer()
        result = await analyzer.analyze_interview(
            transcript=transcript,
            questions=questions,
            interviewer_id="vapi_ai_interviewer"  # Mark as AI-conducted
        )
        
        # Save analytics to database
        analytics_repo.save_analytics(interview_id, result.model_dump())
        logger.info(f"Analytics generated for interview {interview_id}. Overall score: {result.overall_score}")
        
    except Exception as e:
        logger.error(f"Failed to generate analytics for interview {interview_id}: {e}")

