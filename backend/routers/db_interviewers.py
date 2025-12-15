"""
Interviewer Analytics API Routes.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from repositories.manager_repository import get_manager_repository
from repositories.interviewer_analytics_repository import get_interviewer_analytics_repository
from services.interviewer_analyzer import get_interviewer_analyzer
from db.client import get_db
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interviewers", tags=["interviewers"])


@router.get("")
async def list_interviewers():
    """Get all interviewers (for dropdown). These are hiring managers with interviewer role."""
    repo = get_manager_repository()
    managers = repo.get_all()
    
    # Filter to those who can interview (role = 'interviewer' or 'both')
    interviewers = [m for m in managers if m.get("role") in ["interviewer", "both", None]]

    # Deduplicate by Name (since we have multiple IDs for same person in DB)
    unique_interviewers = []
    seen_names = set()
    for interviewer in interviewers:
        if interviewer["name"] not in seen_names:
            unique_interviewers.append(interviewer)
            seen_names.add(interviewer["name"])
    
    logger.info(f"[INTERVIEWER_LIST] Found {len(unique_interviewers)} unique interviewers")
    return {"interviewers": unique_interviewers}


@router.get("/analytics/team")
async def get_team_analytics():
    """Get analytics for ALL interviewers - team-wide view for managers."""
    logger.info("[INTERVIEWER_ANALYTICS] 📊 Fetching team analytics")
    manager_repo = get_manager_repository()
    analytics_repo = get_interviewer_analytics_repository()
    
    managers = manager_repo.get_all()
    interviewers = [m for m in managers if m.get("role") in ["interviewer", "both", None]]
    logger.info(f"[INTERVIEWER_ANALYTICS] Found {len(interviewers)} interviewers")
    
    team_data = []
    team_totals = {
        "total_interviews": 0,
        "avg_question_quality": 0,
        "avg_topic_coverage": 0,
        "avg_consistency": 0,
        "avg_bias_score": 0,
        "avg_candidate_experience": 0,
        "avg_overall": 0
    }
    
    for interviewer in interviewers:
        logger.info(f"[INTERVIEWER_ANALYTICS] Fetching metrics for '{interviewer.get('name')}' (ID: {interviewer['id']})")
        metrics = analytics_repo.get_aggregated_metrics(interviewer["id"])
        logger.info(f"[INTERVIEWER_ANALYTICS]   → Total interviews: {metrics['total_interviews']}")
        logger.info(f"[INTERVIEWER_ANALYTICS]   → Avg overall: {metrics['avg_overall']}")
        
        if metrics["total_interviews"] > 0:
            team_data.append({
                "interviewer": {
                    "id": interviewer["id"],
                    "name": interviewer["name"],
                    "team": interviewer.get("team"),
                    "department": interviewer.get("department")
                },
                "metrics": metrics
            })
            
            # Aggregate for team totals
            team_totals["total_interviews"] += metrics["total_interviews"]
    
    # Calculate team averages
    if team_data:
        n = len(team_data)
        team_totals["avg_question_quality"] = round(sum(d["metrics"]["avg_question_quality"] for d in team_data) / n, 1)
        team_totals["avg_topic_coverage"] = round(sum(d["metrics"]["avg_topic_coverage"] for d in team_data) / n, 1)
        team_totals["avg_consistency"] = round(sum(d["metrics"]["avg_consistency"] for d in team_data) / n, 1)
        team_totals["avg_bias_score"] = round(sum(d["metrics"]["avg_bias_score"] for d in team_data) / n, 1)
        team_totals["avg_candidate_experience"] = round(sum(d["metrics"]["avg_candidate_experience"] for d in team_data) / n, 1)
        team_totals["avg_overall"] = round(sum(d["metrics"]["avg_overall"] for d in team_data) / n, 1)
    
    logger.info(f"[INTERVIEWER_ANALYTICS] ✅ Team totals: {team_totals}")
    logger.info(f"[INTERVIEWER_ANALYTICS] ✅ Interviewers with data: {len(team_data)}")
    
    return {
        "team_averages": team_totals,
        "interviewers": team_data
    }


@router.get("/{interviewer_id}")
async def get_interviewer(interviewer_id: str):
    """Get a single interviewer by ID."""
    repo = get_manager_repository()
    interviewer = repo.get_by_id(interviewer_id)
    if not interviewer:
        raise HTTPException(status_code=404, detail="Interviewer not found")
    return interviewer


@router.get("/{interviewer_id}/analytics")
async def get_interviewer_analytics(interviewer_id: str):
    """Get aggregated analytics for an interviewer."""
    manager_repo = get_manager_repository()
    analytics_repo = get_interviewer_analytics_repository()
    
    # Verify interviewer exists
    interviewer = manager_repo.get_by_id(interviewer_id)
    if not interviewer:
        raise HTTPException(status_code=404, detail="Interviewer not found")
    
    # Get aggregated metrics
    metrics = analytics_repo.get_aggregated_metrics(interviewer_id)
    
    # Get recent individual analytics
    recent = analytics_repo.get_by_interviewer(interviewer_id, limit=10)
    
    return {
        "interviewer": {
            "id": interviewer_id,
            "name": interviewer.get("name"),
            "team": interviewer.get("team"),
            "department": interviewer.get("department")
        },
        "aggregated": metrics,
        "recent_interviews": recent
    }


@router.get("/{interviewer_id}/analytics/history")
async def get_interviewer_analytics_history(interviewer_id: str, limit: int = 20):
    """Get analytics history for an interviewer."""
    analytics_repo = get_interviewer_analytics_repository()
    history = analytics_repo.get_by_interviewer(interviewer_id, limit=limit)
    return {"history": history}


@router.get("/interviews/{interview_id}/analytics")
async def get_interview_analytics(interview_id: str):
    """Get interviewer analytics for a specific interview."""
    analytics_repo = get_interviewer_analytics_repository()
    analytics = analytics_repo.get_by_interview(interview_id)
    
    if not analytics:
        raise HTTPException(status_code=404, detail="Analytics not found for this interview")
    
    return {"analytics": analytics}


@router.post("/interviews/{interview_id}/analyze")
async def analyze_interview(interview_id: str, background_tasks: BackgroundTasks):
    """Trigger LLM analysis for an interview. Runs in background."""
    db = get_db()
    
    # Get interview
    result = db.table("interviews").select("*, transcripts(*)").eq("id", interview_id).single().execute()
    interview = result.data
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    interviewer_id = interview.get("interviewer_id")
    if not interviewer_id:
        raise HTTPException(status_code=400, detail="Interview has no interviewer assigned")
    
    # Check if already analyzed
    analytics_repo = get_interviewer_analytics_repository()
    existing = analytics_repo.get_by_interview(interview_id)
    if existing:
        return {"status": "already_analyzed", "analytics": existing}
    
    # Schedule background analysis
    background_tasks.add_task(
        _run_analysis,
        interview_id=interview_id,
        interviewer_id=interviewer_id,
        interview=interview
    )
    
    return {"status": "analysis_started", "interview_id": interview_id}


async def _run_analysis(interview_id: str, interviewer_id: str, interview: dict):
    """Background task to run LLM analysis."""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Extract transcript text
        transcripts = interview.get("transcripts") or []
        transcript_text = ""
        questions = []
        
        for t in transcripts:
            if t.get("speaker") == "interviewer":
                text = t.get("text", "")
                transcript_text += f"Interviewer: {text}\n"
                if "?" in text:
                    questions.append(text)
            else:
                transcript_text += f"Candidate: {t.get('text', '')}\n"
        
        if not transcript_text:
            logger.warning(f"No transcript found for interview {interview_id}")
            return
        
        # Run analysis
        analyzer = get_interviewer_analyzer()
        result = await analyzer.analyze_interview(transcript_text, questions)
        
        # Save to database
        analytics_repo = get_interviewer_analytics_repository()
        analytics_repo.save_analytics(interview_id, interviewer_id, result)
        
        logger.info(f"Successfully analyzed interview {interview_id}. Score: {result.overall_score}")
        
    except Exception as e:
        logger.error(f"Failed to analyze interview {interview_id}: {e}")


# ============================================================================
# NEW: Interview list and detail endpoints for Interviewer Tab
# ============================================================================

@router.get("/{interviewer_id}/interviews")
async def get_interviewer_interviews(interviewer_id: str, limit: int = 50):
    """
    Get all interviews conducted by an interviewer.
    Returns list with candidate info and scores for the Interviewer Tab.
    """
    logger.info(f"[INTERVIEWER_INTERVIEWS] Fetching interviews for interviewer {interviewer_id}")
    db = get_db()
    
    # Query interviews where this person was the interviewer
    result = db.table("interviews").select(
        "id, candidate_id, status, stage, started_at, ended_at, duration_sec, score, "
        "candidates(id, name, job_title, current_company, combined_score)"
    ).eq("interviewer_id", interviewer_id).order("created_at", desc=True).limit(limit).execute()
    
    interviews = result.data or []
    logger.info(f"[INTERVIEWER_INTERVIEWS] Found {len(interviews)} interviews")
    
    # Format for frontend
    interview_list = []
    for interview in interviews:
        candidate = interview.get("candidates") or {}
        interview_list.append({
            "interview_id": interview["id"],
            "candidate_id": interview["candidate_id"],
            "candidate_name": candidate.get("name", "Unknown"),
            "candidate_title": candidate.get("job_title"),
            "candidate_company": candidate.get("current_company"),
            "candidate_score": candidate.get("combined_score"),
            "interview_score": interview.get("score"),
            "stage": interview["stage"],
            "status": interview["status"],
            "started_at": interview.get("started_at"),
            "ended_at": interview.get("ended_at"),
            "duration_sec": interview.get("duration_sec")
        })
    
    return {"interviews": interview_list, "total": len(interview_list)}


@router.get("/interviews/{interview_id}/full")
async def get_full_interview_details(interview_id: str):
    """
    Get full interview details including:
    - Interview metadata
    - Candidate info
    - Transcript
    - Candidate analytics (post-interview assessment)
    - Interviewer analytics (interviewer performance)
    
    Used when clicking on an interview in the Interviewer Tab.
    """
    logger.info(f"[INTERVIEW_FULL] Fetching full details for interview {interview_id}")
    db = get_db()
    
    # Get interview with all related data
    result = db.table("interviews").select(
        "*, candidates(id, name, email, job_title, current_company, bio_summary, skills, "
        "combined_score, interview_score, recommendation), "
        "transcripts(turns, full_text), "
        "analytics(overall_score, recommendation, synthesis, question_analytics, "
        "skill_evidence, behavioral_profile, communication_metrics)"
    ).eq("id", interview_id).single().execute()
    
    interview = result.data
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Get interviewer analytics separately (different table)
    analytics_repo = get_interviewer_analytics_repository()
    interviewer_analytics = analytics_repo.get_by_interview(interview_id)
    
    logger.info(f"[INTERVIEW_FULL] Interview found: status={interview.get('status')}, score={interview.get('score')}")
    
    # Format response
    candidate = interview.get("candidates") or {}
    transcript_data = interview.get("transcripts")
    if isinstance(transcript_data, list) and transcript_data:
        transcript_data = transcript_data[0]
    
    candidate_analytics = interview.get("analytics")
    if isinstance(candidate_analytics, list) and candidate_analytics:
        candidate_analytics = candidate_analytics[0]
    
    return {
        "interview": {
            "id": interview["id"],
            "stage": interview["stage"],
            "status": interview["status"],
            "score": interview.get("score"),
            "started_at": interview.get("started_at"),
            "ended_at": interview.get("ended_at"),
            "duration_sec": interview.get("duration_sec")
        },
        "candidate": {
            "id": candidate.get("id"),
            "name": candidate.get("name"),
            "email": candidate.get("email"),
            "job_title": candidate.get("job_title"),
            "current_company": candidate.get("current_company"),
            "bio_summary": candidate.get("bio_summary"),
            "skills": candidate.get("skills", []),
            "combined_score": candidate.get("combined_score"),
            "interview_score": candidate.get("interview_score"),
            "recommendation": candidate.get("recommendation")
        },
        "transcript": {
            "turns": transcript_data.get("turns", []) if transcript_data else [],
            "full_text": transcript_data.get("full_text") if transcript_data else None
        },
        "candidate_analytics": candidate_analytics,
        "interviewer_analytics": interviewer_analytics
    }

