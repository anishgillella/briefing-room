"""
Interview router - Database-backed multi-stage interview management.
Provides:
- Start next interview (auto-stage selection)
- Get interview history
- Accept/Reject decisions
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import json
import logging
from datetime import datetime

# Repositories
from repositories.candidate_repository import CandidateRepository
from repositories.interview_repository import InterviewRepository
from repositories.analytics_repository import AnalyticsRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interviews", tags=["interviews"])

# Initialize repositories
candidate_repo = CandidateRepository()
interview_repo = InterviewRepository()
analytics_repo = AnalyticsRepository()


# ============================================================================
# Schemas
# ============================================================================

class StartInterviewResponse(BaseModel):
    """Response when starting an interview."""
    interview_id: str
    room_name: str
    room_url: str
    token: str
    stage: str
    candidate: dict


class InterviewSummary(BaseModel):
    """Summary of an interview with analytics."""
    id: str
    stage: str
    status: str
    started_at: Optional[str]
    ended_at: Optional[str]
    duration_sec: Optional[int]
    analytics: Optional[dict] = None


class CandidateInterviewsResponse(BaseModel):
    """Full interview history for a candidate."""
    candidate_id: str
    candidate_name: str
    pipeline_status: str
    stages_completed: int
    all_stages_complete: bool
    average_score: Optional[float]
    interviews: List[InterviewSummary]
    next_stage: Optional[str]


class DecisionRequest(BaseModel):
    """Request to submit Accept/Reject decision."""
    decision: str  # 'accepted' or 'rejected'
    notes: Optional[str] = None


class DecisionResponse(BaseModel):
    """Response after submitting decision."""
    status: str
    decision: str
    candidate_id: str


# ============================================================================
# Routes
# ============================================================================

@router.get("/lookup-by-name/{name}")
async def lookup_candidate_by_name(name: str):
    """
    Find a candidate's database UUID by their name.
    Bridges the gap between JSON simple IDs and database UUIDs.
    """
    candidate = candidate_repo.get_by_name(name)
    if not candidate:
        raise HTTPException(status_code=404, detail=f"Candidate '{name}' not found in database")
    return {
        "name": candidate["name"],
        "db_id": candidate["id"],
        "pipeline_status": candidate.get("pipeline_status", "new")
    }


@router.get("/candidate/{candidate_id}")
async def get_candidate_interviews(candidate_id: str) -> CandidateInterviewsResponse:
    """
    Get all interviews for a candidate with analytics.
    Shows progress through the 3-stage pipeline.
    
    Note: candidate_id should be a UUID from the database.
    Use /lookup-by-name/{name} to get the UUID from a candidate name.
    """
    candidate = candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    interviews = interview_repo.get_candidate_interviews(candidate_id)
    next_stage = interview_repo.get_next_stage(candidate_id)
    all_complete = interview_repo.all_stages_complete(candidate_id)
    
    # Calculate average score
    scores = []
    interview_summaries = []
    
    for interview in interviews:
        analytics = interview.get("analytics")
        score = None
        if analytics:
            if isinstance(analytics, list) and analytics:
                score = analytics[0].get("overall_score")
            elif isinstance(analytics, dict):
                score = analytics.get("overall_score")
        
        if score:
            scores.append(score)
        
        interview_summaries.append(InterviewSummary(
            id=interview["id"],
            stage=interview["stage"],
            status=interview["status"],
            started_at=interview.get("started_at"),
            ended_at=interview.get("ended_at"),
            duration_sec=interview.get("duration_sec"),
            analytics=analytics[0] if isinstance(analytics, list) and analytics else analytics
        ))
    
    return CandidateInterviewsResponse(
        candidate_id=candidate_id,
        candidate_name=candidate["name"],
        pipeline_status=candidate.get("pipeline_status", "new"),
        stages_completed=len([i for i in interviews if i["status"] == "completed"]),
        all_stages_complete=all_complete,
        average_score=sum(scores) / len(scores) if scores else None,
        interviews=interview_summaries,
        next_stage=next_stage
    )


@router.post("/candidate/{candidate_id}/start")
async def start_next_interview(candidate_id: str) -> StartInterviewResponse:
    """
    Start the next interview stage for a candidate.
    Auto-determines which stage is next (round_1 → round_2 → round_3).
    
    Returns room connection info for LiveKit.
    """
    candidate = candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Check if all stages are complete
    if interview_repo.all_stages_complete(candidate_id):
        raise HTTPException(
            status_code=400, 
            detail="All interview stages complete. Submit a decision instead."
        )
    
    # Create the next interview
    interview = interview_repo.start_next_interview(candidate_id)
    if not interview:
        raise HTTPException(status_code=500, detail="Failed to create interview")
    
    stage = interview["stage"]
    room_name = interview["room_name"]
    
    # Generate LiveKit token
    livekit_url = os.getenv("LIVEKIT_URL", "")
    livekit_api_key = os.getenv("LIVEKIT_API_KEY", "")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET", "")
    
    if livekit_url and livekit_api_key and livekit_api_secret:
        import jwt
        import time
        
        # Build room metadata
        room_metadata = {
            "candidate_id": candidate_id,
            "candidate_name": candidate["name"],
            "stage": stage,
            "mode": "interview",
        }
        
        now = int(time.time())
        claims = {
            "iss": livekit_api_key,
            "exp": now + 3600,
            "nbf": now,
            "sub": "interviewer",
            "name": "Interviewer",
            "video": {
                "room": room_name,
                "roomJoin": True,
                "canPublish": True,
                "canSubscribe": True,
                "canPublishData": True,
            },
            "metadata": json.dumps(room_metadata),
        }
        
        token = jwt.encode(claims, livekit_api_secret, algorithm="HS256")
        room_url = livekit_url
    else:
        # Fallback - no LiveKit configured
        token = ""
        room_url = ""
        logger.warning("LiveKit not configured. Interview room won't have voice AI.")
    
    # Update candidate pipeline status
    candidate_repo.update_pipeline_status(candidate_id, stage)
    
    # Mark interview as active
    interview_repo.start_interview(interview["id"])
    
    logger.info(f"Started {stage} interview for {candidate['name']} in room {room_name}")
    
    return StartInterviewResponse(
        interview_id=interview["id"],
        room_name=room_name,
        room_url=room_url,
        token=token,
        stage=stage,
        candidate=candidate
    )


@router.post("/candidate/{candidate_id}/decision")
async def submit_decision(
    candidate_id: str, 
    request: DecisionRequest
) -> DecisionResponse:
    """
    Submit final Accept/Reject decision for a candidate.
    Only allowed after all 3 interview stages are complete.
    """
    candidate = candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Validate all stages complete
    if not interview_repo.all_stages_complete(candidate_id):
        completed = len(interview_repo.get_completed_stages(candidate_id))
        raise HTTPException(
            status_code=400, 
            detail=f"Complete all 3 interview stages first. ({completed}/3 done)"
        )
    
    # Validate decision
    if request.decision not in ["accepted", "rejected"]:
        raise HTTPException(
            status_code=400, 
            detail="Decision must be 'accepted' or 'rejected'"
        )
    
    # Set decision
    result = candidate_repo.set_decision(candidate_id, request.decision, request.notes)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to save decision")
    
    logger.info(f"Decision submitted for {candidate['name']}: {request.decision}")
    
    return DecisionResponse(
        status="ok",
        decision=request.decision,
        candidate_id=candidate_id
    )


@router.post("/{interview_id}/complete")
async def complete_interview(interview_id: str):
    """
    Mark an interview as completed.
    Called when the interview session ends.
    """
    interview = interview_repo.get_by_id(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    result = interview_repo.complete_interview(interview_id)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to complete interview")
    
    # Update candidate pipeline status to decision_pending if all complete
    candidate_id = interview["candidate_id"]
    if interview_repo.all_stages_complete(candidate_id):
        candidate_repo.update_pipeline_status(candidate_id, "decision_pending")
    
    return {"status": "completed", "interview_id": interview_id}


@router.post("/{interview_id}/analytics")
async def save_interview_analytics(
    interview_id: str,
    analytics: dict
):
    """
    Save analytics for a completed interview.
    Called after AI analysis of the transcript.
    """
    interview = interview_repo.get_by_id(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Create or update analytics
    existing = analytics_repo.get_analytics_by_interview(interview_id)
    if existing:
        analytics_repo.update_analytics(interview_id, analytics)
    else:
        analytics["interview_id"] = interview_id
        analytics_repo.create_analytics(analytics)
    
    # Extract and save questions asked
    question_analytics = analytics.get("question_analytics", [])
    if question_analytics:
        analytics_repo.bulk_add_questions(interview_id, question_analytics)
    
    return {"status": "saved", "interview_id": interview_id}


@router.get("/{interview_id}/context")
async def get_interview_context(interview_id: str):
    """
    Get context for an interview (questions to avoid, topics to probe).
    Used by the AI agent to avoid redundant questions.
    """
    interview = interview_repo.get_by_id(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    context = interview_repo.get_interview_context(
        interview["candidate_id"],
        interview["stage"]
    )
    
    return context


# ============================================================================
# Database Candidates API (parallel to pluto routes)
# ============================================================================

@router.get("/db/candidates")
async def list_candidates_from_db(
    tier: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """
    List candidates from database (alternative to /pluto/candidates).
    This version uses Supabase instead of JSON files.
    """
    candidates = candidate_repo.get_all(
        limit=limit,
        offset=offset,
        tier=tier,
        status=status
    )
    
    total = candidate_repo.count(tier=tier, status=status)
    
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "candidates": candidates
    }


@router.get("/db/candidates/{candidate_id}")
async def get_candidate_from_db(candidate_id: str):
    """
    Get a single candidate from database.
    """
    candidate = candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


# ============================================================================
# Transcript Management
# ============================================================================

class TranscriptTurn(BaseModel):
    """A single turn in the conversation."""
    speaker: str  # "interviewer" or "candidate"
    text: str
    timestamp: Optional[float] = None


class PasteTranscriptRequest(BaseModel):
    """Request to paste/upload a transcript."""
    turns: List[TranscriptTurn]
    full_text: Optional[str] = None


class TranscriptResponse(BaseModel):
    """Response after saving transcript."""
    status: str
    interview_id: str
    turns_count: int
    transcript_id: Optional[str] = None


class CreateInterviewForTranscriptRequest(BaseModel):
    """Request to create an interview for transcript upload."""
    candidate_id: str
    stage: str  # "round_1", "round_2", or "round_3"


@router.post("/create-for-transcript")
async def create_interview_for_transcript(
    request: CreateInterviewForTranscriptRequest
):
    """
    Create an interview record for uploading an external transcript.
    Used when the interview was conducted outside the system.
    """
    # Validate candidate exists
    candidate = candidate_repo.get_by_id(request.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Validate stage
    valid_stages = ["round_1", "round_2", "round_3"]
    if request.stage not in valid_stages:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {valid_stages}")

    # Check if interview already exists for this stage
    existing_interviews = interview_repo.get_candidate_interviews(request.candidate_id)
    for interview in existing_interviews:
        if interview.get("stage") == request.stage:
            return {
                "status": "exists",
                "interview_id": interview["id"],
                "stage": request.stage,
                "message": "Interview already exists for this stage"
            }

    # Create new interview
    interview = interview_repo.create({
        "candidate_id": request.candidate_id,
        "stage": request.stage,
        "status": "scheduled",
        "interviewer_name": "External"
    })

    if not interview:
        raise HTTPException(status_code=500, detail="Failed to create interview")

    logger.info(f"Created interview for external transcript: {interview['id']} ({request.stage})")

    return {
        "status": "created",
        "interview_id": interview["id"],
        "stage": request.stage,
        "room_name": interview.get("room_name")
    }


@router.post("/{interview_id}/paste-transcript")
async def paste_transcript(
    interview_id: str,
    request: PasteTranscriptRequest
) -> TranscriptResponse:
    """
    Save a pasted/uploaded transcript for an interview.
    Used when the interview was conducted externally (Zoom, in-person, etc.)
    and the transcript needs to be imported.
    """
    # Validate interview exists
    interview = interview_repo.get_by_id(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Convert turns to dict format
    turns_data = [
        {
            "speaker": turn.speaker,
            "text": turn.text,
            "timestamp": turn.timestamp or i
        }
        for i, turn in enumerate(request.turns)
    ]

    # Build full text if not provided
    full_text = request.full_text or "\n".join([
        f"{t['speaker']}: {t['text']}" for t in turns_data
    ])

    # Check if transcript already exists
    existing = analytics_repo.get_transcript_by_interview(interview_id)

    if existing:
        # Update existing transcript
        result = analytics_repo.update_transcript(interview_id, turns_data)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to update transcript")
        transcript_id = existing.get("id")
    else:
        # Create new transcript
        result = analytics_repo.create_transcript(interview_id, turns_data, full_text)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save transcript")
        transcript_id = result.get("id")

    # Mark interview as completed if it was still scheduled/active
    if interview.get("status") in ["scheduled", "active"]:
        interview_repo.complete_interview(interview_id)

        # Update candidate pipeline status
        candidate_id = interview["candidate_id"]
        if interview_repo.all_stages_complete(candidate_id):
            candidate_repo.update_pipeline_status(candidate_id, "decision_pending")
        else:
            candidate_repo.update_pipeline_status(candidate_id, interview["stage"])

    logger.info(f"Transcript pasted for interview {interview_id}: {len(turns_data)} turns")

    return TranscriptResponse(
        status="saved",
        interview_id=interview_id,
        turns_count=len(turns_data),
        transcript_id=transcript_id
    )


@router.get("/{interview_id}/transcript")
async def get_transcript(interview_id: str):
    """
    Get the transcript for an interview.
    """
    interview = interview_repo.get_by_id(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    transcript = analytics_repo.get_transcript_by_interview(interview_id)
    if not transcript:
        return {"interview_id": interview_id, "transcript": None, "has_transcript": False}

    return {
        "interview_id": interview_id,
        "transcript": transcript,
        "has_transcript": True,
        "turns_count": len(transcript.get("turns", []))
    }
