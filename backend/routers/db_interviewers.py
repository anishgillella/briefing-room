"""
Interviewer Analytics API Routes.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from repositories.manager_repository import get_manager_repository
from repositories.interviewer_analytics_repository import get_interviewer_analytics_repository
from services.interviewer_analyzer import get_interviewer_analyzer
from db.client import get_db

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
    
    return {"interviewers": unique_interviewers}


@router.get("/analytics/team")
async def get_team_analytics():
    """Get analytics for ALL interviewers - team-wide view for managers."""
    manager_repo = get_manager_repository()
    analytics_repo = get_interviewer_analytics_repository()
    
    managers = manager_repo.get_all()
    interviewers = [m for m in managers if m.get("role") in ["interviewer", "both", None]]
    
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
        metrics = analytics_repo.get_aggregated_metrics(interviewer["id"])
        
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
