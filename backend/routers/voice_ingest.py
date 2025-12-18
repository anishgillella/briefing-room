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

    # Build assistant overrides with metadata for webhook
    assistant_overrides = {
        "variableValues": variable_values,
        "firstMessage": first_message,
        "metadata": {
            "sessionId": session_id,
            "recruiterName": f"{profile.recruiter_first_name} {profile.recruiter_last_name}",
            "companyName": profile.company.name if profile.company else None,
        },
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
    team_size = ci.team_size if ci and ci.team_size else ""
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

    existing_fields = []
    if req.job_title:
        existing_fields.append(f"job_title: {req.job_title}")
    if req.location_type:
        existing_fields.append(f"location: {req.format_location()}")
    if req.experience_min_years is not None:
        existing_fields.append(f"experience: {req.format_experience()}")
    if req.salary_min:
        existing_fields.append(f"compensation: {req.format_compensation()}")
    if req.visa_sponsorship is not None:
        existing_fields.append(f"visa_sponsorship: {'Yes' if req.visa_sponsorship else 'No'}")
    if req.equity_offered is not None:
        existing_fields.append(f"equity: {'Yes' if req.equity_offered else 'No'}")
    if profile.traits:
        trait_names = [t.name for t in profile.traits[:5]]
        existing_fields.append(f"traits: {', '.join(trait_names)}")
    if profile.interview_stages:
        stage_names = [s.name for s in profile.get_ordered_interview_stages()[:5]]
        existing_fields.append(f"interview_stages: {', '.join(stage_names)}")

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
