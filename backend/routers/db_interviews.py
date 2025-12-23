"""
Interview router - Database-backed multi-stage interview management.
Provides:
- Start next interview (auto-stage selection)
- Get interview history
- Accept/Reject decisions
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ValidationError
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
from repositories.interviewer_analytics_repository import get_interviewer_analytics_repository

# Services
from services.transcript_parser import get_transcript_parser, ParsedTranscript
from services.interviewer_analyzer import get_interviewer_analyzer
from models.analytics import StandoutMoment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interviews", tags=["interviews"])

# Initialize repositories
candidate_repo = CandidateRepository()
interview_repo = InterviewRepository()
analytics_repo = AnalyticsRepository()
interviewer_analytics_repo = get_interviewer_analytics_repository()


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


@router.get("/{interview_id}/full-analytics")
async def get_full_interview_analytics(interview_id: str):
    """
    Get full analytics for a specific interview.
    Returns the complete analytics data including all new fields:
    - red_flags, highlights, role_competencies, cultural_fit, enthusiasm
    This is used to display the same post-interview UI in Interview History.
    """
    interview = interview_repo.get_by_id(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Get full analytics using the new method
    full_analytics = analytics_repo.get_full_analytics(interview_id)

    if not full_analytics:
        # Try to get basic analytics as fallback
        basic_analytics = analytics_repo.get_analytics_by_interview(interview_id)
        if basic_analytics:
            # Return whatever we have
            return {
                "interview_id": interview_id,
                "stage": interview.get("stage"),
                "status": interview.get("status"),
                "candidate_id": interview.get("candidate_id"),
                "analytics": basic_analytics,
                "has_full_analytics": False
            }
        raise HTTPException(status_code=404, detail="No analytics found for this interview")

    # Get interviewer analytics if available
    interviewer_analytics = None
    try:
        interviewer_analytics = interviewer_analytics_repo.get_by_interview(interview_id)
    except Exception as e:
        logger.warning(f"Failed to get interviewer analytics: {e}")

    return {
        "interview_id": interview_id,
        "stage": interview.get("stage"),
        "status": interview.get("status"),
        "candidate_id": interview.get("candidate_id"),
        "started_at": interview.get("started_at"),
        "ended_at": interview.get("ended_at"),
        "analytics": full_analytics,
        "interviewer_analytics": interviewer_analytics,
        "has_full_analytics": True
    }


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
    interviewer_id: Optional[str] = None  # ID of interviewer for analytics
    interviewer_name: Optional[str] = None  # Name of interviewer for analytics


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

    # Update interview with interviewer info if provided
    update_data = {}
    if request.interviewer_id:
        update_data["interviewer_id"] = request.interviewer_id
    if request.interviewer_name:
        update_data["interviewer_name"] = request.interviewer_name

    if update_data:
        interview_repo.update(interview_id, update_data)
        logger.info(f"Set interviewer info: id={request.interviewer_id}, name={request.interviewer_name}")

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


# ============================================================================
# Smart Transcript Parsing & Analytics Generation
# ============================================================================

class SmartParseRequest(BaseModel):
    """Request for smart transcript parsing."""
    raw_transcript: str
    candidate_name: Optional[str] = None
    interviewer_name: Optional[str] = None


class SmartParseResponse(BaseModel):
    """Response from smart transcript parsing."""
    turns: list
    interviewer_name: Optional[str] = None
    candidate_name: Optional[str] = None
    total_turns: int
    interviewer_turns: int
    candidate_turns: int
    questions_count: int
    parsing_notes: Optional[str] = None


@router.post("/smart-parse")
async def smart_parse_transcript(request: SmartParseRequest) -> SmartParseResponse:
    """
    Use Gemini 2.5 Flash to intelligently parse raw transcript text
    into structured conversation turns.
    """
    try:
        parser = get_transcript_parser()
        result = await parser.parse_transcript(
            raw_transcript=request.raw_transcript,
            candidate_name=request.candidate_name,
            interviewer_name=request.interviewer_name
        )

        return SmartParseResponse(
            turns=[{
                "speaker": t.speaker,
                "speaker_name": t.speaker_name,
                "text": t.cleaned_text or t.text,
                "is_question": t.is_question
            } for t in result.turns],
            interviewer_name=result.interviewer_name,
            candidate_name=result.candidate_name,
            total_turns=result.total_turns,
            interviewer_turns=result.interviewer_turns,
            candidate_turns=result.candidate_turns,
            questions_count=result.questions_count,
            parsing_notes=result.parsing_notes
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Smart parse error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse transcript: {str(e)}")


class GenerateAnalyticsRequest(BaseModel):
    """Request to generate analytics from a pasted transcript."""
    interview_id: str
    interviewer_id: Optional[str] = None
    job_description: Optional[str] = None
    candidate_resume: Optional[str] = None


class AnalyticsResultResponse(BaseModel):
    """Response with both candidate and interviewer analytics."""
    candidate_analytics: Optional[dict] = None
    interviewer_analytics: Optional[dict] = None
    status: str
    message: str


@router.post("/{interview_id}/generate-analytics")
async def generate_transcript_analytics(
    interview_id: str,
    request: GenerateAnalyticsRequest
) -> AnalyticsResultResponse:
    """
    Generate both candidate and interviewer analytics from a saved transcript.
    This uses the existing analytics generation logic.
    """
    import httpx
    from config import OPENROUTER_API_KEY, GEMINI_ANALYTICS_MODEL

    # Get the interview
    interview = interview_repo.get_by_id(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Get the transcript
    transcript_record = analytics_repo.get_transcript_by_interview(interview_id)
    if not transcript_record:
        raise HTTPException(status_code=404, detail="No transcript found for this interview. Please save a transcript first.")

    # Build transcript text from turns
    turns = transcript_record.get("turns", [])
    if not turns:
        raise HTTPException(status_code=400, detail="Transcript has no conversation turns")

    transcript_text = "\n".join([
        f"{t.get('speaker', 'Unknown').title()}: {t.get('text', '')}"
        for t in turns
    ])

    # Get candidate info
    candidate = candidate_repo.get_by_id(interview.get("candidate_id"))
    candidate_name = candidate.get("name", "Unknown") if candidate else "Unknown"

    # Build context for analytics
    context_parts = []
    if request.job_description:
        context_parts.append(f"## Job Description:\n{request.job_description}")
    if request.candidate_resume:
        context_parts.append(f"## Candidate Resume:\n{request.candidate_resume}")
    context = "\n\n".join(context_parts)

    # =====================
    # Generate Candidate Analytics using comprehensive prompt
    # =====================
    ANALYTICS_SYSTEM_PROMPT = """You are a world-class talent assessment specialist with expertise in behavioral psychology, competency-based interviewing, and predictive hiring analytics. Your analysis will directly influence hiring decisions worth hundreds of thousands of dollars.

Your task: Perform an exhaustive, forensic-level analysis of this interview transcript. Be specific, cite direct quotes, and provide actionable intelligence.

Key principles:
- Extract EVERY meaningful data point from the transcript
- Support all assessments with evidence from the transcript
- Be calibrated: 9-10 = exceptional (top 5%), 7-8 = strong (top 25%), 5-6 = average, 3-4 = below average, 1-2 = poor
- Identify both surface-level and subtle signals
- Consider what the candidate DIDN'T say as much as what they did say"""

    ANALYTICS_USER_PROMPT = f"""## Context
{context}

## Interview Transcript
{transcript_text}

## Your Mission
Perform a comprehensive candidate assessment. Analyze every response for explicit AND implicit signals.

Return a JSON object with this exact structure:

{{
  "qa_pairs": [
    {{
      "question": "The exact question asked",
      "answer": "Comprehensive summary of candidate's response",
      "question_type": "technical|behavioral|situational|other",
      "metrics": {{
        "relevance": <0-10>,
        "clarity": <0-10>,
        "depth": <0-10>,
        "type_specific_metric": <0-10>,
        "type_specific_label": "STAR Adherence|Technical Accuracy|Problem-Solving|Completeness"
      }},
      "star_breakdown": {{
        "situation": <0-10 or null if not behavioral>,
        "task": <0-10 or null>,
        "action": <0-10 or null>,
        "result": <0-10 or null>
      }},
      "highlight": "Notable quote or null",
      "concern": "Any concern with this answer or null",
      "follow_up_needed": "What should be asked next to clarify, or null"
    }}
  ],

  "overall": {{
    "overall_score": <0-100>,
    "communication_score": <0.0-10.0>,
    "technical_score": <0.0-10.0>,
    "cultural_fit_score": <0.0-10.0>,
    "problem_solving_score": <0.0-10.0>,
    "leadership_potential": <0.0-10.0>,
    "total_questions": <number>,
    "avg_response_length": <number>,
    "red_flags": ["specific concern with evidence"],
    "highlights": ["specific strength with evidence"],
    "recommendation": "Strong Hire|Hire|Leaning Hire|Leaning No Hire|No Hire",
    "recommendation_reasoning": "2-3 sentence explanation with specific evidence",
    "confidence": <0-100>
  }},

  "communication_profile": {{
    "articulation_score": <0-100>,
    "conciseness_score": <0-100>,
    "structure_score": <0-100>,
    "vocabulary_level": "basic|intermediate|advanced|expert",
    "filler_word_frequency": "none|low|moderate|high",
    "confidence_indicators": "low|moderate|high|very_high",
    "active_listening_signals": ["examples of building on interviewer questions"],
    "communication_style": "analytical|driver|expressive|amiable"
  }},

  "competency_evidence": [
    {{
      "competency": "Name of skill/competency",
      "evidence_strength": "none|weak|moderate|strong|exceptional",
      "evidence_quotes": ["direct quote 1", "direct quote 2"],
      "assessment": "Brief assessment of this competency"
    }}
  ],

  "behavioral_profile": {{
    "work_style": "independent|collaborative|flexible",
    "decision_making": "analytical|intuitive|consultative|directive",
    "conflict_approach": "avoiding|accommodating|competing|collaborating|compromising",
    "stress_indicators": ["any signs of stress or discomfort"],
    "authenticity_score": <0-100>,
    "self_awareness_score": <0-100>,
    "growth_mindset_indicators": ["evidence of growth mindset"]
  }},

  "risk_assessment": {{
    "flight_risk": "low|medium|high",
    "flight_risk_evidence": ["reasons for assessment"],
    "performance_risk": "low|medium|high",
    "performance_risk_evidence": ["reasons for assessment"],
    "culture_fit_risk": "low|medium|high",
    "culture_fit_evidence": ["reasons for assessment"],
    "verification_needed": ["claims that should be verified"]
  }},

  "response_patterns": {{
    "avg_response_time_feel": "quick|measured|slow",
    "consistency_across_topics": <0-100>,
    "depth_variation": "consistent|varies_by_topic|inconsistent",
    "strongest_topic_area": "area where candidate performed best",
    "weakest_topic_area": "area where candidate struggled",
    "evasive_moments": ["topics where candidate seemed to deflect"]
  }},

  "highlights": {{
    "best_answer": {{
      "question": "The question that got the best answer",
      "quote": "Direct quote from their best response",
      "why_impressive": "Why this answer stood out"
    }},
    "worst_answer": {{
      "question": "The question with weakest answer",
      "issue": "What was wrong with the answer",
      "impact": "How this affects assessment"
    }},
    "quotable_moments": ["memorable quotes"],
    "unexpected_strengths": ["strengths that weren't expected"],
    "areas_to_probe": ["topics needing deeper exploration in next round"],
    "standout_moments": [
      {{
        "question": "Question that prompted the standout answer",
        "quote": "Verbatim transcript quote (do not paraphrase)",
        "why": "Why this moment stands out"
      }}
    ]
  }},

  "executive_summary": {{
    "one_liner": "One sentence candidate summary for busy executives",
    "three_strengths": ["strength 1", "strength 2", "strength 3"],
    "three_concerns": ["concern 1", "concern 2", "concern 3"],
    "ideal_role_fit": "What role/team would be ideal for this candidate",
    "development_areas": ["areas where candidate would need coaching"],
    "comparison_to_bar": "How does this candidate compare to your ideal hire: below|meets|exceeds"
  }}
}}

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no explanatory text."""

    candidate_analytics = None
    interviewer_analytics = None

    try:
        # Call OpenRouter for candidate analytics
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://superposition.ai",
                    "X-Title": "Superposition Interview Analytics"
                },
                json={
                    "model": GEMINI_ANALYTICS_MODEL,
                    "messages": [
                        {"role": "system", "content": ANALYTICS_SYSTEM_PROMPT},
                        {"role": "user", "content": ANALYTICS_USER_PROMPT}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 8000,
                    "response_format": {"type": "json_object"}
                }
            )

            if response.status_code == 200:
                result = response.json()
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

                # Handle markdown-wrapped JSON
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]

                candidate_analytics = json.loads(content.strip())

                highlights_data = candidate_analytics.get("highlights")
                if isinstance(highlights_data, dict):
                    standout_raw = highlights_data.get("standout_moments", [])
                    if isinstance(standout_raw, list):
                        validated_standouts = []
                        for item in standout_raw[:3]:
                            if not isinstance(item, dict):
                                continue
                            try:
                                validated_standouts.append(StandoutMoment(**item).model_dump())
                            except ValidationError:
                                continue
                        highlights_data["standout_moments"] = validated_standouts

                # Save to database
                analytics_repo.save_analytics(interview_id, candidate_analytics)
                logger.info(f"Saved candidate analytics for interview {interview_id}")
            else:
                logger.error(f"OpenRouter error: {response.status_code} - {response.text}")

    except Exception as e:
        logger.error(f"Error generating candidate analytics: {e}")

    # =====================
    # Generate Interviewer Analytics
    # =====================
    interviewer_id = request.interviewer_id or interview.get("interviewer_id")

    if interviewer_id:
        try:
            analyzer = get_interviewer_analyzer()

            # Extract questions from transcript
            questions = [t.get("text", "") for t in turns if t.get("speaker") == "interviewer"]

            result = await analyzer.analyze_interview(
                transcript=transcript_text,
                questions=questions,
                interviewer_id=interviewer_id
            )

            if result:
                # Convert to dict for response
                interviewer_analytics = result.model_dump()

                # Save to database
                interviewer_analytics_repo.save_analytics(
                    interview_id=interview_id,
                    interviewer_id=interviewer_id,
                    analytics=result
                )
                logger.info(f"Saved interviewer analytics for interview {interview_id}")

        except Exception as e:
            logger.error(f"Error generating interviewer analytics: {e}")

    # Determine overall status
    if candidate_analytics and interviewer_analytics:
        status = "complete"
        message = "Generated both candidate and interviewer analytics"
    elif candidate_analytics:
        status = "partial"
        message = "Generated candidate analytics only (no interviewer selected)"
    elif interviewer_analytics:
        status = "partial"
        message = "Generated interviewer analytics only (candidate analytics failed)"
    else:
        status = "failed"
        message = "Failed to generate analytics"

    return AnalyticsResultResponse(
        candidate_analytics=candidate_analytics,
        interviewer_analytics=interviewer_analytics,
        status=status,
        message=message
    )


# ============================================================================
# Regenerate Interviewer Analytics for Existing Interview
# ============================================================================

class RegenerateInterviewerAnalyticsRequest(BaseModel):
    interviewer_id: Optional[str] = None  # Optional - will use stored interviewer_id if not provided


@router.post("/{interview_id}/regenerate-interviewer-analytics")
async def regenerate_interviewer_analytics(
    interview_id: str,
    request: RegenerateInterviewerAnalyticsRequest = None
):
    """
    Regenerate interviewer analytics for an existing interview.
    Uses the interviewer_id already stored on the interview.
    Optionally accepts a new interviewer_id to override.
    """
    # Get the interview
    interview = interview_repo.get_by_id(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Determine which interviewer_id to use
    interviewer_id = (request.interviewer_id if request and request.interviewer_id
                      else interview.get("interviewer_id"))

    if not interviewer_id:
        raise HTTPException(
            status_code=400,
            detail="No interviewer_id found. Please provide an interviewer_id or ensure the interview has one stored."
        )

    # Get the transcript
    turns = interview.get("transcript_turns") or []
    if not turns:
        raise HTTPException(status_code=400, detail="Interview has no transcript")

    # Build transcript text
    transcript_text = "\n".join([
        f"{t.get('speaker', 'unknown').title()}: {t.get('text', '')}"
        for t in turns
    ])

    # Update the interview with the interviewer_id if it's new/different
    if interviewer_id != interview.get("interviewer_id"):
        interview_repo.update(interview_id, {"interviewer_id": interviewer_id})

    # Generate interviewer analytics
    interviewer_analytics = None
    try:
        analyzer = get_interviewer_analyzer()

        # Extract questions from transcript
        questions = [t.get("text", "") for t in turns if t.get("speaker") == "interviewer"]

        result = await analyzer.analyze_interview(
            transcript=transcript_text,
            questions=questions,
            interviewer_id=interviewer_id
        )

        if result:
            interviewer_analytics = result.model_dump()

            # Save to database
            interviewer_analytics_repo.save_analytics(
                interview_id=interview_id,
                interviewer_id=interviewer_id,
                analytics=result
            )
            logger.info(f"Regenerated interviewer analytics for interview {interview_id}")

    except Exception as e:
        logger.error(f"Error regenerating interviewer analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate analytics: {str(e)}")

    if interviewer_analytics:
        return {
            "status": "success",
            "message": "Interviewer analytics regenerated successfully",
            "interviewer_analytics": interviewer_analytics
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to generate interviewer analytics")


# ============================================================================
# Candidate Analytics (All Rounds + Cumulative)
# ============================================================================

@router.get("/candidate/{candidate_id}/all-analytics")
async def get_all_candidate_analytics(candidate_id: str):
    """
    Get all analytics for a candidate across all interview rounds,
    plus cumulative/aggregated analytics.
    """
    # Get all interviews for this candidate
    interviews = interview_repo.get_candidate_interviews(candidate_id)

    if not interviews:
        return {
            "candidate_id": candidate_id,
            "rounds": [],
            "cumulative": None,
            "message": "No interviews found"
        }

    rounds = []
    all_scores = []
    all_communication_scores = []
    all_technical_scores = []
    all_cultural_fit_scores = []
    all_qa_pairs = []
    all_highlights = []
    all_red_flags = []
    recommendations = []
    interviewer_analytics_list = []

    for interview in interviews:
        interview_id = interview.get("id")
        stage = interview.get("stage", "unknown")

        # Get candidate analytics for this interview
        # First check if analytics came with the join (analytics is an array from the join)
        joined_analytics = interview.get("analytics")
        if isinstance(joined_analytics, list) and joined_analytics:
            candidate_analytics = joined_analytics[0]  # Take first analytics record
        else:
            # Fallback to separate query
            candidate_analytics = analytics_repo.get_analytics_by_interview(interview_id)

        # Get interviewer analytics for this interview
        interviewer_analytics = None
        interviewer_id = interview.get("interviewer_id")
        if interviewer_id:
            interviewer_analytics = interviewer_analytics_repo.get_by_interview(interview_id)

        round_data = {
            "interview_id": interview_id,
            "stage": stage,
            "status": interview.get("status", "unknown"),
            "interviewer_name": interview.get("interviewer_name"),
            "interviewer_id": interviewer_id,
            "created_at": interview.get("created_at"),
            "candidate_analytics": None,
            "interviewer_analytics": None,
        }

        if candidate_analytics:
            # Parse analytics from various possible structures:
            # 1. Direct schema columns (overall_score, recommendation, synthesis, behavioral_profile, etc.)
            # 2. topics_to_probe containing full analytics data (new format backup)
            # 3. Legacy nested formats

            # Extract direct schema fields first
            overall_score = candidate_analytics.get("overall_score")
            recommendation = candidate_analytics.get("recommendation")
            synthesis = candidate_analytics.get("synthesis", "")
            behavioral_profile = candidate_analytics.get("behavioral_profile", {}) or {}
            question_analytics = candidate_analytics.get("question_analytics", []) or []
            skill_evidence = candidate_analytics.get("skill_evidence", []) or []
            communication_metrics = candidate_analytics.get("communication_metrics", {}) or {}
            topics_to_probe_raw = candidate_analytics.get("topics_to_probe")

            # Check if topics_to_probe contains full analytics (backup storage)
            if isinstance(topics_to_probe_raw, dict) and "overall" in topics_to_probe_raw:
                # Use the backup full analytics
                full_analytics = topics_to_probe_raw
                overall_data = full_analytics.get("overall", {})
                overall_score = overall_score or overall_data.get("overall_score")
                recommendation = recommendation or overall_data.get("recommendation")
                synthesis = synthesis or overall_data.get("recommendation_reasoning", "")

                # Get scores from overall if not in behavioral_profile
                if not behavioral_profile.get("communication_score"):
                    behavioral_profile["communication_score"] = overall_data.get("communication_score", 0)
                if not behavioral_profile.get("technical_score"):
                    behavioral_profile["technical_score"] = overall_data.get("technical_score", 0)
                if not behavioral_profile.get("cultural_fit_score"):
                    behavioral_profile["cultural_fit_score"] = overall_data.get("cultural_fit_score", 0)
                if not behavioral_profile.get("confidence"):
                    behavioral_profile["confidence"] = overall_data.get("confidence", 0)
                if not behavioral_profile.get("red_flags"):
                    behavioral_profile["red_flags"] = overall_data.get("red_flags", [])
                if not behavioral_profile.get("highlights"):
                    behavioral_profile["highlights"] = overall_data.get("highlights", [])

                # Get Q&A pairs from full analytics
                if not question_analytics:
                    question_analytics = full_analytics.get("qa_pairs", [])

                # Get highlights/best_answer from full analytics
                highlights_data = full_analytics.get("highlights", {})
                if isinstance(highlights_data, dict):
                    communication_metrics = communication_metrics or highlights_data

            # Extract scores from behavioral_profile
            communication_score = behavioral_profile.get("communication_score", 0) or 0
            technical_score = behavioral_profile.get("technical_score", 0) or 0
            cultural_fit_score = behavioral_profile.get("cultural_fit_score", 0) or 0
            confidence = behavioral_profile.get("confidence", 0) or 0
            red_flags = behavioral_profile.get("red_flags", []) or []
            highlights_list = behavioral_profile.get("highlights", []) or []

            # Build the candidate analytics response
            round_data["candidate_analytics"] = {
                "overall_score": overall_score or 0,
                "communication_score": communication_score,
                "technical_score": technical_score,
                "cultural_fit_score": cultural_fit_score,
                "recommendation": recommendation or "N/A",
                "recommendation_reasoning": synthesis,
                "confidence": confidence,
                "red_flags": red_flags if isinstance(red_flags, list) else [],
                "highlights": highlights_list if isinstance(highlights_list, list) else [],
                "total_questions": len(question_analytics) if question_analytics else 0,
                "qa_pairs": question_analytics[:10] if question_analytics else [],  # Include top 10 Q&As
                "best_answer": communication_metrics.get("best_answer") if isinstance(communication_metrics, dict) else None,
                "quotable_moment": communication_metrics.get("quotable_moment") if isinstance(communication_metrics, dict) else None,
                "standout_moments": communication_metrics.get("standout_moments") if isinstance(communication_metrics, dict) else None,
            }

            # Collect for cumulative
            if overall_score:
                all_scores.append(overall_score)
            if communication_score:
                all_communication_scores.append(communication_score)
            if technical_score:
                all_technical_scores.append(technical_score)
            if cultural_fit_score:
                all_cultural_fit_scores.append(cultural_fit_score)
            if question_analytics:
                all_qa_pairs.extend(question_analytics)
            if highlights_list:
                all_highlights.extend(highlights_list)
            if red_flags:
                all_red_flags.extend(red_flags)
            if recommendation:
                recommendations.append(recommendation)

        if interviewer_analytics:
            int_data = interviewer_analytics if isinstance(interviewer_analytics, dict) else interviewer_analytics.model_dump() if hasattr(interviewer_analytics, 'model_dump') else {}
            round_data["interviewer_analytics"] = {
                "overall_score": int_data.get("overall_score", 0),
                "question_quality_score": int_data.get("question_quality_score", 0),
                "topic_coverage_score": int_data.get("topic_coverage_score", 0),
                "consistency_score": int_data.get("consistency_score", 0),
                "bias_score": int_data.get("bias_score", 0),
                "candidate_experience_score": int_data.get("candidate_experience_score", 0),
                "improvement_suggestions": int_data.get("improvement_suggestions", []) or [],
                "summary_line": int_data.get("summary", "") or int_data.get("summary_line", ""),
                # Detailed breakdowns
                "question_quality_breakdown": int_data.get("question_quality_breakdown"),
                "topics_covered": int_data.get("topics_covered"),
                "bias_indicators": int_data.get("bias_indicators"),
            }
            interviewer_analytics_list.append(int_data)

        rounds.append(round_data)

    # Calculate cumulative analytics
    cumulative = None
    if all_scores:
        # Determine overall recommendation
        rec_scores = {
            "Strong Hire": 5,
            "Hire": 4,
            "Leaning Hire": 3,
            "Leaning No Hire": 2,
            "No Hire": 1
        }
        avg_rec_score = sum(rec_scores.get(r, 3) for r in recommendations) / len(recommendations) if recommendations else 3

        if avg_rec_score >= 4.5:
            final_recommendation = "Strong Hire"
        elif avg_rec_score >= 3.5:
            final_recommendation = "Hire"
        elif avg_rec_score >= 2.5:
            final_recommendation = "Leaning Hire"
        elif avg_rec_score >= 1.5:
            final_recommendation = "Leaning No Hire"
        else:
            final_recommendation = "No Hire"

        cumulative = {
            "total_rounds": len(rounds),
            "rounds_with_analytics": len(all_scores),
            "avg_overall_score": round(sum(all_scores) / len(all_scores), 1),
            "avg_communication_score": round(sum(all_communication_scores) / len(all_communication_scores), 1) if all_communication_scores else 0,
            "avg_technical_score": round(sum(all_technical_scores) / len(all_technical_scores), 1) if all_technical_scores else 0,
            "avg_cultural_fit_score": round(sum(all_cultural_fit_scores) / len(all_cultural_fit_scores), 1) if all_cultural_fit_scores else 0,
            "final_recommendation": final_recommendation,
            "all_recommendations": recommendations,
            "total_questions_asked": len(all_qa_pairs),
            "key_highlights": list(set(all_highlights))[:5],  # Unique highlights, max 5
            "key_red_flags": list(set(all_red_flags))[:5],    # Unique red flags, max 5
            "score_trend": all_scores,  # For charting
        }

        # Add cumulative interviewer analytics if available
        if interviewer_analytics_list:
            cumulative["avg_interviewer_score"] = round(
                sum(i.get("overall_score", 0) for i in interviewer_analytics_list) / len(interviewer_analytics_list), 1
            )
            cumulative["avg_question_quality"] = round(
                sum(i.get("question_quality_score", 0) for i in interviewer_analytics_list) / len(interviewer_analytics_list), 1
            )

    return {
        "candidate_id": candidate_id,
        "rounds": rounds,
        "cumulative": cumulative,
        "message": f"Found {len(rounds)} interview rounds"
    }
