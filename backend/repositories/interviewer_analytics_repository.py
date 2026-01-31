"""
Interviewer Analytics Repository.
CRUD and aggregation for interviewer analytics.
"""
from typing import Optional, List
from db.client import get_db
from models.interviewer_analytics import InterviewerAnalyticsResult


class InterviewerAnalyticsRepository:
    """Repository for interviewer analytics operations."""

    def __init__(self):
        self.db = get_db()

    def save_analytics(
        self,
        interview_id: str,
        interviewer_id: str,
        analytics: InterviewerAnalyticsResult
    ) -> dict:
        """Save analytics for an interview."""
        data = {
            "interview_id": interview_id,
            "interviewer_id": interviewer_id,
            "question_quality_score": analytics.question_quality_score,
            "topic_coverage_score": analytics.topic_coverage_score,
            "consistency_score": analytics.consistency_score,
            "bias_score": analytics.bias_score,
            "candidate_experience_score": analytics.candidate_experience_score,
            "overall_score": analytics.overall_score,
            "question_quality_breakdown": analytics.question_quality_breakdown.model_dump(),
            "topics_covered": analytics.topics_covered.model_dump(),
            "bias_indicators": analytics.bias_indicators.model_dump(),
            "improvement_suggestions": analytics.improvement_suggestions
        }
        
        result = self.db.table("interviewer_analytics").insert(data).execute()
        return result.data[0] if result.data else None

    def get_by_interview(self, interview_id: str) -> Optional[dict]:
        """Get analytics for a specific interview."""
        try:
            result = self.db.table("interviewer_analytics").select("*").eq("interview_id", interview_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            # Log and return None if no data found
            return None

    def get_by_interviewer(self, interviewer_id: str, limit: int = 20) -> List[dict]:
        """Get all analytics for an interviewer."""
        result = self.db.table("interviewer_analytics").select("*").eq("interviewer_id", interviewer_id).order("created_at", desc=True).limit(limit).execute()
        return result.data or []

    def get_aggregated_metrics(self, interviewer_id: str) -> dict:
        """Get aggregated metrics for an interviewer across all their interviews."""
        analytics = self.get_by_interviewer(interviewer_id, limit=50)
        
        if not analytics:
            return {
                "total_interviews": 0,
                "avg_question_quality": 0,
                "avg_topic_coverage": 0,
                "avg_consistency": 0,
                "avg_bias_score": 0,
                "avg_candidate_experience": 0,
                "avg_overall": 0,
                "topic_breakdown": {
                    "technical": 0,
                    "behavioral": 0,
                    "culture_fit": 0,
                    "problem_solving": 0
                },
                "common_suggestions": [],
                "bias_flags": []
            }
        
        n = len(analytics)
        
        # Calculate averages
        avg_question = sum(a["question_quality_score"] or 0 for a in analytics) / n
        avg_coverage = sum(a["topic_coverage_score"] or 0 for a in analytics) / n
        avg_consistency = sum(a["consistency_score"] or 0 for a in analytics) / n
        avg_bias = sum(a["bias_score"] or 0 for a in analytics) / n
        avg_experience = sum(a["candidate_experience_score"] or 0 for a in analytics) / n
        avg_overall = sum(a["overall_score"] or 0 for a in analytics) / n
        
        # Aggregate topic coverage
        topic_totals = {"technical": 0, "behavioral": 0, "culture_fit": 0, "problem_solving": 0}
        for a in analytics:
            topics = a.get("topics_covered") or {}
            for key in topic_totals:
                topic_totals[key] += topics.get(key, 0)
        
        topic_breakdown = {k: round(v / n, 1) for k, v in topic_totals.items()}
        
        # Collect common suggestions
        all_suggestions = []
        for a in analytics:
            all_suggestions.extend(a.get("improvement_suggestions") or [])
        
        # Count suggestion frequency
        suggestion_counts = {}
        for s in all_suggestions:
            suggestion_counts[s] = suggestion_counts.get(s, 0) + 1
        
        # Get top 3 most common
        common_suggestions = sorted(suggestion_counts.items(), key=lambda x: -x[1])[:3]
        common_suggestions = [s[0] for s in common_suggestions]
        
        # Collect bias flags
        all_flags = []
        for a in analytics:
            indicators = a.get("bias_indicators") or {}
            all_flags.extend(indicators.get("flags") or [])
        
        # Unique bias flags
        bias_flags = list(set(all_flags))[:5]
        
        return {
            "total_interviews": n,
            "avg_question_quality": round(avg_question, 1),
            "avg_topic_coverage": round(avg_coverage, 1),
            "avg_consistency": round(avg_consistency, 1),
            "avg_bias_score": round(avg_bias, 1),
            "avg_candidate_experience": round(avg_experience, 1),
            "avg_overall": round(avg_overall, 1),
            "topic_breakdown": topic_breakdown,
            "common_suggestions": common_suggestions,
            "bias_flags": bias_flags
        }

    def get_batch_aggregated_metrics(self, interviewer_ids: List[str]) -> dict:
        """
        Get aggregated metrics for multiple interviewers in ONE query.
        
        Returns:
            Dict mapping interviewer_id -> aggregated metrics
        """
        if not interviewer_ids:
            return {}

        # Fetch all analytics for all interviewers in ONE query
        result = self.db.table("interviewer_analytics")\
            .select("*")\
            .in_("interviewer_id", interviewer_ids)\
            .order("created_at", desc=True)\
            .execute()

        all_analytics = result.data or []

        # Group by interviewer
        analytics_by_interviewer = {}
        for a in all_analytics:
            iid = a.get("interviewer_id")
            if iid not in analytics_by_interviewer:
                analytics_by_interviewer[iid] = []
            # Limit to 50 per interviewer for aggregation
            if len(analytics_by_interviewer[iid]) < 50:
                analytics_by_interviewer[iid].append(a)

        # Compute aggregated metrics for each interviewer
        metrics_map = {}
        for iid in interviewer_ids:
            analytics = analytics_by_interviewer.get(iid, [])
            metrics_map[iid] = self._compute_aggregated_metrics(analytics)

        return metrics_map

    def _compute_aggregated_metrics(self, analytics: List[dict]) -> dict:
        """Compute aggregated metrics from a list of analytics records."""
        if not analytics:
            return {
                "total_interviews": 0,
                "avg_question_quality": 0,
                "avg_topic_coverage": 0,
                "avg_consistency": 0,
                "avg_bias_score": 0,
                "avg_candidate_experience": 0,
                "avg_overall": 0,
                "topic_breakdown": {
                    "technical": 0,
                    "behavioral": 0,
                    "culture_fit": 0,
                    "problem_solving": 0
                },
                "common_suggestions": [],
                "bias_flags": []
            }

        n = len(analytics)

        # Calculate averages
        avg_question = sum(a.get("question_quality_score") or 0 for a in analytics) / n
        avg_coverage = sum(a.get("topic_coverage_score") or 0 for a in analytics) / n
        avg_consistency = sum(a.get("consistency_score") or 0 for a in analytics) / n
        avg_bias = sum(a.get("bias_score") or 0 for a in analytics) / n
        avg_experience = sum(a.get("candidate_experience_score") or 0 for a in analytics) / n
        avg_overall = sum(a.get("overall_score") or 0 for a in analytics) / n

        # Aggregate topic coverage
        topic_totals = {"technical": 0, "behavioral": 0, "culture_fit": 0, "problem_solving": 0}
        for a in analytics:
            topics = a.get("topics_covered") or {}
            for key in topic_totals:
                topic_totals[key] += topics.get(key, 0)

        topic_breakdown = {k: round(v / n, 1) for k, v in topic_totals.items()}

        # Collect common suggestions
        all_suggestions = []
        for a in analytics:
            all_suggestions.extend(a.get("improvement_suggestions") or [])

        suggestion_counts = {}
        for s in all_suggestions:
            suggestion_counts[s] = suggestion_counts.get(s, 0) + 1

        common_suggestions = sorted(suggestion_counts.items(), key=lambda x: -x[1])[:3]
        common_suggestions = [s[0] for s in common_suggestions]

        # Collect bias flags
        all_flags = []
        for a in analytics:
            indicators = a.get("bias_indicators") or {}
            all_flags.extend(indicators.get("flags") or [])

        bias_flags = list(set(all_flags))[:5]

        return {
            "total_interviews": n,
            "avg_question_quality": round(avg_question, 1),
            "avg_topic_coverage": round(avg_coverage, 1),
            "avg_consistency": round(avg_consistency, 1),
            "avg_bias_score": round(avg_bias, 1),
            "avg_candidate_experience": round(avg_experience, 1),
            "avg_overall": round(avg_overall, 1),
            "topic_breakdown": topic_breakdown,
            "common_suggestions": common_suggestions,
            "bias_flags": bias_flags
        }


# Singleton
_repo: InterviewerAnalyticsRepository | None = None


def get_interviewer_analytics_repository() -> InterviewerAnalyticsRepository:
    """Get singleton repository."""
    global _repo
    if _repo is None:
        _repo = InterviewerAnalyticsRepository()
    return _repo
