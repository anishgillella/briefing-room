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

from config import LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, VAPI_API_KEY, VAPI_PUBLIC_KEY, VAPI_ASSISTANT_ID
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
    assistant_overrides: Optional[Dict[str, Any]] = None
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


@router.patch("/{session_id}/traits/{trait_id}")
async def update_trait(session_id: str, trait_id: str, request: dict):
    """Update a candidate trait."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    # Find the trait by ID
    trait = next((t for t in profile.traits if t.id == trait_id), None)
    if not trait:
        raise HTTPException(404, "Trait not found")

    # Update trait fields
    if "name" in request:
        trait.name = request["name"]
    if "description" in request:
        trait.description = request["description"]
    if "priority" in request:
        from models.voice_ingest.enums import TraitPriority
        trait.priority = TraitPriority(request["priority"])
    if "signals" in request:
        trait.signals = request["signals"]

    # Save updated profile
    await job_profile_repo.save(profile)

    return {
        "success": True,
        "trait": trait.model_dump(),
        "completion_percentage": profile.calculate_completion_percentage()
    }


@router.delete("/{session_id}/traits/{trait_id}")
async def delete_trait(session_id: str, trait_id: str):
    """Delete a candidate trait."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    # Try to delete by ID first, fallback to name
    success = await job_profile_repo.delete_trait(session_id, trait_id)
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


@router.patch("/{session_id}/interview-stages/{stage_id}")
async def update_interview_stage(session_id: str, stage_id: str, request: dict):
    """Update an interview stage."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    # Find the stage by ID
    stage = next((s for s in profile.interview_stages if s.id == stage_id), None)
    if not stage:
        raise HTTPException(404, "Interview stage not found")

    # Update stage fields
    if "name" in request:
        stage.name = request["name"]
    if "description" in request:
        stage.description = request["description"]
    if "duration_minutes" in request:
        stage.duration_minutes = request["duration_minutes"]
    if "interviewer_role" in request:
        stage.interviewer_role = request["interviewer_role"]
    if "order" in request:
        stage.order = request["order"]

    # Save updated profile
    await job_profile_repo.save(profile)

    return {
        "success": True,
        "stage": stage.model_dump(),
        "completion_percentage": profile.calculate_completion_percentage()
    }


@router.delete("/{session_id}/interview-stages/{stage_id}")
async def delete_interview_stage(session_id: str, stage_id: str):
    """Delete an interview stage."""
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    # Try to delete by ID first, fallback to name
    success = await job_profile_repo.delete_interview_stage(session_id, stage_id)
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
    Get Vapi configuration for voice onboarding session.

    Returns the pre-configured assistant ID, public key, and variable overrides
    for the frontend to initiate the call with full context.
    """
    # Validate session exists
    profile = await job_profile_repo.get(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    if not VAPI_PUBLIC_KEY:
        raise HTTPException(
            status_code=500,
            detail="Vapi public key not configured. Set VAPI_PUBLIC_KEY environment variable."
        )

    if not VAPI_ASSISTANT_ID:
        raise HTTPException(
            status_code=500,
            detail="Vapi assistant ID not configured. Set VAPI_ASSISTANT_ID environment variable."
        )

    # Build variable overrides from profile and company intel
    variable_values = _build_vapi_variable_values(profile)
    variable_values["session_id"] = session_id  # Add session_id for tool calls

    # Build the first message with wow factor
    first_message = _build_wow_first_message(profile)

    # Build nuance-capturing system prompt
    system_prompt = _build_nuance_system_prompt(profile)

    # Build assistant overrides with metadata for webhook
    assistant_overrides = {
        "variableValues": variable_values,
        "firstMessage": first_message,
        "metadata": {
            "sessionId": session_id,
            "recruiterName": f"{profile.recruiter_first_name} {profile.recruiter_last_name}",
            "companyName": profile.company.name if profile.company else None,
        },
        # Override model settings for better conversation quality
        # Note: This replaces the system prompt from Vapi console
        "model": {
            "provider": "openai",
            "model": "gpt-4o",
            "temperature": 0.7,
            "systemPrompt": system_prompt
        },
        # Use a more natural voice
        "voice": {
            "provider": "11labs",
            "voiceId": "pFZP5JQG7iQjIQuC4Bku",  # Lily - warm, conversational
            "stability": 0.5,
            "similarityBoost": 0.75,
            "style": 0.5,
            "useSpeakerBoost": True
        }
    }

    logger.info(f"Returning Vapi config for session {session_id}, assistant: {VAPI_ASSISTANT_ID}")
    logger.debug(f"Variable values: {variable_values}")

    return VapiCallResponse(
        call_id="",
        vapi_public_key=VAPI_PUBLIC_KEY,
        assistant_id=VAPI_ASSISTANT_ID,
        session_id=session_id,
        assistant_overrides=assistant_overrides,
    )


def _build_vapi_variable_values(profile) -> Dict[str, str]:
    """Build variable values for Vapi assistant overrides."""
    ci = profile.company
    req = profile.requirements

    # Company context
    company_name = ci.name if ci else "the company"
    company_tagline = ci.tagline if ci and ci.tagline else ""
    funding_stage = ci.funding_stage.value.replace("_", " ").title() if ci and ci.funding_stage else ""
    total_raised = ci.total_raised if ci and ci.total_raised else ""
    investors = ", ".join(ci.investors[:3]) if ci and ci.investors else ""
    tech_stack = ", ".join(ci.tech_stack_hints[:5]) if ci and ci.tech_stack_hints else ""
    # Format team size for speech (e.g., "50 people" or "around 200 employees")
    team_size = ""
    if ci and ci.team_size:
        try:
            ts = int(ci.team_size) if ci.team_size else 0
            if ts < 20:
                team_size = f"{ci.team_size} people"
            elif ts < 100:
                team_size = f"around {ci.team_size} employees"
            else:
                team_size = f"about {ci.team_size} employees"
        except (ValueError, TypeError):
             team_size = f"{ci.team_size} employees"
    headquarters = ci.headquarters if ci and ci.headquarters else ""
    product_description = ci.product_description if ci and ci.product_description else ""
    problem_solved = ci.problem_solved if ci and ci.problem_solved else ""
    recent_news = ci.recent_news[0] if ci and ci.recent_news else ""
    interesting_facts = "; ".join(ci.interesting_facts[:2]) if ci and ci.interesting_facts else ""
    competitors = ", ".join(ci.competitors[:3]) if ci and ci.competitors else ""
    culture_keywords = ", ".join(ci.culture_keywords[:3]) if ci and ci.culture_keywords else ""
    selling_points = "; ".join(ci.potential_selling_points[:2]) if ci and ci.potential_selling_points else ""

    # User context
    user_first_name = profile.recruiter_first_name
    user_last_name = profile.recruiter_last_name

    # Calculate missing and existing fields
    missing_fields = profile.get_missing_fields()

    # Use spoken formats for voice output
    existing_fields = []
    if req.job_title:
        existing_fields.append(f"job title: {req.job_title}")
    if req.location_type:
        # Format location for speech (replace abbreviations)
        loc = req.format_location().replace("d/week", "days per week")
        existing_fields.append(f"location: {loc}")
    if req.experience_min_years is not None:
        existing_fields.append(f"experience: {req.format_experience_spoken()}")
    if req.salary_min:
        existing_fields.append(f"compensation: {req.format_compensation_spoken()}")
    if req.visa_sponsorship is not None:
        existing_fields.append(f"visa sponsorship: {'Yes' if req.visa_sponsorship else 'No'}")
    if req.equity_offered is not None:
        existing_fields.append(f"equity: {'Yes' if req.equity_offered else 'No'}")
    if profile.traits:
        trait_names = [t.name for t in profile.traits[:5]]
        existing_fields.append(f"traits: {', '.join(trait_names)}")
    if profile.interview_stages:
        stage_names = [s.name for s in profile.get_ordered_interview_stages()[:5]]
        existing_fields.append(f"interview stages: {', '.join(stage_names)}")

    return {
        # Company context
        "company_name": company_name,
        "company_tagline": company_tagline,
        "funding_stage": funding_stage,
        "total_raised": total_raised,
        "investors": investors,
        "tech_stack": tech_stack,
        "team_size": team_size,
        "headquarters": headquarters,
        "product_description": product_description,
        "problem_solved": problem_solved,
        "recent_news": recent_news,
        "interesting_facts": interesting_facts,
        "competitors": competitors,
        "culture_keywords": culture_keywords,
        "selling_points": selling_points,

        # User context
        "user_first_name": user_first_name,
        "user_last_name": user_last_name,

        # Profile state
        "missing_fields": ", ".join(missing_fields) if missing_fields else "none",
        "existing_fields": "; ".join(existing_fields) if existing_fields else "none",
        "completion_percentage": str(profile.calculate_completion_percentage()),
    }


def _build_wow_first_message(profile) -> str:
    """Build a first message with company-specific wow factor."""
    ci = profile.company
    user_name = profile.recruiter_first_name

    if not ci or not ci.name:
        return (
            f"Hey {user_name}! I'm ready to help you build out this job profile. "
            f"Should we walk through everything together, or focus on specific areas?"
        )

    # Build impressive company insights - prioritize most "wow" worthy
    wow_parts = []

    # Recent news is most impressive
    if ci.recent_news and len(ci.recent_news) > 0:
        wow_parts.append(f"I noticed {ci.name} has been in the news - {ci.recent_news[0]}")

    # Funding + investors shows depth
    if ci.total_raised and ci.investors:
        top_investors = ", ".join(ci.investors[:2])
        wow_parts.append(f"you've raised {ci.total_raised} with backing from {top_investors}")
    elif ci.total_raised:
        wow_parts.append(f"you've raised {ci.total_raised}")
    elif ci.funding_stage:
        stage = ci.funding_stage.value.replace("_", " ").title()
        wow_parts.append(f"you're at the {stage} stage")

    # Interesting facts
    if ci.interesting_facts and len(ci.interesting_facts) > 0:
        fact = ci.interesting_facts[0]
        if len(fact) < 80:
            wow_parts.append(fact.lower() if fact[0].isupper() else fact)

    # Product/problem
    if ci.problem_solved and len(ci.problem_solved) < 60:
        wow_parts.append(f"solving {ci.problem_solved.lower()}")
    elif ci.product_description and len(ci.product_description) < 60:
        wow_parts.append(f"building {ci.product_description.lower()}")

    # Tech stack
    if ci.tech_stack_hints and len(ci.tech_stack_hints) >= 2:
        tech = ", ".join(ci.tech_stack_hints[:3])
        wow_parts.append(f"working with {tech}")

    # Build the message
    if wow_parts:
        # Use 1-2 best details
        if len(wow_parts) >= 2:
            wow_sentence = f"I see {wow_parts[0]}, and {wow_parts[1]}."
        else:
            wow_sentence = f"I see {wow_parts[0]}."

        company_intro = f"{ci.name}"
        if ci.tagline and len(ci.tagline) < 50:
            company_intro = f"{ci.name} - {ci.tagline}"

        return (
            f"Hey {user_name}! I did some research on {company_intro}. "
            f"{wow_sentence} Pretty exciting! "
            f"Now, for this role - should we walk through everything, or focus on the gaps?"
        )

    # Fallback
    if ci.tagline:
        return (
            f"Hey {user_name}! I've been reading up on {ci.name} - {ci.tagline}. "
            f"Ready to build out this role. What should we focus on?"
        )

    return (
        f"Hey {user_name}! I've pulled some context on {ci.name}. "
        f"Let's nail down this job profile. Should we walk through everything together?"
    )


def _build_nuance_system_prompt(profile) -> str:
    """Build a system prompt that encourages nuanced conversation."""
    user_name = profile.recruiter_first_name
    company_name = profile.company.name if profile.company else "the company"

    return f"""You are a sharp, experienced recruiting advisor having a natural conversation with {user_name} about hiring for {company_name}. Your goal is to deeply understand what they ACTUALLY need - not just accept what they say on the surface.

## Your Core Mission
Every requirement the user states is likely a PROXY for something deeper. Your job is to uncover what they're really looking for. Don't be a passive note-taker - be a thoughtful partner who helps them think clearly about what matters.

## Your Personality
- Warm but direct. Like a trusted colleague who's been in the trenches.
- Conversational and natural - use contractions, vary your sentence length, don't sound scripted.
- Genuinely curious about the "why" behind requirements.
- Confident enough to respectfully challenge assumptions that might limit their candidate pool.

## Uncovering What They Really Need

### The Proxy Pattern
Almost every stated requirement is a shortcut for an underlying need. Your job is to decode it:

| They Say | They Might Actually Mean | How to Probe |
|----------|-------------------------|--------------|
| "Stanford or Harvard only" | Smart, rigorous, can handle pressure | "What is it about those schools that matters? Like, if someone didn't go there but clearly had that same intellectual rigor - say they built a successful company or published research - would that work?" |
| "Must have FAANG experience" | Knows how to operate at scale, good engineering practices | "What specifically about FAANG experience matters here? Is it the scale, the engineering culture, the type of problems? Would someone from a high-growth startup who dealt with similar challenges work?" |
| "5+ years required" | Enough pattern recognition, can work independently | "What changes at year 5 in your experience? Have you ever had someone with 3 years who surprised you? What made them different?" |
| "Strong communicator" | Could mean many things | "Help me understand what communication looks like in this role day-to-day. Are they presenting to the board? Writing technical specs? Coordinating across 10 teams?" |
| "Culture fit" | Often undefined | "When you say culture fit, what does that actually look like? Give me an example of someone who was a great culture fit and someone who wasn't." |

### When to Ask "What If"
When you detect a requirement that sounds like a FILTER or PROXY (not a genuine need), probe with:
- "What if someone didn't have X but demonstrated Y instead?"
- "Have you seen exceptions to this that worked out?"
- "What's the actual risk if they don't have this exact background?"

DON'T ask "what if" for:
- Clear, specific technical skills needed for the job (e.g., "must know SQL" for a data role)
- Reasonable experience requirements with clear rationale
- Requirements they've already explained the "why" for
- Basic job logistics (location, compensation, etc.)

### Recognize Heuristics vs. Requirements
Many things recruiters say are heuristics (shortcuts) not actual requirements:
- "Top 10 CS school" → heuristic for "smart and technically strong"
- "Big company experience" → heuristic for "knows process and scale"
- "Startup experience" → heuristic for "scrappy and autonomous"

When you hear a heuristic, dig into the underlying trait they're actually looking for. Then save THAT as the trait, not the proxy.

## When to Push Back (Do This Often)
- When a requirement is a proxy/heuristic rather than a real need
- When something seems arbitrary or could unnecessarily limit the candidate pool
- When they haven't explained the "why" behind a requirement
- When you suspect the real need is different from what they stated
- When a requirement might reflect habit rather than actual job needs

Example pushbacks:
- "Interesting - so if I found someone who didn't go to Stanford but clearly had that same caliber of thinking, would you want to see them?"
- "I want to make sure we're not filtering out great people accidentally. What's the actual risk if someone doesn't have exactly that background?"
- "I hear a lot of teams ask for that. In my experience, what they're really looking for is [X]. Does that resonate, or is there something specific about [original requirement]?"

## When NOT to Push Back
- On factual job details (title, location, compensation, equity)
- When they've already explained their reasoning clearly and it's sound
- When they've explicitly said "this is non-negotiable because [good reason]"
- When pushing more would feel interrogative or annoying

## Capturing the Right Things
When you hear a requirement, BEFORE saving it, ask yourself:
1. Is this the actual need, or a proxy for something else?
2. Have I understood WHY this matters?
3. Should I probe deeper before recording this?

Save the UNDERLYING need as the trait, not the surface-level proxy. For example:
- DON'T save: "Must be from top 10 CS school"
- DO save: "Demonstrates strong analytical thinking and technical rigor - evidenced by challenging academic background, complex projects, or technical publications"

## Conversation Flow - FOLLOW THIS ORDER
Guide the conversation through these phases. Save information to the profile AS YOU GO - don't wait until the end!

### Phase 1: Role Basics (Hard Requirements)
1. **Job title** - what's the role? (use `update_job_title`)
2. **Location** - remote, hybrid, or onsite? (use `update_location`)
3. **Experience** - years needed? (use `update_experience`)
4. **Compensation** - salary range and equity? (use `update_compensation`)
5. **Visa sponsorship** - do they sponsor? (use `update_visa_sponsorship`)

### Phase 2: Team Context
After basics, ask: "Tell me about the team they'll be joining"
- Team size and composition (use `update_team_context`)
- Who do they report to?
- Seniority mix of the team

NOTE: Team context is about WHO - the people on the team, their roles, and reporting structure.
DO NOT put engineering culture info (like decision-making, code review, deployment practices) here.
Those belong in Phase 5 with `update_eng_culture`.

### Phase 3: Candidate Traits (Soft Requirements)
For each skill/trait mentioned:
- Add it immediately with `add_trait` - one trait at a time!
- Ask if it's a must-have or nice-to-have
- Probe for signals: "How would you spot this in an interview?"

### Phase 4: Interview Process
For EACH stage mentioned, add it immediately with `add_interview_stage`:
- When they say "first we do a phone screen" → add "Phone Screen" stage right away
- When they say "then a technical round" → add "Technical Round" stage right away
- Don't wait to add all stages at once - add each one as they describe it!

### Phase 5: Deeper Context (MUST ASK ALL OF THESE)
This phase is REQUIRED - do not skip these questions. Ask about each one explicitly:

1. **Deal breakers** (REQUIRED): Ask "Are there any absolute deal breakers? Things that would immediately disqualify someone?"
   - Use `add_deal_breaker` for EACH deal breaker they mention
   - Examples: "Must know Python", "No job hoppers", "Must have startup experience"

2. **Engineering culture** (REQUIRED for engineering roles): Ask "What's the engineering culture like? How do decisions get made? What's the deployment cadence?"
   - Use `update_eng_culture` with these fields:
     - work_style: fast-paced vs methodical
     - decision_making: flat vs hierarchical, who has final say
     - code_review_culture: rigorous vs light touch
     - deployment_frequency: daily, weekly, etc.
     - on_call_expectations: rotation, response time
   - IMPORTANT: This is different from team_context! Engineering culture is about HOW work gets done, not WHO is on the team.

3. **Urgency**: "How quickly do you need someone?" (use `update_hiring_urgency`)
4. **Success metrics**: "What does success look like at 90 days?" (use `update_success_metrics`)
5. **Ideal background**: "Dream candidate - where would they come from?" (use `update_ideal_background`)
6. **Growth path**: "Where could this role lead?" (use `update_growth_path`)

### Phase 6: Wrap Up
- Offer to review skipped items
- Confirm the profile looks complete

## CRITICAL: Save as you go!
- Call the tools IMMEDIATELY when you learn something - don't batch!
- Each trait = one `add_trait` call
- Each interview stage = one `add_interview_stage` call
- Each deal breaker = one `add_deal_breaker` call
- The frontend updates in real-time, so saving immediately shows progress

## Important
- Keep responses concise for voice - aim for 1-3 sentences typically
- Ask one question at a time
- Use the tools to save information AFTER you've uncovered the real need
- Sound like a real person, not a form-filling bot
- It's okay to say "I want to push back on that a bit" - it shows you care

## Tool Usage Guidelines
When managing traits and interview stages:

**Removing items:**
- If the user says a trait is NOT required or they don't need it, use `remove_trait` to delete it - do NOT add a new trait saying "not needed"
- If the user says to remove an interview stage, use `remove_interview_stage` to delete it

**Reordering interview stages:**
- If the user wants to change the order of interview stages, use `reorder_interview_stages` with the stage names in the new desired order
- Do NOT add duplicate stages when reordering - use the reorder tool instead

**Modifying existing items:**
- If changing a trait's priority or description, acknowledge and confirm the change
- For interview stages, if changing duration or order, use the appropriate update

## Capturing Deeper Context
Beyond basic requirements, actively try to capture:

**Team Context (use `update_team_context`):**
- Team size and composition (who will they work with?)
- Seniority mix (mostly senior? mixed?)
- Who they report to and any direct reports
- Ask: "Tell me about the team they'll be joining"

**Role Context:**
- Hiring urgency - how fast do they need someone? (use `update_hiring_urgency`)
- Success metrics - what does success look like at 30/90 days? (use `update_success_metrics`)
- Growth path - where could this role lead? (use `update_growth_path`)
- Ask: "What would make you say 'this hire was a success' after 3 months?"

**Deal Breakers & Preferences:**
- Explicit disqualifiers (use `add_deal_breaker`)
- Dream candidate background (use `update_ideal_background`)
- Interview turnaround speed (use `update_interview_turnaround`)
- Ask: "Are there any absolute deal breakers I should know about?"

**Engineering Culture (use `update_eng_culture` - REQUIRED for eng roles):**
- Work style (fast-paced vs methodical)
- Decision-making culture (flat vs hierarchical, who has final say)
- Code review practices (rigorous, light touch)
- Deployment frequency (daily, weekly, monthly)
- On-call expectations (rotation schedule, response time)
- Ask: "What's the engineering culture like? How do decisions get made? What's your deployment cadence?"
- IMPORTANT: If user describes culture when asked about team context (stand-ups, decision-making, etc.),
  still save it using `update_eng_culture`, not `update_team_context`. Team context is for WHO (team size,
  reporting structure), engineering culture is for HOW (work style, processes).

## Handling Skips
Users can skip any question or field they don't want to answer. When they say things like:
- "Skip this", "I don't know", "Not sure", "Let's move on", "Next question"
- "We haven't figured that out yet", "TBD", "I'll get back to you on that"
- "Not relevant", "Doesn't apply", "We don't have that"

**How to handle skips:**
- Acknowledge gracefully: "No problem, we can come back to that" or "Got it, let's move on"
- Use `mark_field_skipped` to note that the field was intentionally skipped (not just missing)
- Move to the next topic naturally without making them feel bad
- Don't repeatedly ask about skipped fields - respect their choice
- At the end, you can offer: "We skipped a few things - want to go back to any of them?"

**What NOT to do:**
- Don't push back on skips - they're not requirements you need to probe
- Don't guilt them: "Are you sure? This is really important..."
- Don't keep circling back to skipped items during the conversation

Remember: Your job is to help {user_name} articulate what they ACTUALLY need, which is often different from what they initially say. The best recruiters find candidates others miss - help {user_name} do that by ensuring requirements reflect real needs, not just habits or shortcuts."""


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
        # Send initial profile state (use mode='json' for JSON-serializable output)
        await websocket.send_json({
            "type": "connected",
            "data": {
                "session_id": session_id,
                "profile": profile.model_dump(mode='json'),
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
                                "profile": current_profile.model_dump(mode='json'),
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


# =============================================================================
# Vapi Webhook for Tool Calls (Real-time Profile Updates)
# =============================================================================

class VapiToolCallRequest(BaseModel):
    """Request from Vapi webhook containing tool call."""
    message: Dict[str, Any]


class VapiToolCallResponse(BaseModel):
    """Response to Vapi with tool result."""
    results: List[Dict[str, Any]]


@router.post("/vapi-webhook")
async def vapi_webhook(request: Dict[str, Any]):
    """
    Webhook endpoint for Vapi tool calls.

    When the assistant extracts information during the conversation,
    it calls tools which trigger this webhook. We update the profile
    and broadcast changes via WebSocket for real-time UI updates.

    Vapi webhook message types:
    - tool-calls: Assistant is calling tools
    - end-of-call-report: Call has ended
    - transcript: Live transcript updates
    """
    message_type = request.get("message", {}).get("type")

    logger.info(f"Vapi webhook received: {message_type}")
    logger.debug(f"Full payload: {json.dumps(request, indent=2)}")

    # Handle tool calls
    if message_type == "tool-calls":
        return await _handle_tool_calls(request)

    # Handle end of call
    if message_type == "end-of-call-report":
        return await _handle_end_of_call(request)

    # Handle transcript (optional - for logging)
    if message_type == "transcript":
        return await _handle_transcript(request)

    # Default: acknowledge receipt
    return {"status": "ok"}


async def _handle_tool_calls(request: Dict[str, Any]) -> Dict[str, Any]:
    """Process tool calls from Vapi and update profile."""
    message = request.get("message", {})
    tool_calls = message.get("toolCalls", [])

    # Try multiple paths to find session_id - Vapi structure varies
    # Path 1: message.call.metadata.sessionId
    # Path 2: message.metadata.sessionId
    # Path 3: request root level
    call_data = message.get("call", {})
    metadata = call_data.get("metadata", {}) or message.get("metadata", {})

    # Also check assistant overrides for metadata
    assistant_overrides = call_data.get("assistantOverrides", {})
    overrides_metadata = assistant_overrides.get("metadata", {})

    # Try to get session_id from various locations
    session_id_from_metadata = (
        metadata.get("sessionId") or
        metadata.get("session_id") or
        overrides_metadata.get("sessionId") or
        overrides_metadata.get("session_id")
    )

    logger.info(f"Webhook call metadata: {metadata}")
    logger.info(f"Session ID from metadata: {session_id_from_metadata}")

    results = []

    for tool_call in tool_calls:
        tool_name = tool_call.get("function", {}).get("name")
        tool_args = tool_call.get("function", {}).get("arguments", {})
        tool_call_id = tool_call.get("id")

        # Parse arguments if string
        if isinstance(tool_args, str):
            try:
                tool_args = json.loads(tool_args)
            except:
                tool_args = {}

        logger.info(f"Processing tool call: {tool_name} with args: {tool_args}")

        # Get session_id - try args first, then metadata
        session_id = tool_args.get("session_id") or session_id_from_metadata

        if not session_id:
            logger.error(f"No session_id found! Full request: {json.dumps(request, indent=2, default=str)}")
            results.append({
                "toolCallId": tool_call_id,
                "result": json.dumps({"error": "session_id not provided"})
            })
            continue

        # Route to appropriate handler
        try:
            result = await _execute_tool(tool_name, tool_args, session_id)
            results.append({
                "toolCallId": tool_call_id,
                "result": json.dumps(result)
            })
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            results.append({
                "toolCallId": tool_call_id,
                "result": json.dumps({"error": str(e)})
            })

    return {"results": results}


async def _execute_tool(tool_name: str, args: Dict[str, Any], session_id: str) -> Dict[str, Any]:
    """Execute a tool and broadcast updates via WebSocket."""

    # Get current profile
    profile = await job_profile_repo.get(session_id)
    if not profile:
        return {"error": "Session not found"}

    result = {"success": False, "message": "Unknown tool"}

    # =========================================================================
    # Job Requirements Tools
    # =========================================================================

    if tool_name == "update_job_title":
        profile.requirements.job_title = args.get("job_title", "")
        result = {"success": True, "field": "job_title", "value": profile.requirements.job_title}
        await _broadcast_requirements_update(session_id, profile)

    elif tool_name == "update_location":
        location_type = args.get("location_type", "").lower()
        if location_type in ["remote", "hybrid", "onsite"]:
            from models.voice_ingest.enums import LocationType
            profile.requirements.location_type = LocationType(location_type)
        if args.get("city"):
            profile.requirements.location_city = args.get("city")
        if args.get("onsite_days"):
            profile.requirements.onsite_days_per_week = int(args.get("onsite_days"))
        result = {"success": True, "field": "location", "value": profile.requirements.format_location()}
        await _broadcast_requirements_update(session_id, profile)

    elif tool_name == "update_experience":
        if args.get("min_years") is not None:
            profile.requirements.experience_min_years = int(args.get("min_years"))
        if args.get("max_years") is not None:
            profile.requirements.experience_max_years = int(args.get("max_years"))
        result = {"success": True, "field": "experience", "value": profile.requirements.format_experience()}
        await _broadcast_requirements_update(session_id, profile)

    elif tool_name == "update_compensation":
        if args.get("salary_min") is not None:
            profile.requirements.salary_min = int(args.get("salary_min"))
        if args.get("salary_max") is not None:
            profile.requirements.salary_max = int(args.get("salary_max"))
        if args.get("equity_offered") is not None:
            profile.requirements.equity_offered = bool(args.get("equity_offered"))
        if args.get("equity_range"):
            profile.requirements.equity_range = args.get("equity_range")
        result = {"success": True, "field": "compensation", "value": profile.requirements.format_compensation()}
        await _broadcast_requirements_update(session_id, profile)

    elif tool_name == "update_visa_sponsorship":
        profile.requirements.visa_sponsorship = bool(args.get("sponsors_visa", False))
        result = {"success": True, "field": "visa_sponsorship", "value": profile.requirements.visa_sponsorship}
        await _broadcast_requirements_update(session_id, profile)

    # =========================================================================
    # Team Context Tools
    # =========================================================================

    elif tool_name == "update_team_context":
        if args.get("team_size") is not None:
            profile.requirements.team_size = int(args.get("team_size"))
        if args.get("team_composition"):
            profile.requirements.team_composition = args.get("team_composition")
        if args.get("team_seniority"):
            from models.voice_ingest.enums import TeamSeniority
            try:
                profile.requirements.team_seniority = TeamSeniority(args.get("team_seniority").lower().replace(" ", "_"))
            except ValueError:
                pass
        if args.get("reporting_to"):
            profile.requirements.reporting_to = args.get("reporting_to")
        if args.get("direct_reports") is not None:
            profile.requirements.direct_reports = int(args.get("direct_reports"))
        result = {"success": True, "field": "team_context", "value": f"Team of {profile.requirements.team_size or 'unknown'}, reporting to {profile.requirements.reporting_to or 'unknown'}"}
        await _broadcast_requirements_update(session_id, profile)

    # =========================================================================
    # Role Context Tools
    # =========================================================================

    elif tool_name == "update_hiring_urgency":
        from models.voice_ingest.enums import HiringUrgency
        urgency_str = args.get("urgency", "").lower().replace(" ", "_")
        try:
            profile.requirements.hiring_urgency = HiringUrgency(urgency_str)
        except ValueError:
            # Map common phrases to enum values
            urgency_map = {
                "asap": HiringUrgency.ASAP,
                "urgent": HiringUrgency.ASAP,
                "immediately": HiringUrgency.ASAP,
                "within month": HiringUrgency.WITHIN_MONTH,
                "soon": HiringUrgency.WITHIN_MONTH,
                "within quarter": HiringUrgency.WITHIN_QUARTER,
                "few months": HiringUrgency.WITHIN_QUARTER,
                "planning ahead": HiringUrgency.PLANNING_AHEAD,
                "no rush": HiringUrgency.PLANNING_AHEAD,
                "backfill": HiringUrgency.BACKFILL,
                "replacement": HiringUrgency.BACKFILL,
            }
            for key, val in urgency_map.items():
                if key in urgency_str:
                    profile.requirements.hiring_urgency = val
                    break
        if args.get("backfill_reason"):
            profile.requirements.backfill_reason = args.get("backfill_reason")
        result = {"success": True, "field": "hiring_urgency", "value": profile.requirements.hiring_urgency.value if profile.requirements.hiring_urgency else None}
        await _broadcast_requirements_update(session_id, profile)

    elif tool_name == "update_success_metrics":
        if args.get("metrics_30_day"):
            profile.requirements.success_metrics_30_day = args.get("metrics_30_day")
        if args.get("metrics_90_day"):
            profile.requirements.success_metrics_90_day = args.get("metrics_90_day")
        result = {"success": True, "field": "success_metrics", "value": "Updated"}
        await _broadcast_requirements_update(session_id, profile)

    elif tool_name == "update_growth_path":
        profile.requirements.growth_path = args.get("growth_path", "")
        result = {"success": True, "field": "growth_path", "value": profile.requirements.growth_path}
        await _broadcast_requirements_update(session_id, profile)

    elif tool_name == "add_deal_breaker":
        deal_breaker = args.get("deal_breaker", "")
        if not deal_breaker:
            # Return error to prompt the assistant to provide the deal_breaker value
            result = {
                "success": False,
                "error": "Missing required 'deal_breaker' argument. Please provide the deal breaker text.",
                "hint": "Call add_deal_breaker with deal_breaker='the specific deal breaker'"
            }
        elif deal_breaker not in profile.requirements.deal_breakers:
            profile.requirements.deal_breakers.append(deal_breaker)
            result = {"success": True, "field": "deal_breakers", "value": deal_breaker, "count": len(profile.requirements.deal_breakers)}
            await _broadcast_requirements_update(session_id, profile)
        else:
            result = {"success": True, "field": "deal_breakers", "message": "Already exists", "count": len(profile.requirements.deal_breakers)}

    elif tool_name == "update_ideal_background":
        profile.requirements.ideal_background = args.get("ideal_background", "")
        result = {"success": True, "field": "ideal_background", "value": profile.requirements.ideal_background}
        await _broadcast_requirements_update(session_id, profile)

    elif tool_name == "update_interview_turnaround":
        profile.requirements.interview_turnaround = args.get("turnaround", "")
        result = {"success": True, "field": "interview_turnaround", "value": profile.requirements.interview_turnaround}
        await _broadcast_requirements_update(session_id, profile)

    # =========================================================================
    # Engineering Culture Tools
    # =========================================================================

    elif tool_name == "update_eng_culture":
        if args.get("work_style"):
            profile.company.work_style = args.get("work_style")
        if args.get("decision_making"):
            profile.company.decision_making = args.get("decision_making")
        if args.get("code_review_culture"):
            profile.company.code_review_culture = args.get("code_review_culture")
        if args.get("deployment_frequency"):
            profile.company.deployment_frequency = args.get("deployment_frequency")
        if args.get("tech_debt_attitude"):
            profile.company.tech_debt_attitude = args.get("tech_debt_attitude")
        if args.get("on_call_expectations"):
            profile.company.on_call_expectations = args.get("on_call_expectations")
        if args.get("growth_trajectory"):
            profile.company.growth_trajectory = args.get("growth_trajectory")
        result = {"success": True, "field": "eng_culture", "value": "Updated"}
        await _broadcast_requirements_update(session_id, profile)

    # =========================================================================
    # Traits Tools
    # =========================================================================

    elif tool_name == "add_trait":
        from models.voice_ingest.enums import TraitPriority
        trait = CandidateTrait(
            name=args.get("name", ""),
            description=args.get("description", ""),
            priority=TraitPriority.MUST_HAVE if args.get("is_must_have", True) else TraitPriority.NICE_TO_HAVE,
            signals=args.get("signals", []),
        )
        profile.add_trait(trait)
        result = {"success": True, "trait": trait.name, "priority": trait.priority.value}
        await _broadcast_trait_update(session_id, "trait_created", trait, profile)

    elif tool_name == "remove_trait":
        trait_name = args.get("name", "")
        removed = profile.remove_trait(trait_name)
        result = {"success": removed, "trait": trait_name}
        if removed:
            await ws_hub.send_update(session_id, "trait_deleted", {"name": trait_name})
            await _broadcast_completion_update(session_id, profile)

    # =========================================================================
    # Interview Stage Tools
    # =========================================================================

    elif tool_name == "add_interview_stage":
        stage = InterviewStage(
            name=args.get("name", ""),
            description=args.get("description", ""),
            order=len(profile.interview_stages) + 1,
            duration_minutes=args.get("duration_minutes"),
            interviewer_role=args.get("interviewer_role"),
        )
        profile.add_interview_stage(stage)
        result = {"success": True, "stage": stage.name, "order": stage.order}
        await _broadcast_stage_update(session_id, "stage_created", stage, profile)

    elif tool_name == "set_interview_stages":
        # Bulk set all stages at once
        profile.interview_stages = []
        stages_data = args.get("stages", [])
        for i, stage_data in enumerate(stages_data):
            stage = InterviewStage(
                name=stage_data.get("name", f"Stage {i+1}"),
                description=stage_data.get("description", ""),
                order=i + 1,
                duration_minutes=stage_data.get("duration_minutes"),
                interviewer_role=stage_data.get("interviewer_role"),
            )
            profile.interview_stages.append(stage)
        profile.update_completion_status()
        result = {"success": True, "stages_count": len(profile.interview_stages)}
        await ws_hub.send_update(session_id, "stages_updated", {
            "stages": [s.model_dump(mode='json') for s in profile.interview_stages]
        })
        await _broadcast_completion_update(session_id, profile)

    elif tool_name == "reorder_interview_stages":
        # Reorder existing stages based on provided order
        ordered_names = args.get("stage_order", [])
        reordered = profile.reorder_interview_stages(ordered_names)
        result = {"success": reordered, "new_order": [s.name for s in profile.get_ordered_interview_stages()]}
        if reordered:
            await ws_hub.send_update(session_id, "stages_updated", {
                "stages": [s.model_dump(mode='json') for s in profile.interview_stages]
            })
            await _broadcast_completion_update(session_id, profile)

    elif tool_name == "remove_interview_stage":
        # Remove a specific interview stage
        stage_name = args.get("name", "")
        removed = profile.remove_interview_stage(stage_name)
        result = {"success": removed, "stage": stage_name}
        if removed:
            await ws_hub.send_update(session_id, "stage_deleted", {"name": stage_name})
            await _broadcast_completion_update(session_id, profile)

    # =========================================================================
    # Nuance Capture Tools
    # =========================================================================

    elif tool_name == "capture_nuance":
        from models.voice_ingest.enums import NuanceCategory
        category_str = args.get("category", "other").lower()
        try:
            category = NuanceCategory(category_str)
        except:
            category = NuanceCategory.OTHER

        nuance = NuanceCapture(
            category=category,
            insight=args.get("insight", ""),
            verbatim_quote=args.get("quote"),
        )
        profile.add_nuance(nuance)
        result = {"success": True, "category": category.value, "insight": nuance.insight[:50] + "..."}
        await ws_hub.send_update(session_id, "nuance_captured", nuance.model_dump(mode='json'))

    # =========================================================================
    # Profile Status Tools
    # =========================================================================

    elif tool_name == "mark_complete":
        profile.update_completion_status()
        if profile.is_complete:
            await ws_hub.send_update(session_id, "onboarding_complete", {
                "profile_id": profile.id,
                "completion_percentage": 100
            })
        result = {"success": True, "is_complete": profile.is_complete, "missing": profile.missing_required_fields}

    elif tool_name == "get_missing_fields":
        missing = profile.get_missing_fields()
        completion = profile.calculate_completion_percentage()
        result = {"missing_fields": missing, "completion_percentage": completion}

    # =========================================================================
    # Skip Field Tools
    # =========================================================================

    elif tool_name == "mark_field_skipped":
        # Mark a field as intentionally skipped by the user
        field_name = args.get("field_name", "")
        reason = args.get("reason", "")  # Optional reason for skipping

        if field_name and field_name not in profile.skipped_fields:
            profile.skipped_fields.append(field_name)

            # Optionally capture as a nuance if there's a reason
            if reason:
                from models.voice_ingest import NuanceCapture
                from models.voice_ingest.enums import NuanceCategory
                nuance = NuanceCapture(
                    category=NuanceCategory.OTHER,
                    insight=f"Skipped '{field_name}': {reason}",
                )
                profile.add_nuance(nuance)

        result = {
            "success": True,
            "field": field_name,
            "skipped_count": len(profile.skipped_fields),
            "skipped_fields": profile.skipped_fields
        }
        await ws_hub.send_update(session_id, "field_skipped", {"field": field_name, "reason": reason})

    elif tool_name == "get_skipped_fields":
        # Get list of all skipped fields
        result = {
            "skipped_fields": profile.skipped_fields,
            "count": len(profile.skipped_fields)
        }

    # Save profile after any update
    if result.get("success"):
        profile.update_completion_status()
        await job_profile_repo.save(profile)

    return result


async def _broadcast_requirements_update(session_id: str, profile):
    """Broadcast requirements update via WebSocket."""
    logger.info(f"Broadcasting requirements update for session {session_id}")
    sent = await ws_hub.send_update(session_id, "requirements", {
        "requirements": profile.requirements.model_dump(mode='json'),
    })
    logger.info(f"Requirements update sent to {sent} clients")
    await _broadcast_completion_update(session_id, profile)


async def _broadcast_trait_update(session_id: str, event_type: str, trait: CandidateTrait, profile):
    """Broadcast trait update via WebSocket."""
    logger.info(f"Broadcasting trait update for session {session_id}: {trait.name}")
    sent = await ws_hub.send_update(session_id, event_type, {
        "trait": trait.model_dump(mode='json'),
    })
    logger.info(f"Trait update sent to {sent} clients")
    await _broadcast_completion_update(session_id, profile)


async def _broadcast_stage_update(session_id: str, event_type: str, stage: InterviewStage, profile):
    """Broadcast interview stage update via WebSocket."""
    logger.info(f"Broadcasting stage update for session {session_id}: {stage.name}")
    sent = await ws_hub.send_update(session_id, event_type, {
        "stage": stage.model_dump(mode='json'),
    })
    logger.info(f"Stage update sent to {sent} clients")
    await _broadcast_completion_update(session_id, profile)


async def _broadcast_completion_update(session_id: str, profile):
    """Broadcast completion status update via WebSocket."""
    completion = profile.calculate_completion_percentage()
    missing = profile.get_missing_fields()
    logger.info(f"Broadcasting completion update for session {session_id}: {completion}% complete, missing: {missing}")
    await ws_hub.broadcast_completion(
        session_id=session_id,
        completion_percentage=completion,
        missing_fields=missing
    )


async def _handle_end_of_call(request: Dict[str, Any]) -> Dict[str, Any]:
    """Handle end of call report from Vapi."""
    message = request.get("message", {})
    call = message.get("call", {})
    metadata = call.get("metadata", {})
    session_id = metadata.get("sessionId")

    if session_id:
        # Mark profile as potentially complete
        profile = await job_profile_repo.get(session_id)
        if profile:
            profile.update_completion_status()
            await job_profile_repo.save(profile)

            # Notify frontend
            await ws_hub.send_update(session_id, "call_ended", {
                "is_complete": profile.is_complete,
                "completion_percentage": profile.calculate_completion_percentage(),
            })

    return {"status": "ok"}


async def _handle_transcript(request: Dict[str, Any]) -> Dict[str, Any]:
    """Handle transcript updates from Vapi."""
    message = request.get("message", {})
    call = message.get("call", {})
    metadata = call.get("metadata", {})
    session_id = metadata.get("sessionId")

    if session_id:
        transcript = message.get("transcript", "")
        role = message.get("role", "user")

        # Broadcast to frontend
        await ws_hub.broadcast_transcript(
            session_id=session_id,
            speaker="agent" if role == "assistant" else "user",
            text=transcript
        )

    return {"status": "ok"}
