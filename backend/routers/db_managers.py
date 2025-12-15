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
    """Get aggregated hiring funnel metrics for ALL managers (team-wide view)."""
    repo = get_manager_repository()
    managers = repo.get_all()
    
    # Aggregate funnel counts
    total_funnel = {
        "reviewed": 0,
        "interviewed": 0,
        "offered": 0,
        "hired": 0
    }
    
    total_timing = {
        "time_to_first_interview": [],
        "time_in_pipeline": [],
        "interviews_per_candidate": []
    }
    
    for manager in managers:
        metrics = repo.calculate_metrics(manager["id"], days)
        
        # Sum funnel
        total_funnel["reviewed"] += metrics["funnel"]["reviewed"]
        total_funnel["interviewed"] += metrics["funnel"]["interviewed"]
        total_funnel["offered"] += metrics["funnel"]["offered"]
        total_funnel["hired"] += metrics["funnel"]["hired"]
        
        # Collect timing for averaging
        if metrics["timing"]["time_to_first_interview"] > 0:
            total_timing["time_to_first_interview"].append(metrics["timing"]["time_to_first_interview"])
        if metrics["timing"]["time_in_pipeline"] > 0:
            total_timing["time_in_pipeline"].append(metrics["timing"]["time_in_pipeline"])
        if metrics["timing"]["interviews_per_candidate"] > 0:
            total_timing["interviews_per_candidate"].append(metrics["timing"]["interviews_per_candidate"])
    
    # Calculate rates
    interview_rate = total_funnel["interviewed"] / total_funnel["reviewed"] if total_funnel["reviewed"] > 0 else 0
    offer_rate = total_funnel["offered"] / total_funnel["interviewed"] if total_funnel["interviewed"] > 0 else 0
    hire_rate = total_funnel["hired"] / total_funnel["offered"] if total_funnel["offered"] > 0 else 0
    
    # Average timing
    avg_timing = {
        "time_to_first_interview": sum(total_timing["time_to_first_interview"]) / len(total_timing["time_to_first_interview"]) if total_timing["time_to_first_interview"] else 0,
        "time_in_pipeline": sum(total_timing["time_in_pipeline"]) / len(total_timing["time_in_pipeline"]) if total_timing["time_in_pipeline"] else 0,
        "interviews_per_candidate": sum(total_timing["interviews_per_candidate"]) / len(total_timing["interviews_per_candidate"]) if total_timing["interviews_per_candidate"] else 0
    }
    
    return {
        "period_days": days,
        "total_managers": len(managers),
        "metrics": {
            "funnel": total_funnel,
            "timing": avg_timing,
            "rates": {
                "interview_rate": interview_rate,
                "offer_rate": offer_rate,
                "hire_rate": hire_rate
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
