"""
Manager Dashboard API Routes.
"""
from fastapi import APIRouter, HTTPException
from repositories.manager_repository import get_manager_repository
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/managers", tags=["managers"])


@router.get("")
async def list_managers():
    """Get all hiring managers (for selector dropdown)."""
    repo = get_manager_repository()
    managers = repo.get_all()
    logger.info(f"[MANAGER_LIST] Found {len(managers)} managers")
    return {"managers": managers}


@router.get("/metrics/team")
async def get_team_metrics(days: int = 90):
    """Get aggregated hiring funnel metrics for ALL managers (team-wide view)."""
    logger.info(f"[MANAGER_METRICS] 📊 Fetching team metrics for last {days} days")
    repo = get_manager_repository()
    managers = repo.get_all()
    logger.info(f"[MANAGER_METRICS] Found {len(managers)} managers to aggregate")
    
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
        logger.info(f"[MANAGER_METRICS] Manager '{manager.get('name', 'Unknown')}' metrics:")
        logger.info(f"  → Funnel: {metrics['funnel']}")
        logger.info(f"  → Timing: {metrics['timing']}")
        
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
    
    logger.info(f"[MANAGER_METRICS] ✅ Total funnel: {total_funnel}")
    logger.info(f"[MANAGER_METRICS] ✅ Total timing: {avg_timing}")
    
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


# ============================================================================
# Consolidated Team Report (Manager Tab)
# ============================================================================

@router.get("/metrics/consolidated")
async def get_consolidated_team_report(days: int = 90):
    """
    Get consolidated team report for Manager Dashboard.
    Includes:
    - Total interviews across all interviewers
    - Aggregate metrics (avg scores, conversion rates)
    - Interviewer leaderboard (ranked by performance)
    - Per-interviewer breakdown
    """
    from repositories.interviewer_analytics_repository import get_interviewer_analytics_repository
    from db.client import get_db
    
    logger.info(f"[CONSOLIDATED_REPORT] 📊 Building consolidated team report for last {days} days")
    
    repo = get_manager_repository()
    analytics_repo = get_interviewer_analytics_repository()
    db = get_db()
    
    # Get all interviewers (same as hiring_managers)
    managers = repo.get_all()
    logger.info(f"[CONSOLIDATED_REPORT] Found {len(managers)} team members")
    
    # Get interview counts per interviewer
    from datetime import datetime, timedelta
    start_date = (datetime.now() - timedelta(days=days)).isoformat()
    
    interviews_result = db.table("interviews").select(
        "interviewer_id, id, status, score"
    ).gte("created_at", start_date).execute()
    
    all_interviews = interviews_result.data or []
    logger.info(f"[CONSOLIDATED_REPORT] Total interviews in period: {len(all_interviews)}")
    
    # Group by interviewer
    from collections import defaultdict
    interviewer_interviews = defaultdict(list)
    for interview in all_interviews:
        if interview.get("interviewer_id"):
            interviewer_interviews[interview["interviewer_id"]].append(interview)
    
    # Build leaderboard
    leaderboard = []
    total_completed = 0
    total_scores = []
    
    for manager in managers:
        manager_id = manager["id"]
        interviews = interviewer_interviews.get(manager_id, [])
        completed = [i for i in interviews if i.get("status") == "completed"]
        scores = [i["score"] for i in completed if i.get("score")]
        
        total_completed += len(completed)
        total_scores.extend(scores)
        
        # Get interviewer analytics metrics
        analytics_metrics = analytics_repo.get_aggregated_metrics(manager_id)
        
        avg_score = sum(scores) / len(scores) if scores else 0
        
        leaderboard.append({
            "interviewer_id": manager_id,
            "name": manager.get("name", "Unknown"),
            "team": manager.get("team"),
            "department": manager.get("department"),
            "total_interviews": len(completed),
            "avg_interview_score": round(avg_score, 1),
            "avg_overall_rating": analytics_metrics.get("avg_overall", 0),
            "avg_question_quality": analytics_metrics.get("avg_question_quality", 0),
            "avg_candidate_experience": analytics_metrics.get("avg_candidate_experience", 0)
        })
    
    # Sort leaderboard by total interviews then by avg score
    leaderboard.sort(key=lambda x: (x["total_interviews"], x["avg_interview_score"]), reverse=True)
    
    # Calculate team-wide metrics
    team_avg_score = round(sum(total_scores) / len(total_scores), 1) if total_scores else 0
    team_avg_rating = round(
        sum(l["avg_overall_rating"] for l in leaderboard) / len(leaderboard), 1
    ) if leaderboard else 0
    
    logger.info(f"[CONSOLIDATED_REPORT] ✅ Report built: {total_completed} interviews, avg score: {team_avg_score}")
    
    return {
        "period_days": days,
        "summary": {
            "total_interviewers": len(managers),
            "total_interviews_completed": total_completed,
            "team_avg_interview_score": team_avg_score,
            "team_avg_overall_rating": team_avg_rating,
            "active_interviewers": len([l for l in leaderboard if l["total_interviews"] > 0])
        },
        "leaderboard": leaderboard[:10],  # Top 10
        "all_interviewers": leaderboard
    }

