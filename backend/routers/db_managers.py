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
    """
    Get aggregated hiring funnel metrics for the entire organization (team-wide view).
    
    Enhanced with:
    - Time-to-hire (end-to-end)
    - Trend comparison vs previous period
    - Bottleneck detection
    - Stuck candidates alerts
    """
    from db.client import get_db
    from datetime import datetime, timedelta
    
    db = get_db()
    now = datetime.now()
    start_date = (now - timedelta(days=days)).isoformat()
    previous_start = (now - timedelta(days=days * 2)).isoformat()
    previous_end = start_date
    
    # Get candidates for CURRENT period
    candidates_result = db.table("candidates").select(
        "id, pipeline_status, final_decision, created_at, decided_at, persons(name)"
    ).gte("created_at", start_date).execute()
    candidates = candidates_result.data or []
    
    # Get candidates for PREVIOUS period (for trend comparison)
    prev_candidates_result = db.table("candidates").select(
        "id, pipeline_status, final_decision, created_at, decided_at"
    ).gte("created_at", previous_start).lt("created_at", previous_end).execute()
    prev_candidates = prev_candidates_result.data or []
    
    # Get ALL candidates (for stuck detection - need those from before current period too)
    all_candidates_result = db.table("candidates").select(
        "id, pipeline_status, final_decision, created_at, decided_at, persons(name)"
    ).is_("decided_at", "null").execute()
    undecided_candidates = all_candidates_result.data or []
    
    # Get all interviews in the period
    interviews_result = db.table("interviews").select(
        "id, candidate_id, status, started_at, ended_at, created_at"
    ).gte("created_at", start_date).execute()
    interviews = interviews_result.data or []
    
    # Previous period interviews
    prev_interviews_result = db.table("interviews").select(
        "id, candidate_id, status, started_at, ended_at, created_at"
    ).gte("created_at", previous_start).lt("created_at", previous_end).execute()
    prev_interviews = prev_interviews_result.data or []
    
    # =========================================================================
    # CURRENT PERIOD METRICS
    # =========================================================================
    reviewed = len(candidates)
    interviewed_candidate_ids = set(
        i["candidate_id"] for i in interviews 
        if i.get("status") == "completed"
    )
    interviewed = len(interviewed_candidate_ids)
    offered = len([c for c in candidates if c.get("pipeline_status") in ["decision_pending", "accepted", "rejected"]])
    hired = len([c for c in candidates if c.get("final_decision") == "accepted"])
    
    # Rates
    interview_rate = interviewed / reviewed if reviewed > 0 else 0
    offer_rate = offered / interviewed if interviewed > 0 else 0
    hire_rate = hired / offered if offered > 0 else 0
    
    # =========================================================================
    # PREVIOUS PERIOD METRICS (for trends)
    # =========================================================================
    prev_reviewed = len(prev_candidates)
    prev_interviewed_ids = set(
        i["candidate_id"] for i in prev_interviews 
        if i.get("status") == "completed"
    )
    prev_interviewed = len(prev_interviewed_ids)
    prev_offered = len([c for c in prev_candidates if c.get("pipeline_status") in ["decision_pending", "accepted", "rejected"]])
    prev_hired = len([c for c in prev_candidates if c.get("final_decision") == "accepted"])
    
    prev_interview_rate = prev_interviewed / prev_reviewed if prev_reviewed > 0 else 0
    prev_offer_rate = prev_offered / prev_interviewed if prev_interviewed > 0 else 0
    prev_hire_rate = prev_hired / prev_offered if prev_offered > 0 else 0
    
    def calc_change(current, previous):
        if previous == 0:
            return 100 if current > 0 else 0
        return round(((current - previous) / previous) * 100, 1)
    
    # =========================================================================
    # TIMING METRICS
    # =========================================================================
    time_to_first_interview_list = []
    time_to_hire_list = []
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
        
        # Time in pipeline (to decision)
        if candidate.get("decided_at") and candidate_created:
            try:
                decided = datetime.fromisoformat(candidate["decided_at"].replace("Z", "+00:00"))
                created = datetime.fromisoformat(candidate_created.replace("Z", "+00:00"))
                days_diff = (decided - created).days
                if days_diff >= 0:
                    time_in_pipeline_list.append(days_diff)
                    # Time-to-hire = only for accepted candidates
                    if candidate.get("final_decision") == "accepted":
                        time_to_hire_list.append(days_diff)
            except:
                pass
    
    avg_time_to_interview = sum(time_to_first_interview_list) / len(time_to_first_interview_list) if time_to_first_interview_list else 0
    avg_time_in_pipeline = sum(time_in_pipeline_list) / len(time_in_pipeline_list) if time_in_pipeline_list else 0
    avg_time_to_hire = sum(time_to_hire_list) / len(time_to_hire_list) if time_to_hire_list else 0
    interviews_per_candidate = len(interviews) / interviewed if interviewed > 0 else 0
    
    # =========================================================================
    # BOTTLENECK DETECTION
    # =========================================================================
    conversions = [
        {"stage": "review_to_interview", "from": "Reviewed", "to": "Interviewed", "rate": interview_rate},
        {"stage": "interview_to_offer", "from": "Interviewed", "to": "Offered", "rate": offer_rate},
        {"stage": "offer_to_hire", "from": "Offered", "to": "Hired", "rate": hire_rate},
    ]
    # Find the weakest conversion
    valid_conversions = [c for c in conversions if c["rate"] < 1.0]
    if valid_conversions:
        bottleneck = min(valid_conversions, key=lambda x: x["rate"])
        bottleneck_info = {
            "stage": bottleneck["stage"],
            "from_stage": bottleneck["from"],
            "to_stage": bottleneck["to"],
            "rate": round(bottleneck["rate"], 3),
            "rate_pct": round(bottleneck["rate"] * 100, 1),
            "description": f"Only {round(bottleneck['rate'] * 100, 1)}% of {bottleneck['from'].lower()} candidates move to {bottleneck['to'].lower()}"
        }
    else:
        bottleneck_info = None
    
    # =========================================================================
    # STUCK CANDIDATES (in same stage for 7+ days without decision)
    # =========================================================================
    stuck_threshold_days = 7
    stuck_candidates = []
    
    for candidate in undecided_candidates:
        created_at = candidate.get("created_at")
        if not created_at:
            continue
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            days_in_stage = (now.replace(tzinfo=created.tzinfo) - created).days
            
            if days_in_stage >= stuck_threshold_days:
                person_data = candidate.get("persons") or {}
                stuck_candidates.append({
                    "id": candidate.get("id"),
                    "name": person_data.get("name", "Unknown"),
                    "stage": candidate.get("pipeline_status", "new"),
                    "days_stuck": days_in_stage,
                    "created_at": created_at
                })
        except:
            pass
    
    # Sort by days stuck (most stuck first) and limit to top 10
    stuck_candidates = sorted(stuck_candidates, key=lambda x: -x["days_stuck"])[:10]
    
    # =========================================================================
    # BUILD RESPONSE
    # =========================================================================
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
                "time_to_hire": round(avg_time_to_hire, 1),
                "interviews_per_candidate": round(interviews_per_candidate, 1)
            },
            "rates": {
                "interview_rate": round(interview_rate, 3),
                "offer_rate": round(offer_rate, 3),
                "hire_rate": round(hire_rate, 3)
            }
        },
        "trends": {
            "reviewed": {"current": reviewed, "previous": prev_reviewed, "change_pct": calc_change(reviewed, prev_reviewed)},
            "interviewed": {"current": interviewed, "previous": prev_interviewed, "change_pct": calc_change(interviewed, prev_interviewed)},
            "offered": {"current": offered, "previous": prev_offered, "change_pct": calc_change(offered, prev_offered)},
            "hired": {"current": hired, "previous": prev_hired, "change_pct": calc_change(hired, prev_hired)},
            "interview_rate": {"current": round(interview_rate * 100, 1), "previous": round(prev_interview_rate * 100, 1), "change_pct": calc_change(interview_rate, prev_interview_rate)},
            "offer_rate": {"current": round(offer_rate * 100, 1), "previous": round(prev_offer_rate * 100, 1), "change_pct": calc_change(offer_rate, prev_offer_rate)},
            "hire_rate": {"current": round(hire_rate * 100, 1), "previous": round(prev_hire_rate * 100, 1), "change_pct": calc_change(hire_rate, prev_hire_rate)},
        },
        "bottleneck": bottleneck_info,
        "stuck_candidates": stuck_candidates,
        "stuck_count": len(stuck_candidates)
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
