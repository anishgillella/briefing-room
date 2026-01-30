"""
Manager Dashboard API Routes.
"""
from fastapi import APIRouter, HTTPException
from repositories.manager_repository import get_manager_repository

router = APIRouter(prefix="/api/managers", tags=["managers"])


@router.get("")
async def list_managers():
    """Get all hiring managers (for selector dropdown)."""
    repo = get_manager_repository()
    managers = repo.get_all()
    return {"managers": managers}


@router.get("/metrics/team")
async def get_team_metrics(days: int = 90):
    """Get aggregated hiring funnel metrics for the entire organization (team-wide view)."""
    from db.client import get_db
    from datetime import datetime, timedelta
    
    db = get_db()
    start_date = (datetime.now() - timedelta(days=days)).isoformat()
    
    # Get all candidates created in the period
    candidates_result = db.table("candidates").select(
        "id, pipeline_status, final_decision, created_at, decided_at"
    ).gte("created_at", start_date).execute()
    candidates = candidates_result.data or []
    
    # Get all interviews in the period
    interviews_result = db.table("interviews").select(
        "id, candidate_id, status, started_at, ended_at, created_at"
    ).gte("created_at", start_date).execute()
    interviews = interviews_result.data or []
    
    # Calculate funnel
    reviewed = len(candidates)
    
    # Interviewed = candidates who have at least one completed interview
    interviewed_candidate_ids = set(
        i["candidate_id"] for i in interviews 
        if i.get("status") == "completed"
    )
    interviewed = len(interviewed_candidate_ids)
    
    # Offered = candidates with decision_pending, accepted, or rejected pipeline status
    offered = len([c for c in candidates if c.get("pipeline_status") in ["decision_pending", "accepted", "rejected"]])
    
    # Hired = candidates with final_decision = accepted
    hired = len([c for c in candidates if c.get("final_decision") == "accepted"])
    
    # Calculate rates
    interview_rate = interviewed / reviewed if reviewed > 0 else 0
    offer_rate = offered / interviewed if interviewed > 0 else 0
    hire_rate = hired / offered if offered > 0 else 0
    
    # Calculate timing metrics
    time_to_first_interview_list = []
    time_in_pipeline_list = []
    
    for candidate in candidates:
        candidate_id = candidate.get("id")
        candidate_created = candidate.get("created_at")
        
        # Time to first interview
        candidate_interviews = [
            i for i in interviews 
            if i.get("candidate_id") == candidate_id and i.get("started_at")
        ]
        if candidate_interviews and candidate_created:
            try:
                first_interview = min(candidate_interviews, key=lambda x: x.get("started_at", ""))
                started = datetime.fromisoformat(first_interview["started_at"].replace("Z", "+00:00"))
                created = datetime.fromisoformat(candidate_created.replace("Z", "+00:00"))
                days_diff = (started - created).days
                if days_diff >= 0:
                    time_to_first_interview_list.append(days_diff)
            except:
                pass
        
        # Time in pipeline
        if candidate.get("decided_at") and candidate_created:
            try:
                decided = datetime.fromisoformat(candidate["decided_at"].replace("Z", "+00:00"))
                created = datetime.fromisoformat(candidate_created.replace("Z", "+00:00"))
                days_diff = (decided - created).days
                if days_diff >= 0:
                    time_in_pipeline_list.append(days_diff)
            except:
                pass
    
    avg_time_to_interview = sum(time_to_first_interview_list) / len(time_to_first_interview_list) if time_to_first_interview_list else 0
    avg_time_in_pipeline = sum(time_in_pipeline_list) / len(time_in_pipeline_list) if time_in_pipeline_list else 0
    interviews_per_candidate = len(interviews) / interviewed if interviewed > 0 else 0
    
    repo = get_manager_repository()
    managers = repo.get_all()
    
    return {
        "period_days": days,
        "total_managers": len(managers),
        "metrics": {
            "funnel": {
                "reviewed": reviewed,
                "interviewed": interviewed,
                "offered": offered,
                "hired": hired
            },
            "timing": {
                "time_to_first_interview": round(avg_time_to_interview, 1),
                "time_in_pipeline": round(avg_time_in_pipeline, 1),
                "interviews_per_candidate": round(interviews_per_candidate, 1)
            },
            "rates": {
                "interview_rate": round(interview_rate, 3),
                "offer_rate": round(offer_rate, 3),
                "hire_rate": round(hire_rate, 3)
            }
        }
    }



@router.get("/{manager_id}")
async def get_manager(manager_id: str):
    """Get a single manager by ID."""
    repo = get_manager_repository()
    manager = repo.get_by_id(manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    return manager


@router.get("/{manager_id}/metrics")
async def get_manager_metrics(manager_id: str, days: int = 90):
    """Get hiring funnel metrics for a manager."""
    repo = get_manager_repository()
    
    # Verify manager exists
    manager = repo.get_by_id(manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    
    # Calculate metrics
    metrics = repo.calculate_metrics(manager_id, days)
    
    # Compare to benchmark
    team = manager.get("team")
    comparisons = repo.compare_to_benchmark(metrics, team) if team else {}
    
    # Generate recommendations
    recommendations = repo.generate_recommendations(metrics, comparisons)
    
    return {
        "manager": {
            "id": manager_id,
            "name": manager.get("name"),
            "team": team,
            "department": manager.get("department")
        },
        "period_days": days,
        "metrics": metrics,
        "comparisons": comparisons,
        "recommendations": recommendations
    }


@router.get("/{manager_id}/recommendations")
async def get_manager_recommendations(manager_id: str, days: int = 90):
    """Get AI-generated recommendations for a manager."""
    repo = get_manager_repository()
    
    # Verify manager exists
    manager = repo.get_by_id(manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    
    # Calculate metrics and comparisons
    metrics = repo.calculate_metrics(manager_id, days)
    team = manager.get("team")
    comparisons = repo.compare_to_benchmark(metrics, team) if team else {}
    
    # Generate recommendations
    recommendations = repo.generate_recommendations(metrics, comparisons)
    
    return {
        "manager_id": manager_id,
        "recommendations": recommendations
    }
