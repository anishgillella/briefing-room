"""
Pluto router - API endpoints for candidate management and CSV processing.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from typing import List, Optional, Annotated
import asyncio

from models.candidate import Candidate, CandidateUpdate, ProcessingStatus
from services.candidate_store import (
    get_all_candidates,
    get_candidate,
    update_candidate,
    delete_candidate,
    get_candidates_count,
    clear_all_candidates,
)

import logging

router = APIRouter(prefix="/pluto", tags=["pluto"])

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ============================================================================
# Processing State (in-memory)
# ============================================================================

class ProcessingState:
    """Track CSV processing progress."""
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.status = "idle"
        self.phase = ""
        self.progress = 0
        self.message = ""
        self.candidates_total = 0
        self.candidates_extracted = 0
        self.candidates_scored = 0
        self.error = None
        self.extracted_preview = []  # For streaming extracted data
        self.scored_candidates = []  # For streaming scored candidates
        self.algo_ranked = []  # For immediate algo-only ranking
        self.job_description = ""  # JD for scoring context
        self.scoring_criteria = [] # Custom scoring criteria
        self.red_flag_indicators = [] # Custom red flags
        self.extraction_complete = False  # True when all candidates extracted
        self.latest_scored = None  # Latest AI-scored candidate for streaming

state = ProcessingState()


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/")
async def pluto_root():
    """Pluto API root."""
    return {
        "service": "pluto",
        "description": "AI-powered candidate ranking and management",
        "candidates_count": get_candidates_count()
    }


@router.post("/reset")
async def reset_state():
    """Reset processing state and clear candidates."""
    state.reset()
    clear_all_candidates()
    return {"status": "reset", "message": "System state cleared"}


class AnalyzeJDRequest(BaseModel):
    """Request body for JD analysis."""
    job_description: str


@router.post("/analyze-jd")
async def analyze_jd(request: AnalyzeJDRequest):
    """
    Analyze a job description and return suggested extraction fields.
    Frontend can use this to show/edit criteria before processing.
    """
    from services.analyze_jd import analyze_job_description, get_full_extraction_schema, BASELINE_FIELDS
    
    # Analyze the JD
    analysis = await analyze_job_description(request.job_description)
    
    # Combine with baseline fields
    all_fields = get_full_extraction_schema(analysis.suggested_fields)
    
    return {
        "role_type": analysis.role_type,
        "baseline_fields": [f.model_dump() for f in BASELINE_FIELDS],
        "jd_specific_fields": [f.model_dump() for f in analysis.suggested_fields],
        "all_fields": [f.model_dump() for f in all_fields],
        "scoring_criteria": analysis.scoring_criteria,
        "red_flag_indicators": analysis.red_flag_indicators
    }


@router.post("/upload")
async def upload_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    job_description: Annotated[Optional[str], Form()] = None,
    extraction_fields: Annotated[Optional[str], Form()] = None,
    scoring_criteria: Annotated[Optional[str], Form()] = None,
    red_flag_indicators: Annotated[Optional[str], Form()] = None,
    job_profile_id: Annotated[Optional[str], Form()] = None
):
    """
    Upload a CSV file of candidates and process them.
    Step 1: Extracts and runs Algo Scoring ONLY.
    Step 2: Frontend must call /score to trigger AI scoring.

    Optional: Pass job_profile_id to use a voice-ingest profile for context.
    This will override job_description, extraction_fields, scoring_criteria, and red_flags.
    """
    import json

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")

    # Check if already processing
    if state.status in ["extracting", "scoring"]:
        raise HTTPException(status_code=409, detail="Processing already in progress")

    # Read file content
    content = await file.read()

    # If job_profile_id is provided, load context from voice ingest profile
    if job_profile_id:
        try:
            from repositories import job_profile_repo
            from services.profile_converter import convert_profile_to_scoring_context, build_enhanced_jd

            # Fetch the job profile (sync wrapper for async)
            import asyncio
            profile = asyncio.get_event_loop().run_until_complete(job_profile_repo.get(job_profile_id))
            if not profile:
                raise HTTPException(status_code=404, detail=f"Job profile '{job_profile_id}' not found")

            logger.info(f"Using voice ingest profile: {profile.requirements.job_title or job_profile_id}")

            # Convert profile to scoring context
            profile_jd, profile_criteria, profile_red_flags, profile_fields = convert_profile_to_scoring_context(profile)

            # Override provided values with profile values
            job_description = build_enhanced_jd(profile)
            scoring_criteria = json.dumps(profile_criteria)
            red_flag_indicators = json.dumps(profile_red_flags)
            extraction_fields = json.dumps(profile_fields)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to load job profile: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load job profile: {str(e)}")

    # Parse extraction_fields if provided
    parsed_fields = None
    if extraction_fields and isinstance(extraction_fields, str) and extraction_fields.strip():
        try:
            parsed_fields = json.loads(extraction_fields)
        except json.JSONDecodeError:
            pass

    # Store JD in state for use in scoring
    state.reset()
    state.job_description = job_description
    state.status = "extracting"
    state.message = "Starting extraction..."

    # Parse and store criteria/red flags if provided
    if scoring_criteria:
        try:
            state.scoring_criteria = json.loads(scoring_criteria) if isinstance(scoring_criteria, str) else scoring_criteria
        except:
            pass

    if red_flag_indicators:
        try:
            state.red_flag_indicators = json.loads(red_flag_indicators) if isinstance(red_flag_indicators, str) else red_flag_indicators
        except:
            pass

    # Start background processing with skip_ai_scoring=True
    background_tasks.add_task(run_processing_pipeline, content, job_description, parsed_fields, True)

    return {
        "status": "started",
        "message": f"Extracting candidates from {file.filename}...",
        "job_description_provided": bool(job_description),
        "extraction_fields_provided": bool(parsed_fields),
        "job_profile_id": job_profile_id,
        "check_status_at": "/api/pluto/status"
    }


@router.post("/score")
async def start_scoring(background_tasks: BackgroundTasks):
    """
    Trigger AI scoring for the extracted candidates.
    Must be called after extraction is complete.
    """
    if not state.status == "complete" and state.extraction_complete is not True:
         # Check if we are in "waiting_confirmation" or if extraction finished
         pass
         
    # We allow triggering if extraction is complete (even if state says "waiting_confirmation" or "extracting")
    if not state.extraction_complete:
        raise HTTPException(status_code=400, detail="Extraction not yet complete or no candidates to score")
    
    if state.status == "scoring":
         raise HTTPException(status_code=409, detail="Scoring already in progress")

    # Update state
    state.status = "scoring"
    state.message = "Starting AI scoring..."
    
    # Get candidates to score (from memory/store)
    candidates_to_score = []
    # Try to get from state first
    if state.algo_ranked:
        # Re-construct basic objects or just fetch fresh from store?
        # Fetching from store is safer as it has full data
        from services.candidate_store import get_all_candidates
        candidates = get_all_candidates()
        candidates_to_score = candidates
    
    if not candidates_to_score:
        raise HTTPException(status_code=404, detail="No candidates found to score")

    # Start independent scoring task
    background_tasks.add_task(
        run_scoring_pipeline, 
        candidates_to_score, 
        state.job_description,
        state.scoring_criteria,
        state.red_flag_indicators
    )
    
    return {
        "status": "started",
        "message": f"Scoring {len(candidates_to_score)} candidates...",
        "check_status_at": "/api/pluto/status"
    }


async def run_scoring_pipeline(candidates, job_description, scoring_criteria=None, red_flag_indicators=None):
    """Refactored pipeline wrapper for just the scoring phase."""
    from services.pluto_processor import run_ai_scoring
    
    async def progress_callback(phase: str, progress: int, message: str, data: dict = None):
        state.phase = phase
        state.progress = progress
        state.message = message
        state.status = "scoring"
        if data and "candidates_scored" in data:
            state.candidates_scored = data["candidates_scored"]
        if data and "latest_scored" in data:
            state.latest_scored = data["latest_scored"]
        if phase == "complete":
            state.status = "complete"
            state.status = "complete"
            
    try:
        scored = await run_ai_scoring(candidates, progress_callback, job_description, scoring_criteria, red_flag_indicators)
        state.scored_candidates = scored
        state.status = "complete"
    except Exception as e:
        state.status = "error"
        state.error = str(e)


async def run_processing_pipeline(content: bytes, job_description: str = "", extraction_fields: list = None, skip_ai_scoring: bool = False):
    """Background task to process CSV with optional JD for scoring context and dynamic extraction fields."""
    from services.pluto_processor import process_csv_file, calculate_algo_score
    
    async def progress_callback(phase: str, progress: int, message: str, data: dict = None):
        state.phase = phase
        state.progress = progress
        state.message = message
        if phase == "extracting":
            state.status = "extracting"
            # Set total count if provided
            if data and "total_candidates" in data:
                state.candidates_total = data["total_candidates"]
            # Stream full algo table as candidates are extracted
            if data and "extracted_batch" in data:
                # Build full algo_ranked list from all extracted candidates
                algo_ranked = []
                for c in data["extracted_batch"]:
                    preview = {
                        "id": c.get("id"),
                        "name": c.get("name"),
                        "job_title": c.get("job_title", ""),
                        "bio_summary": c.get("bio_summary", ""),
                        "algo_score": c.get("algo_score", 0),  # Pre-calculated in processor
                        "sold_to_finance": c.get("sold_to_finance", False),
                        "is_founder": c.get("is_founder", False),
                        "startup_experience": c.get("startup_experience", False),
                        "enterprise_experience": c.get("enterprise_experience", False),
                        "industries": c.get("industries", []),
                        "skills": c.get("skills", []),
                        "years_experience": c.get("years_experience"),
                        "location_city": c.get("location_city", ""),
                        "location_state": c.get("location_state", ""),
                        "max_acv_mentioned": c.get("max_acv_mentioned"),
                        "quota_attainment": c.get("quota_attainment"),
                    }
                    # Copy dynamic fields
                    if extraction_fields:
                        for field in extraction_fields:
                            field_name = field.get("field_name", "")
                            if field_name and field_name in c:
                                preview[field_name] = c[field_name]
                                
                    algo_ranked.append(preview)
                # Sort by algo_score descending
                algo_ranked.sort(key=lambda x: x.get("algo_score", 0), reverse=True)
                state.algo_ranked = algo_ranked
                state.candidates_extracted = len(algo_ranked)
                
                # Mark extraction complete if flag is set
                if data.get("extraction_complete"):
                    state.extraction_complete = True
        elif phase == "waiting_confirmation":
            state.status = "waiting_confirmation"
            state.extraction_complete = True
        elif phase == "scoring":
            state.status = "scoring"
            if data and "candidates_scored" in data:
                state.candidates_scored = data["candidates_scored"]
            # Store latest scored candidate for streaming updates
            if data and "latest_scored" in data:
                state.latest_scored = data["latest_scored"]
        elif phase == "complete":
            state.status = "complete"
    
    try:
        # Pass job_description and extraction_fields to processor
        candidates = await process_csv_file(content, progress_callback, job_description, extraction_fields, skip_ai_scoring)
        
        # If we skipped scoring, we are done with this task for now
        if skip_ai_scoring:
            return

        state.candidates_total = len(candidates)
        state.candidates_extracted = len(candidates)
        state.candidates_scored = len(candidates)
        
        # Convert to Pluto frontend format (uses final_score, not combined_score)
        ranked = []
        for i, c in enumerate(candidates):
            # ... (conversion logic same as before but ensure c is dict if coming from process_csv_file)
            pass 
        # (This part is actually handled by the unified logic inside run_ai_scoring now, 
        # but process_csv_file returns dicts. Let's make sure we handle the return value correctly.)
        
        # Actually, process_csv_file returns dicts, so we can reuse the logic, BUT
        # since we refactored process_csv_file to use run_ai_scoring internally (if not skipped), 
        # it returns fully scored candidates.
        
        # Let's clean up this function to match the new flow.
        pass
        
    except Exception as e:
        state.status = "error"
        state.error = str(e)
        state.message = f"Processing failed: {str(e)}"
        
    # Correct implementation of the try block logic:
    candidates = await process_csv_file(content, progress_callback, job_description, extraction_fields, skip_ai_scoring)
    
    if skip_ai_scoring:
        return

    # If we didn't skip scoring, process the results
    ranked = []
    
    # ... mapping logic ...
    for i, c in enumerate(candidates):
             candidate_dict = {
                "rank": i + 1,
                "id": c.get("id"),
                "name": c.get("name"),
                "job_title": c.get("job_title", ""),
                "location_city": c.get("location_city", ""),
                "location_state": c.get("location_state", ""),
                "years_sales_experience": c.get("years_experience", 0),
                "bio_summary": c.get("bio_summary", ""),
                "one_line_summary": c.get("one_line_summary", ""),
                "algo_score": c.get("algo_score", 0),
                "ai_score": c.get("ai_score", 0),
                "final_score": c.get("combined_score", 0),  # Pluto uses final_score
                "tier": c.get("tier", ""),
                "pros": c.get("pros", []),
                "cons": c.get("cons", []),
                "reasoning": c.get("reasoning", ""),
                "sold_to_finance": c.get("sold_to_finance", False),
                "is_founder": c.get("is_founder", False),
                "startup_experience": c.get("startup_experience", False),
                "enterprise_experience": c.get("enterprise_experience", False),
                "missing_required": c.get("missing_required", []),
                "missing_preferred": c.get("missing_preferred", []),
                "data_completeness": c.get("completeness", 0),
                "industries": "|".join(c.get("industries", [])) if isinstance(c.get("industries"), list) else "",
                "skills": "|".join(c.get("skills", [])) if isinstance(c.get("skills"), list) else "",
                "interview_questions": c.get("interview_questions", []),
            }
             # Add dynamic fields from extraction_fields if provided
             if extraction_fields:
                for field in extraction_fields:
                    field_name = field.get("field_name", "")
                    if field_name and field_name in c:
                        candidate_dict[field_name] = c[field_name]
            
             ranked.append(candidate_dict)
            
    state.scored_candidates = ranked
    state.algo_ranked = [{"id": c["id"], "name": c["name"], "algo_score": c["algo_score"]} for c in ranked]
    state.status = "complete"
    state.message = f"Successfully processed {len(candidates)} candidates"


@router.get("/status")
async def get_status():
    """Get current processing status with streaming candidates."""
    return {
        "status": state.status,
        "phase": state.phase,
        "progress": state.progress,
        "message": state.message,
        "candidates_total": state.candidates_total,
        "candidates_extracted": state.candidates_extracted,
        "candidates_scored": state.candidates_scored,
        "error": state.error,
        "extracted_preview": state.extracted_preview,
        "scored_candidates": state.scored_candidates,
        "algo_ranked": state.algo_ranked,
        "extraction_complete": state.extraction_complete,
        "latest_scored": state.latest_scored,
    }


@router.get("/results")
async def get_results() -> List[dict]:
    """Get ranked candidates in Pluto frontend format."""
    # Return scored_candidates from state (Pluto format with final_score)
    if state.scored_candidates:
        return state.scored_candidates
    # Fallback: convert from store
    candidates = get_all_candidates()
    return [
        {
            "rank": i + 1,
            "id": c.id,
            "name": c.name,
            "job_title": c.job_title or "",
            "algo_score": c.algo_score or 0,
            "ai_score": c.ai_score or 0,
            "final_score": c.combined_score or 0,
            "tier": c.tier or "",
            "one_line_summary": c.one_line_summary or "",
            "sold_to_finance": c.sold_to_finance,
            "is_founder": c.is_founder,
            "startup_experience": c.startup_experience,
            "enterprise_experience": c.enterprise_experience,
        }
        for i, c in enumerate(candidates)
    ]


@router.get("/candidates")
async def list_candidates(
    tier: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """
    List candidates with optional filtering.
    
    Query params:
    - tier: Filter by tier (Top Tier, Strong, Good, Evaluate, Poor)
    - status: Filter by interview_status
    - limit: Max results (default 50)
    - offset: Pagination offset
    """
    candidates = get_all_candidates()
    
    # Apply filters
    if tier:
        candidates = [c for c in candidates if c.tier == tier]
    if status:
        candidates = [c for c in candidates if c.interview_status == status]
    
    total = len(candidates)
    candidates = candidates[offset:offset + limit]
    
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "candidates": [c.model_dump() for c in candidates]
    }


@router.get("/candidates/{candidate_id}")
async def get_candidate_detail(candidate_id: str) -> dict:
    """Get a specific candidate by ID."""
    candidate = get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate.model_dump()


@router.patch("/candidates/{candidate_id}")
async def update_candidate_detail(candidate_id: str, updates: CandidateUpdate) -> dict:
    """Update a candidate's data."""
    candidate = update_candidate(candidate_id, updates)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate.model_dump()


@router.delete("/candidates/{candidate_id}")
async def delete_candidate_route(candidate_id: str):
    """Delete a candidate."""
    if not delete_candidate(candidate_id):
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"status": "deleted", "id": candidate_id}


# ============================================================================
# Interview Integration
# ============================================================================

class StartInterviewResponse(BaseModel):
    room_name: str
    room_url: str
    token: str
    candidate: dict


@router.post("/candidates/{candidate_id}/interview")
async def start_interview(candidate_id: str) -> StartInterviewResponse:
    """
    Create an interview room for a candidate.
    Pre-populates the room briefing with candidate data.
    """
    candidate = get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Import room creation (avoid circular imports)
    from services.daily import daily_service
    
    # Create a new room
    room_data = await daily_service.create_room(expires_in_hours=1)
    room_name = room_data["name"]
    room_url = room_data["url"]
    
    # Generate interviewer token
    token = await daily_service.create_meeting_token(
        room_name=room_name,
        participant_name="Interviewer",
        participant_type="interviewer",
        expires_in_hours=1
    )
    
    # Set briefing data for the room (so pre-brief has candidate context)
    from routers.rooms import _briefings_cache
    _briefings_cache[room_name] = {
        "candidate_name": candidate.name,
        "role": candidate.job_title,
        "resume_summary": candidate.bio_summary,
        "notes": f"Pluto Score: {candidate.combined_score}/100 ({candidate.tier})\n\n"
                 f"Strengths: {', '.join(candidate.pros[:3]) if candidate.pros else 'N/A'}\n\n"
                 f"Concerns: {', '.join(candidate.cons[:3]) if candidate.cons else 'N/A'}\n\n"
                 f"Skills: {', '.join(candidate.skills[:5]) if candidate.skills else 'N/A'}",
        "focus_areas": candidate.missing_required if candidate.missing_required else [],
    }
    
    # Update candidate status
    update_candidate(candidate_id, {
        "interview_status": "briefing",
        "room_name": room_name
    })
    
    return StartInterviewResponse(
        room_name=room_name,
        room_url=room_url,
        token=token,
        candidate=candidate.model_dump()
    )


# ============================================================================
# Pre-Brief Integration
# ============================================================================

class PreBriefRequestModel(BaseModel):
    """Request body for generating pre-brief."""
    job_description: Optional[str] = None
    company_context: Optional[str] = None


@router.get("/candidates/{candidate_id}/prebrief")
async def get_candidate_prebrief(candidate_id: str):
    """
    Get or generate a pre-interview briefing for a candidate.
    Uses cached brief if available, otherwise generates new one.
    """
    import json
    import os
    from pathlib import Path
    
    candidate = get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Check for cached pre-brief
    prebrief_dir = Path("data/prebriefs")
    prebrief_dir.mkdir(parents=True, exist_ok=True)
    prebrief_file = prebrief_dir / f"{candidate_id}.json"
    
    if prebrief_file.exists():
        try:
            with open(prebrief_file, "r") as f:
                cached = json.load(f)
                return {"prebrief": cached, "cached": True}
        except:
            pass
    
    # No cache - need JD to generate
    if not state.job_description:
        raise HTTPException(
            status_code=400, 
            detail="No job description available. Upload candidates with a JD first."
        )
    
    # Generate pre-brief using existing prebrief service
    from routers.prebrief import generate_pre_brief, PreBriefRequest as PBRequest
    
    # Build resume text from candidate data
    resume_text = f"""
Name: {candidate.name}
Current Role: {candidate.job_title or 'N/A'} at {candidate.current_company or 'N/A'}
Location: {candidate.location_city or ''}, {candidate.location_state or ''}
Years of Experience: {candidate.years_experience or 'Unknown'}

Summary:
{candidate.bio_summary or 'No summary available'}

Skills: {', '.join(candidate.skills) if candidate.skills else 'N/A'}
Industries: {', '.join(candidate.industries) if candidate.industries else 'N/A'}
"""
    
    try:
        temp_room = f"prebrief-{candidate_id}"
        request = PBRequest(job_description=state.job_description, resume=resume_text)
        prebrief = await generate_pre_brief(temp_room, request)
        prebrief_data = prebrief.model_dump()
        
        # Cache the result
        with open(prebrief_file, "w") as f:
            json.dump(prebrief_data, f, indent=2, default=str)
        
        return {"prebrief": prebrief_data, "cached": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate pre-brief: {str(e)}")


# ============================================================================
# Enhanced Interview with LiveKit Agent
# ============================================================================

class FullInterviewResponse(BaseModel):
    """Response for full interview setup with LiveKit."""
    room_name: str
    room_url: str
    token: str
    candidate: dict
    livekit_url: Optional[str] = None


@router.post("/candidates/{candidate_id}/interview/start")
async def start_full_interview(candidate_id: str) -> FullInterviewResponse:
    """
    Create an interview room using LiveKit.
    LiveKit Agent handles voice AI (avoids OpenAI rate limits).
    
    The agent will:
    - Use OpenRouter LLM (Gemini/GPT-4o-mini)
    - Deepgram STT for speech recognition
    - ElevenLabs TTS for voice synthesis
    - Broadcast transcripts via data channel
    """
    import os
    import uuid
    import json
    
    candidate = get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Check if LiveKit is configured
    livekit_url = os.getenv("LIVEKIT_URL", "")
    livekit_api_key = os.getenv("LIVEKIT_API_KEY", "")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET", "")
    
    if not livekit_url or not livekit_api_key or not livekit_api_secret:
        # Fallback to Daily.co if LiveKit not configured
        print("[Interview] LiveKit not configured, falling back to Daily.co...")
        from services.daily import daily_service
        room_data = await daily_service.create_room(expires_in_hours=1)
        room_name = room_data["name"]
        room_url = room_data["url"]
        
        token = await daily_service.create_meeting_token(
            room_name=room_name,
            participant_name="Interviewer",
            participant_type="interviewer",
            expires_in_hours=1
        )
        
        update_candidate(candidate_id, {"interview_status": "in_progress", "room_name": room_name})
        
        return FullInterviewResponse(
            room_name=room_name,
            room_url=room_url,
            token=token,
            candidate=candidate.model_dump(),
            livekit_url=None
        )
    
    # Use LiveKit for voice session
    import jwt
    import time
    
    room_name = f"interview-{candidate_id[:8]}-{uuid.uuid4().hex[:8]}"
    
    # Build room metadata for the agent
    room_metadata = {
        "candidate_id": candidate_id,
        "candidate_name": candidate.name,
        "mode": "interview",
        "resume_context": candidate.bio_summary or "",
        "job_title": candidate.job_title or "",
        "skills": candidate.skills[:10] if candidate.skills else [],
    }
    
    # Generate LiveKit token for interviewer
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
    
    print(f"[Interview] Created LiveKit room '{room_name}' for candidate '{candidate.name}'")
    
    # Update candidate status
    update_candidate(candidate_id, {"interview_status": "in_progress", "room_name": room_name})
    
    return FullInterviewResponse(
        room_name=room_name,
        room_url=livekit_url,  # Use LiveKit URL instead of Daily URL
        token=token,
        candidate=candidate.model_dump(),
        livekit_url=livekit_url
    )


# ============================================================================
# Post-Interview Analytics
# ============================================================================

class SaveAnalyticsRequest(BaseModel):
    """Request body for saving interview analytics."""
    transcript: str
    analytics: Optional[dict] = None


@router.post("/candidates/{candidate_id}/analytics")
async def save_interview_analytics(candidate_id: str, request: SaveAnalyticsRequest):
    """
    Save interview transcript and generate analytics.
    Updates candidate with interview score and recommendation.
    """
    import json
    import traceback
    from pathlib import Path
    from datetime import datetime
    
    try:
        candidate = get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save transcript
        transcript_dir = Path("data/transcripts")
        transcript_dir.mkdir(parents=True, exist_ok=True)
        with open(transcript_dir / f"{candidate_id}_{timestamp}.txt", "w") as f:
            f.write(request.transcript)
        
        # Generate deep analytics
        analytics_data = request.analytics
        if not analytics_data:
            from services.pluto_processor import generate_deep_analytics
            try:
                # Get JD context if available (from global state or candidate)
                jd_text = state.job_description if hasattr(state, 'job_description') else ""
                
                logger.info(f"Generating deep analytics for candidate {candidate_id}...")
                deep_analytics = await generate_deep_analytics(
                    transcript=request.transcript,
                    candidate_data=candidate.model_dump(),
                    job_description=jd_text
                )
                
                if deep_analytics:
                    analytics_data = deep_analytics.model_dump()
                else:
                    analytics_data = {"error": "Failed to generate analytics"}
                    
            except Exception as e:
                logger.error(f"Analytics generation error: {e}")
                traceback.print_exc()
                analytics_data = {"error": str(e)}
        
        # Save analytics
        analytics_dir = Path("data/analytics")
        analytics_dir.mkdir(parents=True, exist_ok=True)
        with open(analytics_dir / f"{candidate_id}_{timestamp}.json", "w") as f:
            json.dump(analytics_data, f, indent=2, default=str)
        
        # Update candidate with high-level metrics
        update_data = {
            "interview_status": "completed",
            "interview_score": analytics_data.get("overall_score"),
            "recommendation": analytics_data.get("recommendation")
        }
        update_candidate(candidate_id, update_data)
        
        # Create or get interview record for analytics linking
        # First, we need to get the database UUID for this candidate (JSON ID -> DB UUID)
        interview_id = None
        db_candidate_id = None

        try:
            from repositories.interview_repository import InterviewRepository
            from repositories.candidate_repository import CandidateRepository

            interview_repo = InterviewRepository()
            candidate_repo = CandidateRepository()

            # First, try to look up the DB candidate by json_id (reliable)
            db_candidate = candidate_repo.get_by_json_id(candidate_id)
            if db_candidate:
                db_candidate_id = db_candidate.get("id")
                logger.info(f"Resolved candidate JSON ID '{candidate_id}' to DB UUID: {db_candidate_id}")
            else:
                # Fallback: Look up the DB candidate by name (less reliable)
                candidate_name = candidate.name if hasattr(candidate, 'name') else candidate.get('name', '')
                if candidate_name:
                    db_candidate = candidate_repo.get_by_name(candidate_name)
                    if db_candidate:
                        db_candidate_id = db_candidate.get("id")
                        logger.info(f"Resolved candidate '{candidate_name}' to DB UUID: {db_candidate_id} (via name fallback)")
                        # Update the json_id for future lookups
                        try:
                            candidate_repo.set_json_id(db_candidate_id, candidate_id)
                            logger.info(f"Updated json_id '{candidate_id}' for candidate {db_candidate_id}")
                        except Exception as e:
                            logger.warning(f"Failed to update json_id: {e}")

            # If we have a DB candidate ID, work with interviews
            if db_candidate_id:
                # Check if interview already exists for this candidate
                existing_interviews = interview_repo.get_candidate_interviews(db_candidate_id)
                active_interview = next(
                    (i for i in existing_interviews if i.get("status") in ["active", "in_progress"]),
                    None
                )

                if active_interview:
                    # Complete existing interview and use its ID
                    interview_repo.complete_interview(active_interview["id"])
                    interview_id = active_interview["id"]
                    logger.info(f"Completed existing interview: {interview_id}")
                else:
                    # Create a new interview record
                    new_interview = interview_repo.create({
                        "candidate_id": db_candidate_id,
                        "stage": "round_1",
                        "status": "completed",
                    })
                    if new_interview:
                        interview_id = new_interview["id"]
                        logger.info(f"Created new interview: {interview_id}")
            else:
                candidate_name = candidate.name if hasattr(candidate, 'name') else candidate.get('name', 'Unknown')
                logger.warning(f"Could not find DB candidate for JSON ID '{candidate_id}' (name: '{candidate_name}') - analytics will only be saved locally")
        except Exception as e:
            logger.warning(f"Failed to create/update interview record: {e}")
        
        # Fallback: generate a deterministic interview_id if DB failed
        if not interview_id:
            import hashlib
            fallback_id = hashlib.md5(f"{candidate_id}_{timestamp}".encode()).hexdigest()
            interview_id = f"{fallback_id[:8]}-{fallback_id[8:12]}-{fallback_id[12:16]}-{fallback_id[16:20]}-{fallback_id[20:32]}"
            logger.info(f"Using fallback interview_id: {interview_id}")
        
        # Save analytics to database for persistence
        if analytics_data and "error" not in analytics_data and interview_id:
            try:
                from repositories.analytics_repository import AnalyticsRepository
                analytics_repo = AnalyticsRepository()

                # Save the full analytics data to the database
                saved = analytics_repo.save_analytics(interview_id, analytics_data)
                if saved:
                    logger.info(f"Analytics persisted to database for interview {interview_id[:8]}...")
                else:
                    logger.warning(f"Failed to persist analytics to database for interview {interview_id[:8]}")
            except Exception as e:
                logger.warning(f"Failed to save analytics to database: {e}")

        # Generate interviewer analytics if we have analytics data
        interviewer_analytics = None
        if analytics_data and "error" not in analytics_data:
            try:
                from services.interviewer_analyzer import get_interviewer_analyzer
                from repositories.interviewer_analytics_repository import get_interviewer_analytics_repository

                analyzer = get_interviewer_analyzer()
                questions_list = []

                # Extract questions from analytics
                if "question_analytics" in analytics_data:
                    questions_list = [qa.get("question", "") for qa in analytics_data.get("question_analytics", [])]

                if questions_list or request.transcript:
                    logger.info(f"Generating interviewer analytics for interview {interview_id[:8]}...")
                    interviewer_result = await analyzer.analyze_interview(
                        transcript=request.transcript,
                        questions=questions_list
                    )
                    interviewer_analytics = interviewer_result.model_dump()
                    logger.info(f"Interviewer analytics generated. Score: {interviewer_result.overall_score}")

                    # Save interviewer analytics to database (only if we have a valid DB interview_id)
                    # The save_analytics method requires interview_id, interviewer_id, and the analytics result
                    # Check if interview_id looks like a valid UUID (not a fallback hash)
                    is_valid_uuid = interview_id and len(interview_id) == 36 and interview_id.count('-') == 4
                    if is_valid_uuid:
                        try:
                            interviewer_analytics_repo = get_interviewer_analytics_repository()
                            # Use a placeholder interviewer_id if not specified
                            # In a real scenario, this would come from the request
                            placeholder_interviewer_id = "00000000-0000-0000-0000-000000000000"
                            interviewer_analytics_repo.save_analytics(
                                interview_id=interview_id,
                                interviewer_id=placeholder_interviewer_id,
                                analytics=interviewer_result
                            )
                            logger.info(f"Interviewer analytics persisted for interview {interview_id[:8]}")
                        except Exception as e:
                            logger.warning(f"Failed to persist interviewer analytics: {e}")
            except Exception as e:
                logger.warning(f"Failed to generate interviewer analytics: {e}")

        return {"status": "saved", "analytics": analytics_data, "interview_id": interview_id, "interviewer_analytics": interviewer_analytics}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
