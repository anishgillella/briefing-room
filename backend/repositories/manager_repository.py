"""
Manager Repository - CRUD and metrics for hiring managers.
"""
from typing import Optional, List
from datetime import datetime, timedelta
from db.client import get_db


class ManagerRepository:
    """Repository for hiring manager operations."""

    def __init__(self):
        self.db = get_db()

    def get_all(self) -> List[dict]:
        """Get all hiring managers."""
        result = self.db.table("hiring_managers").select("*").order("name").execute()
        return result.data

    def get_by_id(self, manager_id: str) -> Optional[dict]:
        """Get a single manager by ID."""
        result = self.db.table("hiring_managers").select("*").eq("id", manager_id).single().execute()
        return result.data

    def get_by_name(self, name: str) -> Optional[dict]:
        """Get a manager by name (for selector lookup)."""
        result = self.db.table("hiring_managers").select("*").ilike("name", f"%{name}%").execute()
        return result.data[0] if result.data else None

    def get_team_benchmark(self, team: str) -> Optional[dict]:
        """Get benchmark data for a team."""
        result = self.db.table("team_benchmarks").select("*").eq("team", team).order("period_end", desc=True).limit(1).execute()
        return result.data[0] if result.data else None

    def calculate_metrics(self, manager_id: str, days: int = 90) -> dict:
        """Calculate hiring funnel metrics for a manager over a time period."""
        import logging
        logger = logging.getLogger(__name__)
        
        start_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        # Get all interviews conducted by this manager
        logger.info(f"[MANAGER_REPO] Querying interviews for manager_id={manager_id}")
        interviews_result = self.db.table("interviews").select(
            "id, candidate_id, status, started_at, ended_at, stage, hiring_manager_id, interviewer_id, score"
        ).eq("hiring_manager_id", manager_id).gte("created_at", start_date).execute()
        
        interviews = interviews_result.data or []
        logger.info(f"[MANAGER_REPO] Found {len(interviews)} interviews for manager {manager_id}")
        if interviews:
            for i in interviews[:3]:  # Log first 3 for debugging
                logger.info(f"[MANAGER_REPO]   → Interview: {i.get('id', 'N/A')[:8]}..., status={i.get('status')}, score={i.get('score')}")
        
        # Get unique candidates from those interviews
        candidate_ids = list(set(i["candidate_id"] for i in interviews))
        logger.info(f"[MANAGER_REPO] Unique candidates: {len(candidate_ids)}")
        
        # Get candidate data
        candidates = []
        if candidate_ids:
            candidates_result = self.db.table("candidates").select(
                "id, pipeline_status, final_decision, created_at, decided_at"
            ).in_("id", candidate_ids).execute()
            candidates = candidates_result.data or []
            logger.info(f"[MANAGER_REPO] Retrieved {len(candidates)} candidate records")
        
        # Calculate funnel metrics
        reviewed = len(candidates)
        interviewed = len(candidate_ids)
        offered = len([c for c in candidates if c.get("pipeline_status") in ["decision_pending", "accepted", "rejected"]])
        hired = len([c for c in candidates if c.get("final_decision") == "accepted"])
        
        # Calculate rates
        interview_rate = interviewed / reviewed if reviewed > 0 else 0
        offer_rate = offered / interviewed if interviewed > 0 else 0
        hire_rate = hired / offered if offered > 0 else 0
        
        # Calculate timing metrics
        time_to_first_interview = 0
        time_in_pipeline = 0
        interviews_per_candidate = len(interviews) / interviewed if interviewed > 0 else 0
        
        # Time to first interview (from candidate creation to first interview)
        first_interview_times = []
        for candidate in candidates:
            candidate_interviews = [i for i in interviews if i.get("candidate_id") == candidate.get("id") and i.get("started_at")]
            if candidate_interviews:
                first_interview = min(candidate_interviews, key=lambda x: x.get("started_at", ""))
                if first_interview.get("started_at") and candidate.get("created_at"):
                    try:
                        started = datetime.fromisoformat(first_interview["started_at"].replace("Z", "+00:00"))
                        created = datetime.fromisoformat(candidate["created_at"].replace("Z", "+00:00"))
                        first_interview_times.append((started - created).days)
                    except:
                        pass
        
        if first_interview_times:
            time_to_first_interview = sum(first_interview_times) / len(first_interview_times)
        
        # Time in pipeline (from creation to decision)
        pipeline_times = []
        for candidate in candidates:
            if candidate.get("decided_at") and candidate.get("created_at"):
                try:
                    decided = datetime.fromisoformat(candidate["decided_at"].replace("Z", "+00:00"))
                    created = datetime.fromisoformat(candidate["created_at"].replace("Z", "+00:00"))
                    pipeline_times.append((decided - created).days)
                except:
                    pass
        
        if pipeline_times:
            time_in_pipeline = sum(pipeline_times) / len(pipeline_times)
        
        return {
            "funnel": {
                "reviewed": reviewed,
                "interviewed": interviewed,
                "offered": offered,
                "hired": hired,
                "interview_rate": round(interview_rate, 3),
                "offer_rate": round(offer_rate, 3),
                "hire_rate": round(hire_rate, 3)
            },
            "timing": {
                "time_to_first_interview": round(time_to_first_interview, 1),
                "time_in_pipeline": round(time_in_pipeline, 1),
                "interviews_per_candidate": round(interviews_per_candidate, 1)
            }
        }

    def compare_to_benchmark(self, metrics: dict, team: str) -> dict:
        """Compare manager metrics to team benchmarks."""
        
        benchmark = self.get_team_benchmark(team)
        if not benchmark:
            return {}
        
        comparisons = {}
        
        # Funnel comparisons (higher is better)
        for metric in ["interview_rate", "offer_rate", "hire_rate"]:
            manager_val = metrics["funnel"].get(metric, 0)
            bench_val = benchmark.get(f"avg_{metric}", 0) or 0
            diff = (manager_val - bench_val) / bench_val if bench_val else 0
            
            comparisons[metric] = {
                "value": manager_val,
                "benchmark": bench_val,
                "difference": round(diff, 2),
                "status": "good" if diff >= -0.2 else "warning" if diff >= -0.5 else "critical"
            }
        
        # Timing comparisons (lower is better)
        for metric in ["time_to_first_interview", "time_in_pipeline", "interviews_per_candidate"]:
            manager_val = metrics["timing"].get(metric, 0)
            bench_key = f"avg_{metric}"
            bench_val = benchmark.get(bench_key, 0) or 0
            diff = (manager_val - bench_val) / bench_val if bench_val else 0
            
            comparisons[metric] = {
                "value": manager_val,
                "benchmark": bench_val,
                "difference": round(diff, 2),
                "status": "good" if diff <= 0.2 else "warning" if diff <= 0.5 else "critical"
            }
        
        return comparisons

    def generate_recommendations(self, metrics: dict, comparisons: dict) -> List[str]:
        """Generate actionable recommendations based on metrics."""
        
        recommendations = []
        
        # Low offer rate
        if comparisons.get("offer_rate", {}).get("status") in ["warning", "critical"]:
            rate = comparisons["offer_rate"]["value"] * 100
            bench = comparisons["offer_rate"]["benchmark"] * 100
            recommendations.append(
                f"Your offer rate ({rate:.1f}%) is below team average ({bench:.1f}%). "
                f"Consider reviewing rejection criteria with HR."
            )
        
        # High time in pipeline
        if comparisons.get("time_in_pipeline", {}).get("status") in ["warning", "critical"]:
            time_val = metrics["timing"]["time_in_pipeline"]
            bench = comparisons["time_in_pipeline"]["benchmark"]
            recommendations.append(
                f"Candidates spend {time_val:.0f} days in your pipeline vs. {bench:.0f} team average. "
                f"Consider faster scheduling or reducing interview rounds."
            )
        
        # Too many interview rounds
        if comparisons.get("interviews_per_candidate", {}).get("status") in ["warning", "critical"]:
            rounds = metrics["timing"]["interviews_per_candidate"]
            bench = comparisons["interviews_per_candidate"]["benchmark"]
            recommendations.append(
                f"You average {rounds:.1f} interviews per candidate vs. {bench:.1f} team average. "
                f"Consider consolidating rounds or panel interviews."
            )
        
        # Low interview rate
        if comparisons.get("interview_rate", {}).get("status") in ["warning", "critical"]:
            rate = comparisons["interview_rate"]["value"] * 100
            bench = comparisons["interview_rate"]["benchmark"] * 100
            recommendations.append(
                f"Your interview rate ({rate:.1f}%) is below team average ({bench:.1f}%). "
                f"Consider reviewing more candidates or adjusting initial screening criteria."
            )
        
        return recommendations


# Singleton instance
_manager_repo: ManagerRepository | None = None


def get_manager_repository() -> ManagerRepository:
    """Get singleton manager repository."""
    global _manager_repo
    if _manager_repo is None:
        _manager_repo = ManagerRepository()
    return _manager_repo
