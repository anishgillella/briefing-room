"""
Interview Repository - Database operations for Interview entities.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from models.streamlined.interview import (
    Interview, InterviewCreate, InterviewUpdate,
    InterviewType, InterviewSessionStatus
)
from db.client import get_db


class InterviewRepository:
    """Repository for Interview database operations."""

    def __init__(self):
        self.client = get_db()
        self.table = "interviews"

    async def create(self, interview_data: InterviewCreate) -> Interview:
        """Create a new interview."""
        data = {
            "candidate_id": str(interview_data.candidate_id),
            "stage": "round_1",  # Default stage
            "interview_type": interview_data.interview_type.value if isinstance(
                interview_data.interview_type, InterviewType
            ) else interview_data.interview_type,
            "status": "scheduled",
            "created_at": datetime.utcnow().isoformat(),
        }

        # Get job_posting_id from candidate
        candidate_result = self.client.table("candidates")\
            .select("job_posting_id")\
            .eq("id", str(interview_data.candidate_id))\
            .execute()

        if candidate_result.data:
            data["job_posting_id"] = candidate_result.data[0]["job_posting_id"]

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create interview")

        return self._parse_interview(result.data[0])

    def create_sync(self, interview_data: InterviewCreate) -> Interview:
        """Synchronous version of create."""
        data = {
            "candidate_id": str(interview_data.candidate_id),
            "stage": "round_1",
            "interview_type": interview_data.interview_type.value if isinstance(
                interview_data.interview_type, InterviewType
            ) else interview_data.interview_type,
            "status": "scheduled",
            "created_at": datetime.utcnow().isoformat(),
        }

        candidate_result = self.client.table("candidates")\
            .select("job_posting_id")\
            .eq("id", str(interview_data.candidate_id))\
            .execute()

        if candidate_result.data:
            data["job_posting_id"] = candidate_result.data[0]["job_posting_id"]

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create interview")

        return self._parse_interview(result.data[0])

    async def get_by_id(self, interview_id: UUID) -> Optional[Interview]:
        """Get an interview by ID with joined data."""
        result = self.client.table(self.table)\
            .select("*, candidates(name, job_posting_id, job_postings(title))")\
            .eq("id", str(interview_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_interview_with_joins(result.data[0])

    def get_by_id_sync(self, interview_id: UUID) -> Optional[Interview]:
        """Synchronous version of get_by_id."""
        result = self.client.table(self.table)\
            .select("*, candidates(name, job_posting_id, job_postings(title))")\
            .eq("id", str(interview_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_interview_with_joins(result.data[0])

    async def list_by_candidate(self, candidate_id: UUID) -> List[Interview]:
        """List all interviews for a candidate."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("candidate_id", str(candidate_id))\
            .order("created_at", desc=True)\
            .execute()

        return [self._parse_interview(i) for i in result.data]

    def list_by_candidate_sync(self, candidate_id: UUID) -> List[Interview]:
        """Synchronous version of list_by_candidate."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("candidate_id", str(candidate_id))\
            .order("created_at", desc=True)\
            .execute()

        return [self._parse_interview(i) for i in result.data]

    async def list_by_job(self, job_id: UUID) -> List[Interview]:
        """List all interviews for a job."""
        result = self.client.table(self.table)\
            .select("*, candidates(name)")\
            .eq("job_posting_id", str(job_id))\
            .order("created_at", desc=True)\
            .execute()

        return [self._parse_interview_with_joins(i) for i in result.data]

    def list_by_job_sync(self, job_id: UUID) -> List[Interview]:
        """Synchronous version of list_by_job."""
        result = self.client.table(self.table)\
            .select("*, candidates(name)")\
            .eq("job_posting_id", str(job_id))\
            .order("created_at", desc=True)\
            .execute()

        return [self._parse_interview_with_joins(i) for i in result.data]

    async def update(
        self,
        interview_id: UUID,
        interview_update: InterviewUpdate
    ) -> Optional[Interview]:
        """Update an interview."""
        update_data = interview_update.model_dump(exclude_unset=True)

        if not update_data:
            return await self.get_by_id(interview_id)

        # Handle enum conversion
        if "status" in update_data:
            status = update_data["status"]
            if isinstance(status, InterviewSessionStatus):
                # Map to database values
                status_map = {
                    InterviewSessionStatus.SCHEDULED: "scheduled",
                    InterviewSessionStatus.IN_PROGRESS: "active",
                    InterviewSessionStatus.COMPLETED: "completed",
                    InterviewSessionStatus.CANCELLED: "cancelled",
                    InterviewSessionStatus.FAILED: "cancelled",
                }
                update_data["status"] = status_map.get(status, "scheduled")

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(interview_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_interview(result.data[0])

    def update_sync(
        self,
        interview_id: UUID,
        interview_update: InterviewUpdate
    ) -> Optional[Interview]:
        """Synchronous version of update."""
        update_data = interview_update.model_dump(exclude_unset=True)

        if not update_data:
            return self.get_by_id_sync(interview_id)

        if "status" in update_data:
            status = update_data["status"]
            if isinstance(status, InterviewSessionStatus):
                status_map = {
                    InterviewSessionStatus.SCHEDULED: "scheduled",
                    InterviewSessionStatus.IN_PROGRESS: "active",
                    InterviewSessionStatus.COMPLETED: "completed",
                    InterviewSessionStatus.CANCELLED: "cancelled",
                    InterviewSessionStatus.FAILED: "cancelled",
                }
                update_data["status"] = status_map.get(status, "scheduled")

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(interview_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_interview(result.data[0])

    async def delete(self, interview_id: UUID) -> bool:
        """Delete an interview."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(interview_id))\
            .execute()

        return len(result.data) > 0

    def delete_sync(self, interview_id: UUID) -> bool:
        """Synchronous version of delete."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(interview_id))\
            .execute()

        return len(result.data) > 0

    def _parse_interview(self, data: dict) -> Interview:
        """Parse database row into Interview model."""
        return Interview(
            id=data.get("id"),
            candidate_id=data.get("candidate_id"),
            interview_type=self._map_interview_type(data.get("interview_type")),
            status=self._map_status(data.get("status", "scheduled")),
            transcript=data.get("transcript"),
            started_at=data.get("started_at"),
            ended_at=data.get("ended_at"),
            duration_seconds=data.get("duration_sec"),
            room_name=data.get("room_name"),
            notes=data.get("notes"),
            created_at=data.get("created_at"),
            updated_at=data.get("created_at"),  # No updated_at in schema
            job_id=data.get("job_posting_id"),
        )

    def _parse_interview_with_joins(self, data: dict) -> Interview:
        """Parse database row with joins into Interview model."""
        interview = self._parse_interview(data)

        if data.get("candidates"):
            interview.candidate_name = data["candidates"].get("name")
            if data["candidates"].get("job_postings"):
                interview.job_title = data["candidates"]["job_postings"].get("title")

        return interview

    def _map_interview_type(self, type_str: Optional[str]) -> InterviewType:
        """Map database interview_type to enum."""
        type_map = {
            "ai_candidate": InterviewType.AI_CANDIDATE,
            "live": InterviewType.LIVE,
            "phone_screen": InterviewType.PHONE_SCREEN,
        }
        return type_map.get(type_str, InterviewType.AI_CANDIDATE)

    def _map_status(self, status_str: str) -> InterviewSessionStatus:
        """Map database status to enum."""
        status_map = {
            "scheduled": InterviewSessionStatus.SCHEDULED,
            "active": InterviewSessionStatus.IN_PROGRESS,
            "completed": InterviewSessionStatus.COMPLETED,
            "cancelled": InterviewSessionStatus.CANCELLED,
        }
        return status_map.get(status_str, InterviewSessionStatus.SCHEDULED)
