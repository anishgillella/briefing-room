"""
Voice Ingest API router.
Handles job profile creation through voice onboarding flow.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List, Dict, Any
import uuid
import json
import time
import logging
import jwt

from config import LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, VAPI_API_KEY, VAPI_PUBLIC_KEY
from services.websocket_hub import ws_hub
from services.vapi_service import vapi_service
from models.voice_ingest import (
    JobProfile,
    CompanyIntelligence,
    HardRequirements,
    CandidateTrait,
    InterviewStage,
    NuanceCapture,
    OutreachConfig,
)
from models.voice_ingest.enums import ExtractionSource
from repositories import job_profile_repo
from services.research_pipeline import research_company
from services.jd_extractor import jd_extractor
from services.smart_questions import generate_gap_fill_questions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice-ingest", tags=["voice-ingest"])


# =============================================================================
# Request/Response Models
# =============================================================================

class StartSessionRequest(BaseModel):
    """Request to start a new onboarding session."""
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    company_name: str = Field(..., min_length=1, max_length=100)
    company_website: str = Field(..., min_length=5, max_length=200)


class StartSessionResponse(BaseModel):
    """Response after creating a session."""
    session_id: str
    status: str
    message: str


class CompanyIntelResponse(BaseModel):
    """Response for company intelligence status."""
    status: str  # "pending", "in_progress", "complete", "failed", "partial"
    company_intel: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class ProfileResponse(BaseModel):
    """Full job profile response."""
    profile: Dict[str, Any]
    completion_percentage: float
    missing_fields: List[str]


class UpdateRequirementsRequest(BaseModel):
    """Request to update job requirements."""
    job_title: Optional[str] = None
    location_type: Optional[str] = None
    location_city: Optional[str] = None
    onsite_days_per_week: Optional[int] = None
    visa_sponsorship: Optional[bool] = None
    experience_min_years: Optional[int] = None
    experience_max_years: Optional[int] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    equity_offered: Optional[bool] = None
    equity_range: Optional[str] = None


class CreateTraitRequest(BaseModel):
    """Request to create a candidate trait."""
    name: str = Field(..., min_length=2, max_length=100)
    description: str = Field(..., min_length=10, max_length=500)
    priority: str = "must_have"
    signals: List[str] = []


class CreateInterviewStageRequest(BaseModel):
    """Request to create an interview stage."""
    name: str = Field(..., min_length=2, max_length=100)
    description: str = Field(..., min_length=5, max_length=500)
    duration_minutes: Optional[int] = None
    interviewer_role: Optional[str] = None
    actions: List[str] = []


class UpdateOutreachRequest(BaseModel):
    """Request to update outreach configuration."""
    tone: Optional[str] = None
    key_hook: Optional[str] = None
    selling_points: Optional[List[str]] = None
    subject_line: Optional[str] = None
    email_body: Optional[str] = None


class ParseJDRequest(BaseModel):
    """Request to parse a job description."""
    jd_text: str = Field(..., min_length=50, max_length=50000)


class ParseJDResponse(BaseModel):
    """Response from JD parsing."""
    success: bool
    extracted: Dict[str, Any]
    confidence_scores: Dict[str, float]
    missing_required: List[str]
    missing_optional: List[str]
    suggested_questions: List[str]
    extraction_summary: str
    completion_percentage: float


class VoiceTokenResponse(BaseModel):
    """Response containing LiveKit token for voice session."""
    token: str
    livekit_url: str
    room_name: str
    session_id: str


class VapiCallResponse(BaseModel):
    """Response containing Vapi call configuration."""
    call_id: str
    web_call_url: Optional[str] = None
    vapi_public_key: str
    assistant_id: Optional[str] = None
    session_id: str
    error: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/start", response_model=StartSessionResponse)
async def start_session(
    request: StartSessionRequest,
    background_tasks: BackgroundTasks
):
    """
    Start a new voice ingest session.

    Creates a job profile and triggers company research in the background.
    The client should poll /company-intel to check research status.
    """
    session_id = str(uuid.uuid4())
    logger.info(f"Starting voice ingest session {session_id} for {request.company_name}")

    # Create initial job profile
    profile = JobProfile(
        id=session_id,
        recruiter_first_name=request.first_name,
        recruiter_last_name=request.last_name,
        company=CompanyIntelligence(
            name=request.company_name,
            website=request.company_website,
        ),
        requirements=HardRequirements(),
        extraction_source=ExtractionSource.CONVERSATION,
        parallel_research_status="pending",
    )

    # Calculate initial completion
    profile.update_completion_status()

    # Save to database
    created_profile = await job_profile_repo.create(profile)
    if not created_profile:
        raise HTTPException(500, "Failed to create session")

    # Trigger company research in background
    background_tasks.add_task(
        research_company,
        session_id=session_id,
        company_name=request.company_name,
        website=request.company_website
    )

    return StartSessionResponse(
        session_id=session_id,
        status="created",
        message="Session created. Company research started in background."
    )


# =============================================================================
# Profile Listing (MUST be before /{session_id} routes to avoid matching)
# =============================================================================

class ProfileSummary(BaseModel):
    """Summary of a job profile for listing."""
    id: str
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    location: Optional[str] = None
    experience_range: str
    traits_count: int
    must_have_count: int
    interview_stages_count: int
    completion_percentage: float
    is_complete: bool
    created_at: Optional[str] = None


class ProfileListResponse(BaseModel):
    """Response for listing job profiles."""
    profiles: List[ProfileSummary]
    total: int


@router.get("/profiles", response_model=ProfileListResponse)
async def list_profiles(complete_only: bool = False, limit: int = 20):
    """
    List available job profiles.

    Use this to populate the profile selector in the candidate upload flow.

    Args:
        complete_only: If True, only return complete profiles
        limit: Maximum number of profiles to return
    """
    from services.profile_converter import get_profile_summary_for_display

    # Get all profiles from database
    profiles = await job_profile_repo.list_all(limit=limit)

    # Filter if needed
    if complete_only:
        profiles = [p for p in profiles if p.is_complete]

    # Convert to summaries
    summaries = []
    for profile in profiles:
        summary_dict = get_profile_summary_for_display(profile)
        summaries.append(ProfileSummary(**summary_dict))

    return ProfileListResponse(
        profiles=summaries,
        total=len(summaries)
    )


# =============================================================================
# Session-specific endpoints (/{session_id}/...)
# =============================================================================

@router.get("/{session_id}", response_model=ProfileResponse)
async def get_profile(session_id: str):
    """Get the current job profile."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    return ProfileResponse(
        profile=profile.model_dump(),
        completion_percentage=profile.calculate_completion_percentage(),
        missing_fields=profile.get_missing_fields()
    )


@router.get("/{session_id}/company-intel", response_model=CompanyIntelResponse)
async def get_company_intel(session_id: str):
    """
    Get company research status and results.

    Poll this endpoint to check when Parallel.ai research is complete.
    """
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    status = profile.parallel_research_status

    if status == "pending":
        return CompanyIntelResponse(status="pending")

    if status == "in_progress":
        return CompanyIntelResponse(status="in_progress")

    if status == "failed":
        return CompanyIntelResponse(
            status="failed",
            error="Company research failed. Proceeding with limited context."
        )

    # Complete or partial
    return CompanyIntelResponse(
        status=status,
        company_intel=profile.company.model_dump() if profile.company else None
    )


@router.post("/{session_id}/parse-jd", response_model=ParseJDResponse)
async def parse_jd(session_id: str, request: ParseJDRequest):
    """
    Parse a job description and extract structured data.

    Extracts all possible fields from the JD text, calculates confidence
    scores, and identifies gaps that need to be filled via voice conversation.
    """
    # Validate session exists
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    logger.info(f"Parsing JD for session {session_id} ({len(request.jd_text)} chars)")

    # Get company context for better extraction
    company_context = profile.company if profile.company.name else None

    # Extract from JD
    extracted_data, confidence_scores, missing_fields = await jd_extractor.extract(
        jd_text=request.jd_text,
        company_context=company_context
    )

    # Check for extraction failure
    if "extraction_failed" in missing_fields:
        raise HTTPException(500, "JD extraction failed. Please try again or use voice input.")

    # Update profile with extracted data
    updated_profile = jd_extractor.build_job_profile_from_extraction(
        extracted_data=extracted_data,
        confidence_scores=confidence_scores,
        existing_profile=profile
    )

    # Save updated profile
    await job_profile_repo.update(session_id, updated_profile)

    # Calculate optional missing fields (nice to have but not required)
    optional_missing = _get_optional_missing_fields(updated_profile)

    # Generate smart questions for gaps
    suggested_questions = generate_gap_fill_questions(
        missing_required=missing_fields,
        missing_optional=optional_missing,
        company=company_context
    )

    # Generate extraction summary
    extraction_summary = _generate_extraction_summary(extracted_data, confidence_scores)

    return ParseJDResponse(
        success=True,
        extracted=extracted_data,
        confidence_scores=confidence_scores,
        missing_required=missing_fields,
        missing_optional=optional_missing,
        suggested_questions=suggested_questions,
        extraction_summary=extraction_summary,
        completion_percentage=updated_profile.calculate_completion_percentage()
    )


def _get_optional_missing_fields(profile: JobProfile) -> List[str]:
    """Get optional fields that would be nice to have."""
    optional_missing = []

    req = profile.requirements

    # Optional location details
    if req.location_type and req.location_type.value == "hybrid":
        if req.onsite_days_per_week is None:
            optional_missing.append("onsite_days")

    # Optional experience ceiling
    if req.experience_min_years is not None and req.experience_max_years is None:
        optional_missing.append("experience_max")

    # Team structure
    optional_missing.append("team_structure")

    # Growth path
    optional_missing.append("growth_path")

    return optional_missing[:5]  # Limit to 5


def _generate_extraction_summary(
    extracted: Dict[str, Any],
    confidence: Dict[str, float]
) -> str:
    """Generate a human-readable summary of what was extracted."""
    parts = []

    req = extracted.get("requirements", {})

    if req.get("job_title"):
        parts.append(f"Title: {req['job_title']}")

    if req.get("location_type"):
        loc = req["location_type"]
        if req.get("location_city"):
            loc = f"{req['location_city']} ({loc})"
        parts.append(f"Location: {loc}")

    if req.get("experience_min_years") is not None:
        exp = f"{req['experience_min_years']}+"
        if req.get("experience_max_years"):
            exp = f"{req['experience_min_years']}-{req['experience_max_years']}"
        parts.append(f"Experience: {exp} years")

    if req.get("salary_min"):
        comp = f"${req['salary_min']:,}"
        if req.get("salary_max"):
            comp += f"-${req['salary_max']:,}"
        parts.append(f"Compensation: {comp}")

    traits = extracted.get("traits", [])
    if traits:
        parts.append(f"Traits: {len(traits)} identified")

    stages = extracted.get("interview_stages", [])
    if stages:
        parts.append(f"Interview: {len(stages)} stages")

    if not parts:
        return "Limited information extracted. Voice conversation recommended."

    return " | ".join(parts)


@router.patch("/{session_id}/requirements")
async def update_requirements(session_id: str, request: UpdateRequirementsRequest):
    """Update job requirements."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    # Build updates dict (only non-None values)
    updates = {k: v for k, v in request.model_dump().items() if v is not None}

    if not updates:
        raise HTTPException(400, "No updates provided")

    success = await job_profile_repo.update_requirements(session_id, updates)
    if not success:
        raise HTTPException(500, "Failed to update requirements")

    # Return updated profile
    updated_profile = await job_profile_repo.get(session_id)
    return {
        "success": True,
        "requirements": updated_profile.requirements.model_dump(),
        "completion_percentage": updated_profile.calculate_completion_percentage(),
        "missing_fields": updated_profile.get_missing_fields()
    }


@router.post("/{session_id}/traits")
async def create_trait(session_id: str, request: CreateTraitRequest):
    """Add a candidate trait."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    from models.voice_ingest.enums import TraitPriority

    trait = CandidateTrait(
        name=request.name,
        description=request.description,
        priority=TraitPriority(request.priority),
        signals=request.signals,
    )

    success = await job_profile_repo.add_trait(session_id, trait)
    if not success:
        raise HTTPException(500, "Failed to add trait")

    updated_profile = await job_profile_repo.get(session_id)
    return {
        "success": True,
        "trait": trait.model_dump(),
        "traits_count": len(updated_profile.traits),
        "completion_percentage": updated_profile.calculate_completion_percentage()
    }


@router.delete("/{session_id}/traits/{trait_name}")
async def delete_trait(session_id: str, trait_name: str):
    """Delete a candidate trait."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    success = await job_profile_repo.delete_trait(session_id, trait_name)
    if not success:
        raise HTTPException(404, "Trait not found")

    updated_profile = await job_profile_repo.get(session_id)
    return {
        "success": True,
        "traits_count": len(updated_profile.traits),
        "completion_percentage": updated_profile.calculate_completion_percentage()
    }


@router.post("/{session_id}/interview-stages")
async def create_interview_stage(session_id: str, request: CreateInterviewStageRequest):
    """Add an interview stage."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    stage = InterviewStage(
        name=request.name,
        description=request.description,
        order=len(profile.interview_stages) + 1,
        duration_minutes=request.duration_minutes,
        interviewer_role=request.interviewer_role,
        actions=request.actions,
    )

    success = await job_profile_repo.add_interview_stage(session_id, stage)
    if not success:
        raise HTTPException(500, "Failed to add interview stage")

    updated_profile = await job_profile_repo.get(session_id)
    return {
        "success": True,
        "stage": stage.model_dump(),
        "stages_count": len(updated_profile.interview_stages),
        "completion_percentage": updated_profile.calculate_completion_percentage()
    }


@router.delete("/{session_id}/interview-stages/{stage_name}")
async def delete_interview_stage(session_id: str, stage_name: str):
    """Delete an interview stage."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    success = await job_profile_repo.delete_interview_stage(session_id, stage_name)
    if not success:
        raise HTTPException(404, "Interview stage not found")

    updated_profile = await job_profile_repo.get(session_id)
    return {
        "success": True,
        "stages_count": len(updated_profile.interview_stages),
        "completion_percentage": updated_profile.calculate_completion_percentage()
    }


@router.patch("/{session_id}/outreach")
async def update_outreach(session_id: str, request: UpdateOutreachRequest):
    """Update outreach configuration."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    # Update outreach fields
    outreach = profile.outreach

    if request.tone:
        from models.voice_ingest.enums import OutreachTone
        outreach.tone = OutreachTone(request.tone)
    if request.key_hook is not None:
        outreach.key_hook = request.key_hook
    if request.selling_points is not None:
        outreach.selling_points = request.selling_points
    if request.subject_line is not None:
        outreach.subject_line = request.subject_line
    if request.email_body is not None:
        outreach.email_body = request.email_body

    # Save updated profile
    profile.outreach = outreach
    await job_profile_repo.update(session_id, profile)

    return {
        "success": True,
        "outreach": outreach.model_dump()
    }


@router.post("/{session_id}/complete")
async def mark_complete(session_id: str):
    """Mark the job profile as complete."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    # Check if actually complete
    missing = profile.get_missing_fields()
    if missing:
        raise HTTPException(
            400,
            f"Profile is not complete. Missing: {', '.join(missing)}"
        )

    success = await job_profile_repo.mark_complete(session_id)
    if not success:
        raise HTTPException(500, "Failed to mark profile as complete")

    return {
        "success": True,
        "message": "Profile marked as complete",
        "profile_id": session_id
    }


@router.get("/{session_id}/job-description")
async def get_job_description(session_id: str):
    """Generate a human-readable job description from the profile."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    return {
        "job_description": profile.to_job_description(),
        "is_complete": profile.is_complete
    }


# =============================================================================
# Voice Session Endpoints
# =============================================================================

def _generate_voice_token(
    room_name: str,
    participant_identity: str,
    participant_name: str,
    metadata: str = "",
    ttl_seconds: int = 3600
) -> str:
    """
    Generate a LiveKit access token for voice sessions.

    Uses JWT with LiveKit's expected claims structure.
    """
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(
            status_code=500,
            detail="LiveKit credentials not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET."
        )

    now = int(time.time())

    claims = {
        "iss": LIVEKIT_API_KEY,
        "exp": now + ttl_seconds,
        "nbf": now,
        "sub": participant_identity,
        "name": participant_name,
        "video": {
            "room": room_name,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        },
        "metadata": metadata,
    }

    token = jwt.encode(claims, LIVEKIT_API_SECRET, algorithm="HS256")
    return token


@router.post("/{session_id}/voice-token", response_model=VoiceTokenResponse)
async def get_voice_token(session_id: str):
    """
    Generate a LiveKit token for voice onboarding session.

    Creates a room with session metadata that the agent will read.
    The frontend uses this token to connect to the LiveKit room.
    """
    # Validate session exists
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    if not LIVEKIT_URL:
        raise HTTPException(
            status_code=500,
            detail="LiveKit URL not configured. Set LIVEKIT_URL environment variable."
        )

    # Room name includes session_id for the agent to find
    room_name = f"voice-ingest-{session_id}"

    # Build room metadata for the agent
    room_metadata = {
        "session_id": session_id,
        "mode": "onboarding",
        "recruiter_name": f"{profile.recruiter_first_name} {profile.recruiter_last_name}",
        "company_name": profile.company.name if profile.company else None,
    }

    # Generate token for the recruiter
    token = _generate_voice_token(
        room_name=room_name,
        participant_identity=f"recruiter-{session_id[:8]}",
        participant_name=profile.recruiter_first_name,
        metadata=json.dumps(room_metadata),
    )

    logger.info(f"Generated voice token for session {session_id}, room {room_name}")

    return VoiceTokenResponse(
        token=token,
        livekit_url=LIVEKIT_URL,
        room_name=room_name,
        session_id=session_id,
    )


@router.post("/{session_id}/vapi-call", response_model=VapiCallResponse)
async def create_vapi_call(session_id: str):
    """
    Create a Vapi web call for voice onboarding session.

    This creates a Vapi call with an inline assistant that has:
    - The system prompt with company research context
    - The opening message ("wow" hook)
    - All the context needed to conduct the onboarding

    The frontend uses the returned webCallUrl or public key to connect.
    """
    # Validate session exists
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    if not VAPI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Vapi API key not configured. Set VAPI_API_KEY environment variable."
        )

    if not VAPI_PUBLIC_KEY:
        raise HTTPException(
            status_code=500,
            detail="Vapi public key not configured. Set VAPI_PUBLIC_KEY environment variable."
        )

    # Create the Vapi call with all context
    result = await vapi_service.create_web_call(
        session_id=session_id,
        user_name=profile.recruiter_first_name,
        company_intel=profile.company,
        job_profile=profile,
    )

    if "error" in result:
        logger.error(f"Failed to create Vapi call for session {session_id}: {result['error']}")
        return VapiCallResponse(
            call_id="",
            vapi_public_key=VAPI_PUBLIC_KEY,
            session_id=session_id,
            error=result["error"],
        )

    logger.info(f"Created Vapi call for session {session_id}: {result.get('id')}")

    return VapiCallResponse(
        call_id=result.get("id", ""),
        web_call_url=result.get("webCallUrl"),
        vapi_public_key=VAPI_PUBLIC_KEY,
        assistant_id=result.get("assistantId"),
        session_id=session_id,
    )


# =============================================================================
# WebSocket for Real-time Updates
# =============================================================================

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time profile updates.

    The voice agent pushes updates here as it extracts information.
    The frontend connects to receive live updates to the profile.

    Message types sent to clients:
    - requirements: Job requirements updated
    - trait_created/trait_updated/trait_deleted: Trait changes
    - stage_created/stage_updated/stage_deleted: Interview stage changes
    - nuance_captured: Qualitative insight captured
    - transcript: Conversation transcript update
    - completion_update: Profile completion percentage changed
    - field_complete: A field was confirmed
    - onboarding_complete: Profile is complete
    """
    # Validate session exists before accepting
    profile = await job_profile_repo.get(session_id)
    if not profile:
        await websocket.close(code=4004, reason="Session not found")
        return

    # Connect to the hub
    await ws_hub.connect(session_id, websocket)

    try:
        # Send initial profile state
        await websocket.send_json({
            "type": "connected",
            "data": {
                "session_id": session_id,
                "profile": profile.model_dump(),
                "completion_percentage": profile.calculate_completion_percentage(),
                "missing_fields": profile.get_missing_fields(),
            }
        })

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages from client (ping/pong, etc.)
                data = await websocket.receive_text()

                # Handle ping
                if data == "ping":
                    await websocket.send_text("pong")

                # Handle profile refresh request
                elif data == "refresh":
                    current_profile = await job_profile_repo.get(session_id)
                    if current_profile:
                        await websocket.send_json({
                            "type": "profile_refresh",
                            "data": {
                                "profile": current_profile.model_dump(),
                                "completion_percentage": current_profile.calculate_completion_percentage(),
                                "missing_fields": current_profile.get_missing_fields(),
                            }
                        })

            except WebSocketDisconnect:
                break

    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")

    finally:
        await ws_hub.disconnect(session_id, websocket)
        logger.info(f"WebSocket disconnected for session {session_id}")
