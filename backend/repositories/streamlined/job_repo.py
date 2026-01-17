"""
Job Repository - Database operations for Job entities.

Handles CRUD operations for jobs including their extracted requirements,
company context, and scoring criteria.

Phase 4: Organization scoping - All queries filtered by organization_id.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from models.streamlined.job import (
    Job, JobCreate, JobUpdate, JobStatus,
    ExtractedRequirements, CompanyContext, ScoringCriteria
)
from db.client import get_db


class JobRepository:
    """Repository for Job database operations."""

    def __init__(self):
        self.client = get_db()
        self.table = "job_postings"

    # =========================================================================
    # Organization-Scoped Methods (Phase 4)
    # =========================================================================

    def list_all_for_org_sync(
        self,
        organization_id: UUID,
        status: Optional[str] = None,
        recruiter_id: Optional[UUID] = None,
        include_archived: bool = False
    ) -> List[Job]:
        """
        List all jobs for an organization.

        Args:
            organization_id: UUID of the organization
            status: Optional status filter
            recruiter_id: Optional recruiter filter
            include_archived: If True, include archived (soft-deleted) jobs

        Returns:
            List of jobs belonging to the organization
        """
        query = self.client.table(self.table)\
            .select("*")\
            .eq("organization_id", str(organization_id))

        if status:
            query = query.eq("status", status)

        if recruiter_id:
            query = query.eq("recruiter_id", str(recruiter_id))

        # Try to exclude archived jobs if the column exists
        try:
            if not include_archived:
                query_with_filter = query.is_("deleted_at", "null")
                result = query_with_filter.order("created_at", desc=True).execute()
            else:
                result = query.order("created_at", desc=True).execute()
        except Exception as e:
            # Column might not exist yet (migration not run)
            # Fallback to query without soft delete filter
            if "deleted_at" in str(e):
                result = query.order("created_at", desc=True).execute()
            else:
                raise e

        jobs = []
        for job_data in result.data:
            job = self._parse_job(job_data)
            job.candidate_count = self._get_candidate_count_sync(job.id)
            job.interviewed_count = self._get_interviewed_count_sync(job.id)
            jobs.append(job)

        return jobs

    def list_archived_for_org_sync(
        self,
        organization_id: UUID,
    ) -> List[Job]:
        """
        List all archived (soft-deleted) jobs for an organization.

        Args:
            organization_id: UUID of the organization

        Returns:
            List of archived jobs belonging to the organization
        """
        query = self.client.table(self.table)\
            .select("*")\
            .eq("organization_id", str(organization_id))\
            .not_.is_("deleted_at", "null")

        result = query.order("deleted_at", desc=True).execute()

        jobs = []
        for job_data in result.data:
            job = self._parse_job(job_data)
            job.candidate_count = self._get_candidate_count_sync(job.id)
            job.interviewed_count = self._get_interviewed_count_sync(job.id)
            jobs.append(job)

        return jobs

    def get_by_id_for_org_sync(
        self,
        job_id: UUID,
        organization_id: UUID
    ) -> Optional[Job]:
        """
        Get a job by ID, verifying it belongs to the organization.

        Args:
            job_id: UUID of the job
            organization_id: UUID of the organization

        Returns:
            Job if found and belongs to org, None otherwise
        """
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(job_id))\
            .eq("organization_id", str(organization_id))\
            .execute()

        if not result.data:
            return None

        job = self._parse_job(result.data[0])
        job.candidate_count = self._get_candidate_count_sync(job_id)
        job.interviewed_count = self._get_interviewed_count_sync(job_id)

        return job

    def create_for_org_sync(
        self,
        job_data: JobCreate,
        organization_id: UUID,
        created_by_recruiter_id: UUID
    ) -> Job:
        """
        Create a job within an organization.

        Args:
            job_data: JobCreate model with title, description, status
            organization_id: UUID of the organization
            created_by_recruiter_id: UUID of the creating recruiter

        Returns:
            Created Job with generated ID and timestamps
        """
        data = {
            "title": job_data.title,
            "description": job_data.raw_description,
            "status": job_data.status.value if isinstance(job_data.status, JobStatus) else job_data.status,
            "organization_id": str(organization_id),
            "recruiter_id": str(created_by_recruiter_id),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create job")

        return self._parse_job(result.data[0])

    def update_for_org_sync(
        self,
        job_id: UUID,
        organization_id: UUID,
        job_update: JobUpdate
    ) -> Optional[Job]:
        """
        Update a job, verifying it belongs to the organization.

        Args:
            job_id: UUID of the job
            organization_id: UUID of the organization
            job_update: JobUpdate model with fields to update

        Returns:
            Updated Job if found and belongs to org, None otherwise
        """
        # First verify access
        existing = self.get_by_id_for_org_sync(job_id, organization_id)
        if not existing:
            return None

        update_data = self._prepare_update_data(job_update)

        if not update_data:
            return existing

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(job_id))\
            .eq("organization_id", str(organization_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_job(result.data[0])

    def delete_for_org_sync(self, job_id: UUID, organization_id: UUID) -> bool:
        """
        Soft delete (archive) a job, verifying it belongs to the organization.

        This sets deleted_at timestamp instead of actually deleting the record.
        Use permanent_delete_for_org_sync for hard delete.

        Args:
            job_id: UUID of the job
            organization_id: UUID of the organization

        Returns:
            True if archived, False if not found or doesn't belong to org
        """
        # First verify access
        existing = self.get_by_id_for_org_sync(job_id, organization_id)
        if not existing:
            return False

        # Soft delete by setting deleted_at
        result = self.client.table(self.table)\
            .update({"deleted_at": datetime.utcnow().isoformat()})\
            .eq("id", str(job_id))\
            .eq("organization_id", str(organization_id))\
            .execute()

        return len(result.data) > 0

    def archive_for_org_sync(self, job_id: UUID, organization_id: UUID) -> Optional[Job]:
        """
        Archive (soft delete) a job, verifying it belongs to the organization.

        Args:
            job_id: UUID of the job
            organization_id: UUID of the organization

        Returns:
            Archived Job if successful, None if not found
        """
        # First verify access
        existing = self.get_by_id_for_org_sync(job_id, organization_id)
        if not existing:
            return None

        # Soft delete by setting deleted_at
        result = self.client.table(self.table)\
            .update({
                "deleted_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            })\
            .eq("id", str(job_id))\
            .eq("organization_id", str(organization_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_job(result.data[0])

    def restore_for_org_sync(self, job_id: UUID, organization_id: UUID) -> Optional[Job]:
        """
        Restore an archived job, verifying it belongs to the organization.

        Args:
            job_id: UUID of the job
            organization_id: UUID of the organization

        Returns:
            Restored Job if successful, None if not found or not archived
        """
        # Get the job including archived ones
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(job_id))\
            .eq("organization_id", str(organization_id))\
            .execute()

        if not result.data:
            return None

        job_data = result.data[0]
        if not job_data.get("deleted_at"):
            # Job is not archived, nothing to restore
            return self._parse_job(job_data)

        # Restore by clearing deleted_at
        result = self.client.table(self.table)\
            .update({
                "deleted_at": None,
                "updated_at": datetime.utcnow().isoformat()
            })\
            .eq("id", str(job_id))\
            .eq("organization_id", str(organization_id))\
            .execute()

        if not result.data:
            return None

        job = self._parse_job(result.data[0])
        job.candidate_count = self._get_candidate_count_sync(job_id)
        job.interviewed_count = self._get_interviewed_count_sync(job_id)

        return job

    def permanent_delete_for_org_sync(self, job_id: UUID, organization_id: UUID) -> bool:
        """
        Permanently delete a job and all its data.

        WARNING: This is irreversible. Prefer archive_for_org_sync for soft delete.
        Note: Due to ON DELETE SET NULL, candidates/interviews/analytics will have
        their job_posting_id set to NULL but will not be deleted.

        Args:
            job_id: UUID of the job
            organization_id: UUID of the organization

        Returns:
            True if permanently deleted, False if not found
        """
        # Get the job including archived ones
        result = self.client.table(self.table)\
            .select("id")\
            .eq("id", str(job_id))\
            .eq("organization_id", str(organization_id))\
            .execute()

        if not result.data:
            return False

        # Hard delete
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(job_id))\
            .eq("organization_id", str(organization_id))\
            .execute()

        return len(result.data) > 0

    def get_archived_by_id_for_org_sync(
        self,
        job_id: UUID,
        organization_id: UUID
    ) -> Optional[Job]:
        """
        Get an archived job by ID, verifying it belongs to the organization.

        Args:
            job_id: UUID of the job
            organization_id: UUID of the organization

        Returns:
            Job if found and archived, None otherwise
        """
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(job_id))\
            .eq("organization_id", str(organization_id))\
            .not_.is_("deleted_at", "null")\
            .execute()

        if not result.data:
            return None

        job = self._parse_job(result.data[0])
        job.candidate_count = self._get_candidate_count_sync(job_id)
        job.interviewed_count = self._get_interviewed_count_sync(job_id)

        return job

    # =========================================================================
    # Original Methods (kept for backward compatibility / internal use)
    # =========================================================================

    async def create(self, job_data: JobCreate) -> Job:
        """
        Create a new job.

        Args:
            job_data: JobCreate model with title, description, status

        Returns:
            Created Job with generated ID and timestamps
        """
        data = {
            "title": job_data.title,
            "description": job_data.raw_description,
            "status": job_data.status.value if isinstance(job_data.status, JobStatus) else job_data.status,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create job")

        return self._parse_job(result.data[0])

    def create_sync(self, job_data: JobCreate) -> Job:
        """Synchronous version of create."""
        data = {
            "title": job_data.title,
            "description": job_data.raw_description,
            "status": job_data.status.value if isinstance(job_data.status, JobStatus) else job_data.status,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        # Add recruiter_id if provided
        if job_data.recruiter_id:
            data["recruiter_id"] = str(job_data.recruiter_id)

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create job")

        return self._parse_job(result.data[0])

    async def get_by_id(self, job_id: UUID) -> Optional[Job]:
        """
        Get a job by ID.

        Args:
            job_id: UUID of the job

        Returns:
            Job if found, None otherwise
        """
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(job_id))\
            .execute()

        if not result.data:
            return None

        job = self._parse_job(result.data[0])

        # Get candidate counts
        job.candidate_count = await self._get_candidate_count(job_id)
        job.interviewed_count = await self._get_interviewed_count(job_id)

        return job

    def get_by_id_sync(self, job_id: UUID) -> Optional[Job]:
        """Synchronous version of get_by_id."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(job_id))\
            .execute()

        if not result.data:
            return None

        job = self._parse_job(result.data[0])

        # Get candidate counts
        job.candidate_count = self._get_candidate_count_sync(job_id)
        job.interviewed_count = self._get_interviewed_count_sync(job_id)

        return job

    async def list_all(self, status: Optional[JobStatus] = None) -> List[Job]:
        """
        List all jobs, optionally filtered by status.

        Args:
            status: Optional status filter

        Returns:
            List of jobs with candidate counts
        """
        query = self.client.table(self.table).select("*")

        if status:
            status_value = status.value if isinstance(status, JobStatus) else status
            query = query.eq("status", status_value)

        result = query.order("created_at", desc=True).execute()

        jobs = []
        for job_data in result.data:
            job = self._parse_job(job_data)
            job.candidate_count = await self._get_candidate_count(job.id)
            job.interviewed_count = await self._get_interviewed_count(job.id)
            jobs.append(job)

        return jobs

    def list_all_sync(self, status: Optional[str] = None, recruiter_id: Optional[UUID] = None) -> List[Job]:
        """Synchronous version of list_all."""
        query = self.client.table(self.table).select("*")

        if status:
            query = query.eq("status", status)

        if recruiter_id:
            query = query.eq("recruiter_id", str(recruiter_id))

        result = query.order("created_at", desc=True).execute()

        jobs = []
        for job_data in result.data:
            job = self._parse_job(job_data)
            job.candidate_count = self._get_candidate_count_sync(job.id)
            job.interviewed_count = self._get_interviewed_count_sync(job.id)
            jobs.append(job)

        return jobs

    async def update(self, job_id: UUID, job_update: JobUpdate) -> Optional[Job]:
        """
        Update a job.

        Args:
            job_id: UUID of the job to update
            job_update: JobUpdate model with fields to update

        Returns:
            Updated Job if found, None otherwise
        """
        update_data = self._prepare_update_data(job_update)

        if not update_data:
            return await self.get_by_id(job_id)

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(job_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_job(result.data[0])

    def update_sync(self, job_id: UUID, job_update: JobUpdate) -> Optional[Job]:
        """Synchronous version of update."""
        update_data = self._prepare_update_data(job_update)

        if not update_data:
            return self.get_by_id_sync(job_id)

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(job_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_job(result.data[0])

    async def delete(self, job_id: UUID) -> bool:
        """
        Delete a job.

        Note: This will cascade delete all associated candidates,
        interviews, and analytics.

        Args:
            job_id: UUID of the job to delete

        Returns:
            True if deleted, False if not found
        """
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(job_id))\
            .execute()

        return len(result.data) > 0

    def delete_sync(self, job_id: UUID) -> bool:
        """Synchronous version of delete."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(job_id))\
            .execute()

        return len(result.data) > 0

    async def activate(self, job_id: UUID) -> Optional[Job]:
        """
        Activate a job (change status from draft to active).

        Args:
            job_id: UUID of the job to activate

        Returns:
            Updated Job if successful, None if not found
        """
        return await self.update(job_id, JobUpdate(status=JobStatus.ACTIVE))

    async def close(self, job_id: UUID) -> Optional[Job]:
        """
        Close a job (position filled or cancelled).

        Args:
            job_id: UUID of the job to close

        Returns:
            Updated Job if successful, None if not found
        """
        return await self.update(job_id, JobUpdate(status=JobStatus.CLOSED))

    # Helper methods

    def _prepare_update_data(self, job_update: JobUpdate) -> dict:
        """Convert JobUpdate to database update dict."""
        update_data = job_update.model_dump(exclude_unset=True)

        # Handle nested models
        if "extracted_requirements" in update_data and update_data["extracted_requirements"]:
            if hasattr(update_data["extracted_requirements"], "model_dump"):
                update_data["extracted_requirements"] = update_data["extracted_requirements"].model_dump()

        if "company_context" in update_data and update_data["company_context"]:
            if hasattr(update_data["company_context"], "model_dump"):
                update_data["company_context_enriched"] = update_data.pop("company_context").model_dump()
            else:
                update_data["company_context_enriched"] = update_data.pop("company_context")

        if "scoring_criteria" in update_data and update_data["scoring_criteria"]:
            if hasattr(update_data["scoring_criteria"], "model_dump"):
                update_data["scoring_criteria"] = update_data["scoring_criteria"].model_dump()

        if "status" in update_data:
            if isinstance(update_data["status"], JobStatus):
                update_data["status"] = update_data["status"].value

        # Map raw_description to description column
        if "raw_description" in update_data:
            update_data["description"] = update_data.pop("raw_description")

        # Convert recruiter_id UUID to string
        if "recruiter_id" in update_data and update_data["recruiter_id"]:
            update_data["recruiter_id"] = str(update_data["recruiter_id"])

        return update_data

    def _parse_job(self, data: dict) -> Job:
        """Parse database row into Job model."""
        # Map database columns to model fields
        # Handle deleted_at which may not exist if migration hasn't run
        deleted_at = data.get("deleted_at") if "deleted_at" in data else None
        job_data = {
            "id": data.get("id"),
            "title": data.get("title", ""),
            "raw_description": data.get("description", ""),
            "status": data.get("status", "draft"),
            "recruiter_id": data.get("recruiter_id"),
            "created_at": data.get("created_at"),
            "updated_at": data.get("updated_at"),
            "deleted_at": deleted_at,
            "is_archived": deleted_at is not None,
            "red_flags": data.get("red_flags", []) or [],
        }

        # Parse nested JSONB fields
        if data.get("extracted_requirements"):
            try:
                job_data["extracted_requirements"] = ExtractedRequirements(
                    **data["extracted_requirements"]
                )
            except Exception:
                # Handle legacy format (list of strings instead of WeightedAttributes)
                req_data = data["extracted_requirements"]
                # Convert old string arrays to WeightedAttribute format if needed
                for field in ["required_skills", "preferred_skills", "success_signals",
                             "red_flags", "behavioral_traits", "cultural_indicators", "deal_breakers"]:
                    if field in req_data and req_data[field]:
                        items = req_data[field]
                        if items and isinstance(items[0], str):
                            # Convert strings to weighted attributes
                            req_data[field] = [{"value": item, "weight": 0.7} for item in items]
                job_data["extracted_requirements"] = ExtractedRequirements(**req_data)

        if data.get("company_context_enriched"):
            job_data["company_context"] = CompanyContext(
                **data["company_context_enriched"]
            )
        elif data.get("company_context"):
            # Legacy column
            job_data["company_context"] = CompanyContext(
                company_description=data["company_context"]
            )

        if data.get("scoring_criteria"):
            job_data["scoring_criteria"] = ScoringCriteria(
                **data["scoring_criteria"]
            )

        return Job(**job_data)

    async def _get_candidate_count(self, job_id: UUID) -> int:
        """Get count of candidates for a job."""
        result = self.client.table("candidates")\
            .select("id", count="exact")\
            .eq("job_posting_id", str(job_id))\
            .execute()
        return result.count or 0

    def _get_candidate_count_sync(self, job_id: UUID) -> int:
        """Synchronous version of _get_candidate_count."""
        result = self.client.table("candidates")\
            .select("id", count="exact")\
            .eq("job_posting_id", str(job_id))\
            .execute()
        return result.count or 0

    async def _get_interviewed_count(self, job_id: UUID) -> int:
        """Get count of interviewed candidates for a job."""
        result = self.client.table("candidates")\
            .select("id", count="exact")\
            .eq("job_posting_id", str(job_id))\
            .in_("pipeline_status", ["round_1", "round_2", "round_3", "decision_pending", "accepted"])\
            .execute()
        return result.count or 0

    def _get_interviewed_count_sync(self, job_id: UUID) -> int:
        """Synchronous version of _get_interviewed_count."""
        result = self.client.table("candidates")\
            .select("id", count="exact")\
            .eq("job_posting_id", str(job_id))\
            .in_("pipeline_status", ["round_1", "round_2", "round_3", "decision_pending", "accepted"])\
            .execute()
        return result.count or 0
