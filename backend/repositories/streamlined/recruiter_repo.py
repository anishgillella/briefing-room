"""
Recruiter Repository - Database operations for Recruiter entities.

Handles CRUD operations for recruiters and their performance metrics.
"""

from typing import List, Optional, Tuple
from uuid import UUID
from datetime import datetime

from models.streamlined.recruiter import (
    Recruiter, RecruiterCreate, RecruiterUpdate,
    RecruiterSummary, RecruiterStats
)
from db.client import get_db


class RecruiterRepository:
    """Repository for Recruiter database operations."""

    def __init__(self):
        self.client = get_db()
        self.table = "recruiters"

    def create_sync(self, recruiter_data: RecruiterCreate) -> Recruiter:
        """
        Create a new recruiter.

        Args:
            recruiter_data: RecruiterCreate model with name, email

        Returns:
            Created Recruiter with generated ID and timestamps
        """
        data = {
            "name": recruiter_data.name,
            "email": recruiter_data.email,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create recruiter")

        return self._parse_recruiter(result.data[0])

    def get_by_id_sync(self, recruiter_id: UUID) -> Optional[Recruiter]:
        """Get a recruiter by ID with job counts."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(recruiter_id))\
            .execute()

        if not result.data:
            return None

        recruiter = self._parse_recruiter(result.data[0])

        # Get job counts
        job_counts = self._get_job_counts_sync(recruiter_id)
        recruiter.job_count = job_counts["total"]
        recruiter.active_job_count = job_counts["active"]
        recruiter.total_candidates = self._get_total_candidates_sync(recruiter_id)

        return recruiter

    def get_by_email_sync(self, email: str) -> Optional[Recruiter]:
        """Get a recruiter by email."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("email", email.lower())\
            .execute()

        if not result.data:
            return None

        return self._parse_recruiter(result.data[0])

    def get_or_create_sync(self, recruiter_data: RecruiterCreate) -> Tuple[Recruiter, bool]:
        """
        Get an existing recruiter by email or create a new one.

        Returns:
            Tuple of (Recruiter, created_flag)
        """
        existing = self.get_by_email_sync(recruiter_data.email)
        if existing:
            return existing, False

        new_recruiter = self.create_sync(recruiter_data)
        return new_recruiter, True

    def list_all_sync(self) -> List[Recruiter]:
        """List all recruiters with job counts."""
        result = self.client.table(self.table)\
            .select("*")\
            .order("name")\
            .execute()

        recruiters = []
        for row in result.data:
            recruiter = self._parse_recruiter(row)
            job_counts = self._get_job_counts_sync(recruiter.id)
            recruiter.job_count = job_counts["total"]
            recruiter.active_job_count = job_counts["active"]
            recruiters.append(recruiter)

        return recruiters

    def list_summaries_sync(self) -> List[RecruiterSummary]:
        """List all recruiters as lightweight summaries (for dropdowns)."""
        result = self.client.table(self.table)\
            .select("id, name, email")\
            .order("name")\
            .execute()

        summaries = []
        for row in result.data:
            job_counts = self._get_job_counts_sync(UUID(row["id"]))
            summaries.append(RecruiterSummary(
                id=row["id"],
                name=row["name"],
                email=row["email"],
                job_count=job_counts["total"],
                active_job_count=job_counts["active"],
            ))

        return summaries

    def update_sync(self, recruiter_id: UUID, recruiter_update: RecruiterUpdate) -> Optional[Recruiter]:
        """Update a recruiter."""
        update_data = recruiter_update.model_dump(exclude_unset=True)

        if not update_data:
            return self.get_by_id_sync(recruiter_id)

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(recruiter_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_recruiter(result.data[0])

    def delete_sync(self, recruiter_id: UUID) -> bool:
        """Delete a recruiter."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(recruiter_id))\
            .execute()

        return len(result.data) > 0

    def get_stats_sync(self, recruiter_id: UUID) -> Optional[RecruiterStats]:
        """
        Get comprehensive statistics for a recruiter.

        Includes job counts, candidate counts, and hiring outcomes.
        """
        recruiter = self.get_by_id_sync(recruiter_id)
        if not recruiter:
            return None

        # Get all jobs for this recruiter
        jobs_result = self.client.table("job_postings")\
            .select("id, status")\
            .eq("recruiter_id", str(recruiter_id))\
            .execute()

        jobs = jobs_result.data or []
        job_ids = [j["id"] for j in jobs]

        total_jobs = len(jobs)
        active_jobs = len([j for j in jobs if j["status"] == "active"])
        closed_jobs = len([j for j in jobs if j["status"] == "closed"])

        # Get candidate counts
        total_candidates = 0
        interviewed_candidates = 0
        pending_candidates = 0

        for job_id in job_ids:
            candidates_result = self.client.table("candidates")\
                .select("id, pipeline_status")\
                .eq("job_posting_id", job_id)\
                .execute()

            candidates = candidates_result.data or []
            total_candidates += len(candidates)

            for c in candidates:
                status = c.get("pipeline_status", "pending")
                if status in ["round_1", "round_2", "round_3", "decision_pending", "accepted"]:
                    interviewed_candidates += 1
                elif status == "pending":
                    pending_candidates += 1

        # Get analytics outcomes
        strong_hires = 0
        hires = 0
        maybes = 0
        no_hires = 0
        total_score = 0.0
        score_count = 0

        try:
            for job_id in job_ids:
                analytics_result = self.client.table("interview_analytics")\
                    .select("overall_score, recommendation")\
                    .eq("job_id", job_id)\
                    .execute()

                for a in analytics_result.data or []:
                    rec = a.get("recommendation", "")
                    if rec == "strong_hire":
                        strong_hires += 1
                    elif rec == "hire":
                        hires += 1
                    elif rec == "maybe":
                        maybes += 1
                    elif rec == "no_hire":
                        no_hires += 1

                    if a.get("overall_score"):
                        total_score += a["overall_score"]
                        score_count += 1
        except Exception:
            # Analytics table may not exist or have different schema
            pass

        avg_score = total_score / score_count if score_count > 0 else 0.0
        total_interviewed = strong_hires + hires + maybes + no_hires
        hire_rate = (strong_hires + hires) / total_interviewed if total_interviewed > 0 else 0.0

        return RecruiterStats(
            recruiter_id=recruiter_id,
            recruiter_name=recruiter.name,
            total_jobs=total_jobs,
            active_jobs=active_jobs,
            closed_jobs=closed_jobs,
            total_candidates=total_candidates,
            interviewed_candidates=interviewed_candidates,
            pending_candidates=pending_candidates,
            strong_hires=strong_hires,
            hires=hires,
            maybes=maybes,
            no_hires=no_hires,
            avg_candidate_score=round(avg_score, 1),
            hire_rate=round(hire_rate * 100, 1),
        )

    # Helper methods

    def _parse_recruiter(self, data: dict) -> Recruiter:
        """Parse database row into Recruiter model."""
        return Recruiter(
            id=data.get("id"),
            name=data.get("name", ""),
            email=data.get("email", ""),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    def _get_job_counts_sync(self, recruiter_id: UUID) -> dict:
        """Get job counts for a recruiter."""
        result = self.client.table("job_postings")\
            .select("id, status")\
            .eq("recruiter_id", str(recruiter_id))\
            .execute()

        jobs = result.data or []
        return {
            "total": len(jobs),
            "active": len([j for j in jobs if j["status"] == "active"]),
        }

    def _get_total_candidates_sync(self, recruiter_id: UUID) -> int:
        """Get total candidates across all jobs for a recruiter."""
        # First get all job IDs for this recruiter
        jobs_result = self.client.table("job_postings")\
            .select("id")\
            .eq("recruiter_id", str(recruiter_id))\
            .execute()

        job_ids = [j["id"] for j in jobs_result.data or []]

        if not job_ids:
            return 0

        # Count candidates for these jobs
        total = 0
        for job_id in job_ids:
            count_result = self.client.table("candidates")\
                .select("id", count="exact")\
                .eq("job_posting_id", job_id)\
                .execute()
            total += count_result.count or 0

        return total
