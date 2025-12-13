"""
FastAPI server for AI Recruiting application.
Implements STREAMING PIPELINE: Extract batch → Score batch → Stream to frontend.
"""

import os
import json
import asyncio
import uuid
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import pandas as pd

# Import our processing modules
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import (
    CSV_PATH,
    RESULT_CSV_PATH,
    RANKED_OUTPUT_PATH,
    PROCESSED_JSON_PATH,
    validate_config,
    BATCH_SIZE,
    SCORING_MODEL,
)

app = FastAPI(
    title="AI Recruiting API",
    description="AI-powered candidate matching with streaming pipeline",
    version="2.0.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Processing state with streaming updates
class ProcessingState:
    def __init__(self):
        self.status = "idle"  # idle, extracting, scoring, complete, error
        self.phase = ""
        self.progress = 0
        self.message = ""
        self.candidates_total = 0
        self.candidates_extracted = 0
        self.candidates_scored = 0
        self.error = None
        self.extracted_preview: List[dict] = []
        self.scored_candidates: List[dict] = []  # Streamed as they complete
        self.algo_ranked: List[dict] = []  # Show algo-only ranking immediately

    def reset(self):
        self.__init__()


state = ProcessingState()


class StatusResponse(BaseModel):
    status: str
    phase: str
    progress: int
    message: str
    candidates_total: int
    candidates_extracted: int
    candidates_scored: int
    error: Optional[str] = None
    extracted_preview: List[dict] = []
    scored_candidates: List[dict] = []
    algo_ranked: List[dict] = []


@app.get("/")
async def root():
    return {"status": "ok", "message": "AI Recruiting API v2 - Streaming Pipeline"}


@app.get("/api/status", response_model=StatusResponse)
async def get_status():
    """Get current processing status with streamed results."""
    return StatusResponse(
        status=state.status,
        phase=state.phase,
        progress=state.progress,
        message=state.message,
        candidates_total=state.candidates_total,
        candidates_extracted=state.candidates_extracted,
        candidates_scored=state.candidates_scored,
        error=state.error,
        extracted_preview=state.extracted_preview,
        scored_candidates=state.scored_candidates,
        algo_ranked=state.algo_ranked,
    )


@app.post("/api/upload")
async def upload_csv(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload CSV and start streaming pipeline."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Only CSV files are supported")
    
    state.reset()
    state.status = "extracting"
    state.phase = "upload"
    state.progress = 5
    state.message = "Uploading file..."
    
    try:
        content = await file.read()
        with open(CSV_PATH, "wb") as f:
            f.write(content)
        
        df = pd.read_csv(CSV_PATH)
        state.candidates_total = len(df)
        state.message = f"Uploaded {state.candidates_total} candidates"
        state.progress = 10
        
        background_tasks.add_task(run_streaming_pipeline)
        
        return {"status": "started", "candidates": state.candidates_total}
        
    except Exception as e:
        state.status = "error"
        state.error = str(e)
        raise HTTPException(500, str(e))


async def run_streaming_pipeline():
    """
    STREAMING PIPELINE:
    1. Extract batch → Calculate algo score → Show preview
    2. Score batch → Stream scored candidates to frontend
    3. Repeat until all done
    """
    try:
        validate_config()
        
        # Load data
        from backend.extract_data import (
            parse_enrichment_json,
            extract_deterministic,
            extract_semantic,
            ProcessedCandidate,
        )
        from backend.score_candidates import (
            calculate_algo_score,
            evaluate_candidate,
            calculate_final_score,
            assign_tier,
            ScoredCandidate,
        )
        
        df = pd.read_csv(CSV_PATH)
        all_rows = list(df.iterrows())
        
        state.status = "extracting"
        state.phase = "extraction"
        state.message = "Extracting profiles..."
        
        all_extracted = []
        all_scored = []
        
        # Process in streaming batches
        batch_size = 5  # Smaller batches for faster streaming
        total_batches = (len(all_rows) + batch_size - 1) // batch_size
        
        for batch_idx in range(total_batches):
            start = batch_idx * batch_size
            end = min(start + batch_size, len(all_rows))
            batch_rows = all_rows[start:end]
            
            # Phase 1: Extract this batch
            state.message = f"Extracting batch {batch_idx + 1}/{total_batches}..."
            
            extracted_batch = []
            for _, row in batch_rows:
                enrichment = parse_enrichment_json(row.get("crustdata_enrichment_data", ""))
                base_data = extract_deterministic(row, enrichment)
                
                # Get semantic extraction - returns ExtractionResult with .extraction and .red_flags
                result = await extract_semantic(base_data, enrichment)
                extraction = result.extraction
                red_flags = result.red_flags
                
                # Merge
                candidate = ProcessedCandidate(
                    id=base_data["id"],
                    name=base_data["name"],
                    job_title=base_data["job_title"],
                    location_city=base_data["location_city"],
                    location_state=base_data["location_state"],
                    years_sales_experience=base_data["years_sales_experience"],
                    skills=base_data["skills"],
                    willing_to_relocate=base_data["willing_to_relocate"],
                    work_style_remote=base_data["work_style_remote"],
                    work_style_hybrid=base_data.get("work_style_hybrid", False),
                    work_style_in_person=base_data.get("work_style_in_person", False),
                    base_salary_min=base_data.get("base_salary_min"),
                    ote_min=base_data.get("ote_min"),
                    availability_days=base_data.get("availability_days"),
                    bio_summary=extraction.bio_summary,
                    sold_to_finance=extraction.sold_to_finance,
                    is_founder=extraction.is_founder,
                    startup_experience=extraction.startup_experience,
                    enterprise_experience=extraction.enterprise_experience,
                    max_acv_mentioned=extraction.max_acv_mentioned,
                    quota_attainment=extraction.quota_attainment,
                    industries=extraction.industries,
                    sales_methodologies=extraction.sales_methodologies,
                    red_flags=red_flags,
                    has_enrichment_data=bool(enrichment),
                )
                extracted_batch.append(candidate)
            
            all_extracted.extend(extracted_batch)
            state.candidates_extracted = len(all_extracted)
            
            # Calculate algo scores and show preview immediately
            for c in extracted_batch:
                c_dict = c.model_dump()
                algo_score = calculate_algo_score(c_dict)
                preview = {
                    "id": c.id,
                    "name": c.name,
                    "job_title": c.job_title,
                    "bio_summary": c.bio_summary,
                    "algo_score": algo_score,
                    "sold_to_finance": c.sold_to_finance,
                    "is_founder": c.is_founder,
                    "startup_experience": c.startup_experience,
                }
                state.extracted_preview.append(preview)
                state.algo_ranked.append(preview)
            
            # Sort algo_ranked by algo_score
            state.algo_ranked.sort(key=lambda x: x["algo_score"], reverse=True)
            
            state.progress = int(20 + (batch_idx + 1) / total_batches * 30)
            
            # Phase 2: Score this batch in parallel
            state.status = "scoring"
            state.phase = "scoring"
            state.message = f"Scoring batch {batch_idx + 1}/{total_batches}..."
            
            # Score all candidates in this batch concurrently
            score_tasks = []
            for c in extracted_batch:
                c_dict = c.model_dump()
                c_dict["red_flag_count"] = c.red_flags.red_flag_count if hasattr(c.red_flags, 'red_flag_count') else 0
                c_dict["red_flag_concerns"] = "|".join(c.red_flags.concerns) if hasattr(c.red_flags, 'concerns') else ""
                score_tasks.append(evaluate_candidate(c_dict))
            
            results = await asyncio.gather(*score_tasks, return_exceptions=True)
            
            for c, result in zip(extracted_batch, results):
                c_dict = c.model_dump()
                c_dict["red_flag_count"] = c.red_flags.red_flag_count if hasattr(c.red_flags, 'red_flag_count') else 0
                c_dict["red_flag_concerns"] = "|".join(c.red_flags.concerns) if hasattr(c.red_flags, 'concerns') else ""
                
                if isinstance(result, Exception):
                    evaluation = type('obj', (object,), {
                        'score': 50,
                        'one_line_summary': 'Evaluation error',
                        'pros': ['Profile available'],
                        'cons': ['Error during scoring'],
                        'reasoning': 'Technical error occurred.'
                    })()
                    questions = []
                else:
                    evaluation, questions = result
                
                algo_score = calculate_algo_score(c_dict)
                final_score = calculate_final_score(algo_score, evaluation.score)
                
                # Track missing fields
                from backend.score_candidates import get_missing_fields
                missing_required, missing_preferred, data_completeness = get_missing_fields(c_dict)
                
                scored = {
                    "rank": 0,
                    "tier": assign_tier(final_score),
                    "algo_score": algo_score,
                    "ai_score": evaluation.score,
                    "final_score": final_score,
                    "one_line_summary": evaluation.one_line_summary,
                    "pros": evaluation.pros,
                    "cons": evaluation.cons,
                    "reasoning": evaluation.reasoning,
                    "interview_questions": questions,
                    "id": c.id,
                    "name": c.name,
                    "job_title": c.job_title,
                    "location_city": c.location_city,
                    "location_state": c.location_state,
                    "years_sales_experience": c.years_sales_experience,
                    "bio_summary": c.bio_summary,
                    "industries": "|".join(c.industries) if c.industries else "",
                    "skills": "|".join(c.skills) if c.skills else "",
                    "sold_to_finance": c.sold_to_finance,
                    "is_founder": c.is_founder,
                    "startup_experience": c.startup_experience,
                    "enterprise_experience": c.enterprise_experience,
                    "missing_required": missing_required,
                    "missing_preferred": missing_preferred,
                    "data_completeness": data_completeness,
                }
                
                all_scored.append(scored)
                state.scored_candidates.append(scored)
            
            state.candidates_scored = len(all_scored)
            
            # Re-sort and assign ranks
            state.scored_candidates.sort(key=lambda x: x["final_score"], reverse=True)
            for i, c in enumerate(state.scored_candidates):
                c["rank"] = i + 1
            
            state.progress = int(50 + (batch_idx + 1) / total_batches * 45)
        
        # Save final results
        # Save final results to default path
        with open(RANKED_OUTPUT_PATH, "w") as f:
            json.dump(state.scored_candidates, f, indent=2)
            
        # Save to model-specific path for comparison
        # e.g., ranked_candidates_google_gemini_2_5_flash.json
        model_name = SCORING_MODEL.replace("/", "_").replace(".", "_").replace("-", "_")
        model_output_filename = f"ranked_candidates_{model_name}.json"
        model_output_path = RANKED_OUTPUT_PATH.parent / model_output_filename
        
        with open(model_output_path, "w") as f:
            json.dump(state.scored_candidates, f, indent=2)
        
        print(f"Saved results to {model_output_path}")
        
        state.progress = 100
        state.status = "complete"
        state.message = f"Ranked {len(all_scored)} candidates"
        
    except Exception as e:
        state.status = "error"
        state.error = str(e)
        state.message = f"Error: {str(e)}"
        import traceback
        traceback.print_exc()


@app.get("/api/results")
async def get_results():
    """Get ranked candidates."""
    if state.status == "complete":
        return state.scored_candidates
    elif state.status in ["extracting", "scoring"]:
        # Return partial results
        return state.scored_candidates
    raise HTTPException(400, f"Status: {state.status}")


@app.get("/api/results/csv")
async def download_results_csv():
    """Download results as CSV."""
    if not os.path.exists(RESULT_CSV_PATH):
        raise HTTPException(404, "Results not found")
    
    return FileResponse(
        RESULT_CSV_PATH,
        media_type="text/csv",
        filename="ranked_candidates.csv"
    )


@app.get("/api/candidate/{candidate_id}/questions")
async def get_interview_questions(candidate_id: str):
    """
    Generate interview questions on-demand (lazy loading).
    This avoids generating questions during initial scoring.
    """
    # Find candidate
    candidate = None
    for c in state.scored_candidates:
        if str(c.get("id")) == candidate_id:
            candidate = c
            break
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    # If questions already exist, return them
    if candidate.get("interview_questions"):
        return {"questions": candidate["interview_questions"]}
    
    # Generate questions on-demand
    from backend.models import Prompts
    from backend.score_candidates import client, SCORING_MODEL
    
    prompt = Prompts.interview_prompt(
        candidate["name"],
        candidate.get("ai_score", 50),
        candidate.get("cons", [])
    )
    
    try:
        response = await client.chat.completions.create(
            model=SCORING_MODEL,
            messages=[
                {"role": "system", "content": "Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.5,
        )
        
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        questions = data.get("questions", [])
        
        # Cache them
        candidate["interview_questions"] = questions
        
        return {"questions": questions}
        
    except Exception as e:
        return {"questions": [], "error": str(e)}


# ============================================================================
# Head-to-Head Comparison
# ============================================================================

class CompareRequest(BaseModel):
    candidate_a_id: str
    candidate_b_id: str


@app.post("/api/compare")
async def compare_candidates(request: CompareRequest):
    """Compare two candidates head-to-head with AI analysis."""
    if state.status != "complete" or not state.scored_candidates:
        raise HTTPException(status_code=400, detail="No results available")
    
    # Find candidates
    candidate_a = None
    candidate_b = None
    
    for c in state.scored_candidates:
        if c["id"] == request.candidate_a_id:
            candidate_a = c
        if c["id"] == request.candidate_b_id:
            candidate_b = c
    
    if not candidate_a or not candidate_b:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Import prompt and client
    from backend.models import Prompts
    from backend.config import SCORING_MODEL, OPENROUTER_API_KEY, OPENROUTER_BASE_URL
    from openai import AsyncOpenAI
    
    client = AsyncOpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
    )
    
    prompt = Prompts.comparison_prompt(candidate_a, candidate_b)
    
    try:
        response = await client.chat.completions.create(
            model=SCORING_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert recruiter. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        
        content = response.choices[0].message.content or "{}"
        comparison = json.loads(content)
        
        return {
            "comparison": comparison,
            "candidate_a": {"id": candidate_a["id"], "name": candidate_a["name"], "score": candidate_a["final_score"]},
            "candidate_b": {"id": candidate_b["id"], "name": candidate_b["name"], "score": candidate_b["final_score"]},
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Custom Weight Re-scoring
# ============================================================================

class WeightsRequest(BaseModel):
    experience_weight: float = 1.0      # 0-2x multiplier
    finance_sales_weight: float = 1.0   # 0-2x multiplier
    founder_weight: float = 1.0         # 0-2x multiplier
    deal_size_weight: float = 1.0       # 0-2x multiplier
    enterprise_weight: float = 1.0      # 0-2x multiplier


@app.post("/api/rescore")
async def rescore_with_weights(weights: WeightsRequest):
    """Re-calculate algorithmic scores with custom weights."""
    if state.status != "complete" or not state.scored_candidates:
        raise HTTPException(status_code=400, detail="No results available")
    
    rescored = []
    
    for c in state.scored_candidates:
        # Base scores
        exp_score = min(float(c.get("years_sales_experience", 0) or 0) * 10, 30)
        finance_score = 25 if c.get("sold_to_finance") else 0
        founder_score = 20 if c.get("is_founder") else (10 if c.get("startup_experience") else 0)
        
        # ACV scoring
        acv = 0
        max_acv = c.get("max_acv_mentioned") or 0
        if max_acv >= 100000:
            acv = 15
        elif max_acv >= 50000:
            acv = 10
        elif max_acv > 0:
            acv = 5
        
        enterprise_score = 10 if c.get("enterprise_experience") else 0
        
        # Apply weights
        weighted_algo = (
            exp_score * weights.experience_weight +
            finance_score * weights.finance_sales_weight +
            founder_score * weights.founder_weight +
            acv * weights.deal_size_weight +
            enterprise_score * weights.enterprise_weight
        )
        
        # Normalize to 0-100 (max possible with 2x weights = 200)
        max_weighted = (30 + 25 + 20 + 15 + 10) * max(
            weights.experience_weight,
            weights.finance_sales_weight,
            weights.founder_weight,
            weights.deal_size_weight,
            weights.enterprise_weight
        )
        algo_score = int(min(100, (weighted_algo / max_weighted) * 100))
        
        # Recalculate final score (AI score stays same)
        ai_score = c.get("ai_score", 50)
        final_score = round((algo_score + ai_score) / 2)
        
        rescored.append({
            **c,
            "algo_score": algo_score,
            "final_score": final_score,
            "weights_applied": True,
        })
    
    # Re-sort and re-rank
    rescored.sort(key=lambda x: x["final_score"], reverse=True)
    for i, c in enumerate(rescored):
        c["rank"] = i + 1
        # Re-assign tier
        if c["final_score"] >= 80:
            c["tier"] = "🔥 Top Match"
        elif c["final_score"] >= 65:
            c["tier"] = "✅ Strong Fit"
        elif c["final_score"] >= 50:
            c["tier"] = "⚠️ Consider"
        else:
            c["tier"] = "❌ Not a Fit"
    
    return {
        "candidates": rescored,
        "weights": weights.model_dump(),
    }


# ============================================================================
# Voice Agent Endpoints
# ============================================================================

from fastapi import WebSocket, WebSocketDisconnect, Request
from backend.voice_models import (
    ResumeUploadResponse,
)
from backend.resume_processor import (
    extract_from_resume,
    analyze_gaps,
    generate_voice_session_config,
    generate_candidate_analysis,
)
from backend.livekit_session import (
    create_voice_session_async,
    get_session as get_livekit_session,
    get_livekit_url,
    LiveKitSession,
)

# In-memory candidate storage for voice flow
voice_candidates: Dict[str, dict] = {}
TEMP_VOICE_CONFIGS: Dict[str, Any] = {}


@app.post("/api/resume/upload", response_model=ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    """Upload resume PDF and extract structured data with gap analysis."""
    
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file")
    
    # Read PDF bytes
    pdf_bytes = await file.read()
    
    # Extract data from resume
    extracted = await extract_from_resume(pdf_bytes)
    
    # Generate candidate analysis
    analysis = await generate_candidate_analysis(extracted)
    
    # Analyze gaps
    gaps = analyze_gaps(extracted, analysis)
    
    # Generate voice configuration
    voice_config = generate_voice_session_config(extracted, gaps)
    
    # Generate unique candidate ID
    candidate_id = str(uuid.uuid4())[:8]
    
    # Store for voice session
    voice_candidates[candidate_id] = {
        "extracted": extracted.model_dump(),
        "gaps": gaps.model_dump(),
        "voice_config": voice_config.model_dump() if voice_config else None
    }
    TEMP_VOICE_CONFIGS[candidate_id] = voice_config
    
    return ResumeUploadResponse(
        candidate_id=candidate_id,
        extracted_data=extracted.model_dump(),
        gaps=gaps.model_dump(),
        voice_session_config=voice_config.model_dump() if voice_config else None
    )


class LiveKitTokenRequest(BaseModel):
    candidate_id: str


class LiveKitTokenResponse(BaseModel):
    token: str
    room_name: str
    livekit_url: str
    questions: list


@app.post("/api/livekit/token", response_model=LiveKitTokenResponse)
async def get_livekit_token(request: LiveKitTokenRequest):
    """Generate a LiveKit token for a candidate to join a voice interview room."""
    
    # Get candidate data
    candidate_data = voice_candidates.get(request.candidate_id)
    if not candidate_data:
        raise HTTPException(status_code=404, detail="Candidate not found. Upload resume first.")
    
    # Get extracted data and questions
    extracted = candidate_data["extracted"]
    voice_config = candidate_data.get("voice_config") or {}
    
    # Build questions list
    questions = []
    if voice_config.get("questions_to_ask"):
        questions = [q["question_text"] for q in voice_config["questions_to_ask"]]
    else:
        # Default questions
        questions = [
            "Where are you currently based?",
            "How many years of experience do you have?",
            "What are you looking for in your next role?"
        ]
    
    # Build resume context for the agent
    resume_summary = extracted.get("summary", "")
    skills = ", ".join(extracted.get("skills", []))
    last_role = extracted.get("work_experience", [{}])[0].get("role", "Candidate") if extracted.get("work_experience") else ""
    
    resume_context = f"""
    SUMMARY: {resume_summary}
    KEY SKILLS: {skills}
    LAST ROLE: {last_role}
    """
    
    # Create LiveKit session with room metadata (async - creates room first)
    session = await create_voice_session_async(
        candidate_id=request.candidate_id,
        candidate_name=extracted.get("name", "Candidate"),
        questions=questions,
        resume_context=resume_context.strip(),
    )
    
    return LiveKitTokenResponse(
        token=session.token,
        room_name=session.room_name,
        livekit_url=get_livekit_url(),
        questions=questions,
    )


@app.get("/api/livekit/session/{candidate_id}")
async def get_voice_session_status(candidate_id: str):
    """Get the current status and extracted fields for a voice session."""
    
    session = get_livekit_session(candidate_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "candidate_id": session.candidate_id,
        "room_name": session.room_name,
        "status": session.status,
        "extracted_fields": session.extracted_fields,
        "created_at": session.created_at.isoformat(),
    }


class TranscriptExtractRequest(BaseModel):
    transcript: str


@app.post("/api/voice/extract")
async def extract_from_voice(request: TranscriptExtractRequest):
    """Extract structured fields from voice transcript in real-time."""
    
    from backend.resume_processor import extract_from_transcript
    
    if not request.transcript.strip():
        return {"extracted": {}}
    
    extracted = await extract_from_transcript(request.transcript)
    return {"extracted": extracted}


@app.get("/api/voice/candidates")
async def list_voice_candidates():
    """List all candidates who have uploaded resumes for voice onboarding."""
    
    return {
        "candidates": [
            {
                "candidate_id": cid,
                "name": data["extracted"].get("name", "Unknown"),
                "completeness": data["gaps"].get("completeness_score", 0),
                "has_gaps": bool(data["gaps"].get("missing_critical")),
            }
            for cid, data in voice_candidates.items()
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

