"""
Pluto router - API endpoints for candidate management and CSV processing.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import asyncio

from models.candidate import Candidate, CandidateUpdate, ProcessingStatus
from services.candidate_store import (
    get_all_candidates,
    get_candidate,
    update_candidate,
    delete_candidate,
    get_candidates_count,
)

router = APIRouter(prefix="/pluto", tags=["pluto"])


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


@router.post("/upload")
async def upload_csv(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...),
    job_description: str = Form("")
):
    """
    Upload a CSV file of candidates and process them.
    Optionally accepts a job_description to customize AI scoring.
    Returns immediately and processes in the background.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    # Check if already processing
    if state.status in ["extracting", "scoring"]:
        raise HTTPException(status_code=409, detail="Processing already in progress")
    
    # Read file content
    content = await file.read()
    
    # Store JD in state for use in scoring
    state.reset()
    state.job_description = job_description
    state.status = "extracting"
    state.message = "Starting processing..."
    
    # Start background processing with JD
    background_tasks.add_task(run_processing_pipeline, content, job_description)
    
    return {
        "status": "started",
        "message": f"Processing {file.filename}...",
        "job_description_provided": bool(job_description),
        "check_status_at": "/api/pluto/status"
    }


async def run_processing_pipeline(content: bytes, job_description: str = ""):
    """Background task to process CSV with optional JD for scoring context."""
    from services.pluto_processor import process_csv_file, calculate_algo_score
    
    async def progress_callback(phase: str, progress: int, message: str, data: dict = None):
        state.phase = phase
        state.progress = progress
        state.message = message
        if phase == "extracting":
            state.status = "extracting"
            # Stream algo scores as candidates are extracted
            if data and "extracted_batch" in data:
                for c in data["extracted_batch"]:
                    algo_score = calculate_algo_score(c)
                    preview = {
                        "id": c.get("id"),
                        "name": c.get("name"),
                        "job_title": c.get("job_title", ""),
                        "bio_summary": c.get("bio_summary", ""),
                        "algo_score": algo_score,
                        "sold_to_finance": c.get("sold_to_finance", False),
                        "is_founder": c.get("is_founder", False),
                        "startup_experience": c.get("startup_experience", False),
                    }
                    state.extracted_preview.append(preview)
                    state.algo_ranked.append(preview)
                # Sort algo_ranked by score
                state.algo_ranked.sort(key=lambda x: x.get("algo_score", 0), reverse=True)
                state.candidates_extracted = len(state.algo_ranked)
        elif phase == "scoring":
            state.status = "scoring"
            if data and "candidates_scored" in data:
                state.candidates_scored = data["candidates_scored"]
        elif phase == "complete":
            state.status = "complete"
    
    try:
        # Pass job_description to processor for AI scoring context
        candidates = await process_csv_file(content, progress_callback, job_description)
        state.candidates_total = len(candidates)
        state.candidates_extracted = len(candidates)
        state.candidates_scored = len(candidates)
        
        # Convert to Pluto frontend format (uses final_score, not combined_score)
        ranked = []
        for i, c in enumerate(candidates):
            ranked.append({
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
            })
        
        state.scored_candidates = ranked
        state.algo_ranked = [{"id": c["id"], "name": c["name"], "algo_score": c["algo_score"]} for c in ranked]
        state.status = "complete"
        state.message = f"Successfully processed {len(candidates)} candidates"
    except Exception as e:
        state.status = "error"
        state.error = str(e)
        state.message = f"Processing failed: {str(e)}"


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
    room_data = await daily_service.create_room(expires_in_minutes=60)
    room_name = room_data["name"]
    room_url = room_data["url"]
    
    # Generate interviewer token
    token_data = await daily_service.create_meeting_token(
        room_name=room_name,
        user_name="Interviewer",
        is_owner=True
    )
    token = token_data["token"]
    
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
