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
    red_flag_indicators: Annotated[Optional[str], Form()] = None
):
    """
    Upload a CSV file of candidates and process them.
    Step 1: Extracts and runs Algo Scoring ONLY.
    Step 2: Frontend must call /score to trigger AI scoring.
    """
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")
    
    # Check if already processing
    if state.status in ["extracting", "scoring"]:
        raise HTTPException(status_code=409, detail="Processing already in progress")
    
    # Read file content
    content = await file.read()
    
    # Parse extraction_fields if provided
    parsed_fields = None
    if extraction_fields and isinstance(extraction_fields, str) and extraction_fields.strip():
        try:
            import json
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
            state.scoring_criteria = json.loads(scoring_criteria)
        except:
            pass
            
    if red_flag_indicators:
        try:
            state.red_flag_indicators = json.loads(red_flag_indicators)
        except:
            pass
            
    # Start background processing with skip_ai_scoring=True
    background_tasks.add_task(run_processing_pipeline, content, job_description, parsed_fields, True)
    
    return {
        "status": "started",
        "message": f"Extracting candidates from {file.filename}...",
        "job_description_provided": bool(job_description),
        "extraction_fields_provided": bool(parsed_fields),
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
