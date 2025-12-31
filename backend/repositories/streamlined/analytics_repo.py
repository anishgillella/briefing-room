"""
Analytics Repository - Database operations for Analytics entities.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from models.streamlined.analytics import (
    Analytics, AnalyticsCreate, CompetencyScore, Recommendation
)
from db.client import get_db


class AnalyticsRepository:
    """Repository for Analytics database operations."""

    def __init__(self):
        self.client = get_db()
        self.table = "analytics"

    async def create(self, analytics_data: AnalyticsCreate) -> Analytics:
        """Create a new analytics record."""
        data = {
            "interview_id": str(analytics_data.interview_id),
            "overall_score": int(analytics_data.overall_score),  # DB expects integer
            "competency_scores": [cs.model_dump() for cs in analytics_data.competency_scores],
            "strengths": analytics_data.strengths,
            "concerns": analytics_data.concerns,
            "red_flags_detected": analytics_data.red_flags_detected,
            "recommendation": analytics_data.recommendation.value if isinstance(
                analytics_data.recommendation, Recommendation
            ) else analytics_data.recommendation,
            "summary": analytics_data.summary,
            "synthesis": analytics_data.summary,  # Map to existing column
            "created_at": datetime.utcnow().isoformat(),
        }

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create analytics")

        return self._parse_analytics(result.data[0])

    def create_sync(self, analytics_data: AnalyticsCreate) -> Analytics:
        """Synchronous version of create."""
        data = {
            "interview_id": str(analytics_data.interview_id),
            "overall_score": int(analytics_data.overall_score),  # DB expects integer
            "competency_scores": [cs.model_dump() for cs in analytics_data.competency_scores],
            "strengths": analytics_data.strengths,
            "concerns": analytics_data.concerns,
            "red_flags_detected": analytics_data.red_flags_detected,
            "recommendation": analytics_data.recommendation.value if isinstance(
                analytics_data.recommendation, Recommendation
            ) else analytics_data.recommendation,
            "summary": analytics_data.summary,
            "synthesis": analytics_data.summary,
            "created_at": datetime.utcnow().isoformat(),
        }

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create analytics")

        return self._parse_analytics(result.data[0])

    async def get_by_id(self, analytics_id: UUID) -> Optional[Analytics]:
        """Get analytics by ID."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(analytics_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_analytics(result.data[0])

    def get_by_id_sync(self, analytics_id: UUID) -> Optional[Analytics]:
        """Synchronous version of get_by_id."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(analytics_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_analytics(result.data[0])

    async def get_by_interview(self, interview_id: UUID) -> Optional[Analytics]:
        """Get analytics for an interview."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("interview_id", str(interview_id))\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()

        if not result.data:
            return None

        return self._parse_analytics(result.data[0])

    def get_by_interview_sync(self, interview_id: UUID) -> Optional[Analytics]:
        """Synchronous version of get_by_interview."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("interview_id", str(interview_id))\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()

        if not result.data:
            return None

        return self._parse_analytics(result.data[0])

    async def list_by_job(self, job_id: UUID) -> List[Analytics]:
        """Get all analytics for candidates of a job."""
        # Need to join through interviews and candidates
        result = self.client.table(self.table)\
            .select("""
                *,
                interviews!inner(
                    candidate_id,
                    job_posting_id,
                    candidates(name)
                )
            """)\
            .eq("interviews.job_posting_id", str(job_id))\
            .execute()

        analytics_list = []
        for data in result.data:
            analytics = self._parse_analytics(data)
            if data.get("interviews") and data["interviews"].get("candidates"):
                analytics.candidate_name = data["interviews"]["candidates"].get("name")
            analytics_list.append(analytics)

        return analytics_list

    def list_by_job_sync(self, job_id: UUID) -> List[Analytics]:
        """Synchronous version of list_by_job."""
        result = self.client.table(self.table)\
            .select("""
                *,
                interviews!inner(
                    candidate_id,
                    job_posting_id,
                    candidates(name)
                )
            """)\
            .eq("interviews.job_posting_id", str(job_id))\
            .execute()

        analytics_list = []
        for data in result.data:
            analytics = self._parse_analytics(data)
            if data.get("interviews") and data["interviews"].get("candidates"):
                analytics.candidate_name = data["interviews"]["candidates"].get("name")
            analytics_list.append(analytics)

        return analytics_list

    async def list_all(self, limit: int = 100) -> List[Analytics]:
        """Get all analytics records."""
        result = self.client.table(self.table)\
            .select("*")\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()

        return [self._parse_analytics(data) for data in result.data]

    def list_all_sync(self, limit: int = 100) -> List[Analytics]:
        """Synchronous version of list_all."""
        result = self.client.table(self.table)\
            .select("*")\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()

        return [self._parse_analytics(data) for data in result.data]

    async def update(
        self,
        analytics_id: UUID,
        data: Dict[str, Any]
    ) -> Optional[Analytics]:
        """Update analytics record."""
        result = self.client.table(self.table)\
            .update(data)\
            .eq("id", str(analytics_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_analytics(result.data[0])

    def update_sync(
        self,
        analytics_id: UUID,
        data: Dict[str, Any]
    ) -> Optional[Analytics]:
        """Synchronous version of update."""
        result = self.client.table(self.table)\
            .update(data)\
            .eq("id", str(analytics_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_analytics(result.data[0])

    async def delete(self, analytics_id: UUID) -> bool:
        """Delete analytics record."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(analytics_id))\
            .execute()

        return len(result.data) > 0

    def delete_sync(self, analytics_id: UUID) -> bool:
        """Synchronous version of delete."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(analytics_id))\
            .execute()

        return len(result.data) > 0

    def _parse_analytics(self, data: dict) -> Analytics:
        """Parse database row into Analytics model."""
        # Parse competency scores
        competency_scores = []
        if data.get("competency_scores"):
            for cs in data["competency_scores"]:
                competency_scores.append(CompetencyScore(**cs))

        return Analytics(
            id=data.get("id"),
            interview_id=data.get("interview_id"),
            overall_score=data.get("overall_score", 0),
            competency_scores=competency_scores,
            strengths=data.get("strengths", []) or [],
            concerns=data.get("concerns", []) or [],
            red_flags_detected=data.get("red_flags_detected", []) or [],
            recommendation=self._map_recommendation(data.get("recommendation")),
            recommendation_reasoning=data.get("recommendation_reasoning"),
            summary=data.get("summary") or data.get("synthesis", ""),
            raw_ai_response=data.get("raw_ai_response"),
            created_at=data.get("created_at"),
            model_used=data.get("model_used"),
        )

    def _map_recommendation(self, rec_str: Optional[str]) -> Recommendation:
        """Map database recommendation to enum."""
        if not rec_str:
            return Recommendation.MAYBE

        rec_map = {
            "strong_hire": Recommendation.STRONG_HIRE,
            "Strong Hire": Recommendation.STRONG_HIRE,
            "hire": Recommendation.HIRE,
            "Hire": Recommendation.HIRE,
            "maybe": Recommendation.MAYBE,
            "Leaning Hire": Recommendation.MAYBE,
            "Leaning No Hire": Recommendation.MAYBE,
            "no_hire": Recommendation.NO_HIRE,
            "No Hire": Recommendation.NO_HIRE,
        }
        return rec_map.get(rec_str, Recommendation.MAYBE)
