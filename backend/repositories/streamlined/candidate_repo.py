"""
Candidate Repository - Database operations for Candidate entities.

Handles CRUD operations for candidates (Person + Job junction).
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from models.streamlined.candidate import (
    Candidate, CandidateCreate, CandidateUpdate, InterviewStatus
)
from db.client import get_db


class CandidateRepository:
    """Repository for Candidate database operations."""

    def __init__(self):
        self.client = get_db()
        self.table = "candidates"

    async def create(self, candidate_data: CandidateCreate) -> Candidate:
        """Create a new candidate."""
        data = {
            "person_id": str(candidate_data.person_id),
            "job_posting_id": str(candidate_data.job_id),
            "name": "",  # Will be populated from person
            "email": "",  # Will be populated from person
            "bio_summary": candidate_data.bio_summary,
            "skills": candidate_data.skills,
            "years_experience": candidate_data.years_experience,
            "current_company": candidate_data.current_company,
            "job_title": candidate_data.current_title,
            "pipeline_status": "new",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        # Get person info to populate name/email
        person_result = self.client.table("persons")\
            .select("name, email")\
            .eq("id", str(candidate_data.person_id))\
            .execute()

        if person_result.data:
            data["name"] = person_result.data[0]["name"]
            data["email"] = person_result.data[0]["email"]

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create candidate")

        return self._parse_candidate(result.data[0])

    def create_sync(self, candidate_data: CandidateCreate) -> Candidate:
        """Synchronous version of create."""
        data = {
            "person_id": str(candidate_data.person_id),
            "job_posting_id": str(candidate_data.job_id),
            "name": "",
            "email": "",
            "bio_summary": candidate_data.bio_summary,
            "skills": candidate_data.skills,
            "years_experience": candidate_data.years_experience,
            "current_company": candidate_data.current_company,
            "job_title": candidate_data.current_title,
            "pipeline_status": "new",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        person_result = self.client.table("persons")\
            .select("name, email")\
            .eq("id", str(candidate_data.person_id))\
            .execute()

        if person_result.data:
            data["name"] = person_result.data[0]["name"]
            data["email"] = person_result.data[0]["email"]

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create candidate")

        return self._parse_candidate(result.data[0])

    async def get_by_id(self, candidate_id: UUID) -> Optional[Candidate]:
        """Get a candidate by ID with joined person and job data."""
        result = self.client.table(self.table)\
            .select("*, persons(name, email), job_postings(title)")\
            .eq("id", str(candidate_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_candidate_with_joins(result.data[0])

    def get_by_id_sync(self, candidate_id: UUID) -> Optional[Candidate]:
        """Synchronous version of get_by_id."""
        result = self.client.table(self.table)\
            .select("*, persons(name, email), job_postings(title)")\
            .eq("id", str(candidate_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_candidate_with_joins(result.data[0])

    async def get_by_person_and_job(
        self,
        person_id: UUID,
        job_id: UUID
    ) -> Optional[Candidate]:
        """Check if a candidate record exists for this person + job combo."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("person_id", str(person_id))\
            .eq("job_posting_id", str(job_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_candidate(result.data[0])

    def get_by_person_and_job_sync(
        self,
        person_id: UUID,
        job_id: UUID
    ) -> Optional[Candidate]:
        """Synchronous version of get_by_person_and_job."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("person_id", str(person_id))\
            .eq("job_posting_id", str(job_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_candidate(result.data[0])

    async def list_by_job(
        self,
        job_id: UUID,
        status: Optional[str] = None
    ) -> List[Candidate]:
        """List all candidates for a job."""
        query = self.client.table(self.table)\
            .select("*, persons(name, email)")\
            .eq("job_posting_id", str(job_id))

        if status:
            query = query.eq("pipeline_status", status)

        result = query.order("created_at", desc=True).execute()

        candidates = []
        for data in result.data:
            candidates.append(self._parse_candidate_with_joins(data))

        return candidates

    def list_by_job_sync(
        self,
        job_id: UUID,
        status: Optional[str] = None
    ) -> List[Candidate]:
        """Synchronous version of list_by_job."""
        query = self.client.table(self.table)\
            .select("*, persons(name, email)")\
            .eq("job_posting_id", str(job_id))

        if status:
            query = query.eq("pipeline_status", status)

        result = query.order("created_at", desc=True).execute()

        candidates = []
        for data in result.data:
            candidates.append(self._parse_candidate_with_joins(data))

        return candidates

    async def list_by_person(self, person_id: UUID) -> List[Candidate]:
        """List all job applications for a person."""
        result = self.client.table(self.table)\
            .select("*, job_postings(title, status)")\
            .eq("person_id", str(person_id))\
            .execute()

        candidates = []
        for data in result.data:
            candidates.append(self._parse_candidate_with_joins(data))

        return candidates

    def list_by_person_sync(self, person_id: UUID) -> List[Candidate]:
        """Synchronous version of list_by_person."""
        result = self.client.table(self.table)\
            .select("*, job_postings(title, status)")\
            .eq("person_id", str(person_id))\
            .execute()

        candidates = []
        for data in result.data:
            candidates.append(self._parse_candidate_with_joins(data))

        return candidates

    async def update(
        self,
        candidate_id: UUID,
        candidate_update: CandidateUpdate
    ) -> Optional[Candidate]:
        """Update a candidate."""
        update_data = candidate_update.model_dump(exclude_unset=True)

        if not update_data:
            return await self.get_by_id(candidate_id)

        # Map model fields to database columns
        if "interview_status" in update_data:
            status = update_data.pop("interview_status")
            if isinstance(status, InterviewStatus):
                # Map our status enum to database values
                status_map = {
                    InterviewStatus.PENDING: "new",
                    InterviewStatus.SCHEDULED: "new",
                    InterviewStatus.IN_PROGRESS: "round_1",
                    InterviewStatus.COMPLETED: "decision_pending",
                    InterviewStatus.REJECTED: "rejected",
                }
                update_data["pipeline_status"] = status_map.get(status, "new")
            else:
                update_data["pipeline_status"] = status

        if "current_title" in update_data:
            update_data["job_title"] = update_data.pop("current_title")

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(candidate_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_candidate(result.data[0])

    def update_sync(
        self,
        candidate_id: UUID,
        candidate_update: CandidateUpdate
    ) -> Optional[Candidate]:
        """Synchronous version of update."""
        update_data = candidate_update.model_dump(exclude_unset=True)

        if not update_data:
            return self.get_by_id_sync(candidate_id)

        if "interview_status" in update_data:
            status = update_data.pop("interview_status")
            if isinstance(status, InterviewStatus):
                status_map = {
                    InterviewStatus.PENDING: "new",
                    InterviewStatus.SCHEDULED: "new",
                    InterviewStatus.IN_PROGRESS: "round_1",
                    InterviewStatus.COMPLETED: "decision_pending",
                    InterviewStatus.REJECTED: "rejected",
                }
                update_data["pipeline_status"] = status_map.get(status, "new")
            else:
                update_data["pipeline_status"] = status

        if "current_title" in update_data:
            update_data["job_title"] = update_data.pop("current_title")

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(candidate_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_candidate(result.data[0])

    async def delete(self, candidate_id: UUID) -> bool:
        """Delete a candidate."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(candidate_id))\
            .execute()

        return len(result.data) > 0

    def delete_sync(self, candidate_id: UUID) -> bool:
        """Synchronous version of delete."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(candidate_id))\
            .execute()

        return len(result.data) > 0

    def _parse_candidate(self, data: dict) -> Candidate:
        """Parse database row into Candidate model."""
        return Candidate(
            id=data.get("id"),
            person_id=data.get("person_id"),
            job_id=data.get("job_posting_id"),
            bio_summary=data.get("bio_summary"),
            skills=data.get("skills", []) or [],
            years_experience=data.get("years_experience"),
            current_company=data.get("current_company"),
            current_title=data.get("job_title"),
            combined_score=data.get("combined_score"),
            screening_notes=data.get("screening_notes"),
            interview_status=self._map_pipeline_status(data.get("pipeline_status", "new")),
            pipeline_status=data.get("pipeline_status"),
            notes=data.get("notes"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
            person_name=data.get("name"),
            person_email=data.get("email"),
        )

    def _parse_candidate_with_joins(self, data: dict) -> Candidate:
        """Parse database row with joins into Candidate model."""
        candidate = self._parse_candidate(data)

        # Handle joined person data
        if data.get("persons"):
            candidate.person_name = data["persons"].get("name")
            candidate.person_email = data["persons"].get("email")

        # Handle joined job data
        if data.get("job_postings"):
            candidate.job_title = data["job_postings"].get("title")

        return candidate

    def _map_pipeline_status(self, status: str) -> InterviewStatus:
        """Map database pipeline_status to InterviewStatus enum."""
        status_map = {
            "new": InterviewStatus.PENDING,
            "round_1": InterviewStatus.IN_PROGRESS,
            "round_2": InterviewStatus.IN_PROGRESS,
            "round_3": InterviewStatus.IN_PROGRESS,
            "decision_pending": InterviewStatus.COMPLETED,
            "accepted": InterviewStatus.COMPLETED,
            "rejected": InterviewStatus.REJECTED,
        }
        return status_map.get(status, InterviewStatus.PENDING)
