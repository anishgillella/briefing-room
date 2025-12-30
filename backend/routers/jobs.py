"""
Jobs Router - API endpoints for job management.

Handles CRUD operations for jobs including creation, listing,
updating, and deletion with JD extraction.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Optional
from uuid import UUID

from models.streamlined.job import (
    Job, JobCreate, JobUpdate, JobStatus, JobSummary
)
from repositories.streamlined.job_repo import JobRepository
from services.jd_extractor import trigger_jd_extraction_for_job

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def get_job_repo() -> JobRepository:
    """Dependency for getting JobRepository instance."""
    return JobRepository()


@router.post("/", response_model=Job)
async def create_job(
    job_data: JobCreate,
    background_tasks: BackgroundTasks,
) -> Job:
    """
    Create a new job.

    1. Saves the raw job description
    2. Triggers AI extraction of requirements (async)
    3. Returns the job with status 'draft'
    """
    repo = get_job_repo()

    # Create the job record
    job = repo.create_sync(job_data)

    # Trigger async extraction (non-blocking)
    if job_data.raw_description and len(job_data.raw_description) > 50:
        background_tasks.add_task(
            trigger_jd_extraction_for_job,
            str(job.id),
            job_data.raw_description
        )

    return job


@router.get("/", response_model=List[Job])
async def list_jobs(
    status: Optional[str] = None,
) -> List[Job]:
    """
    List all jobs, optionally filtered by status.

    Args:
        status: Optional filter - one of 'draft', 'active', 'paused', 'closed'

    Returns:
        List of jobs with candidate counts
    """
    repo = get_job_repo()
    jobs = repo.list_all_sync(status=status)
    return jobs


@router.get("/active", response_model=List[Job])
async def list_active_jobs() -> List[Job]:
    """List all active jobs only."""
    repo = get_job_repo()
    jobs = repo.list_all_sync(status="active")
    return jobs


@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: UUID) -> Job:
    """Get a single job by ID with all details."""
    repo = get_job_repo()
    job = repo.get_by_id_sync(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.patch("/{job_id}", response_model=Job)
async def update_job(
    job_id: UUID,
    job_update: JobUpdate,
) -> Job:
    """
    Update a job's details.

    Can update:
    - title, raw_description, status
    - extracted_requirements (after voice agent enrichment)
    - company_context (after voice agent enrichment)
    - scoring_criteria, red_flags
    """
    repo = get_job_repo()
    job = repo.update_sync(job_id, job_update)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.delete("/{job_id}")
async def delete_job(job_id: UUID):
    """
    Delete a job.

    Warning: This will also delete all associated candidates,
    interviews, and analytics (cascade delete).
    """
    repo = get_job_repo()
    success = repo.delete_sync(job_id)

    if not success:
        raise HTTPException(status_code=404, detail="Job not found")

    return {"message": "Job deleted successfully", "job_id": str(job_id)}


@router.post("/{job_id}/activate", response_model=Job)
async def activate_job(job_id: UUID) -> Job:
    """
    Activate a job (move from draft to active).

    Prerequisites:
    - Job should have extracted_requirements (from JD)
    - Job should ideally have scoring_criteria (from voice agent)
    """
    repo = get_job_repo()
    job = repo.get_by_id_sync(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if job has minimum requirements
    if not job.extracted_requirements:
        raise HTTPException(
            status_code=400,
            detail="Job should have extracted requirements before activation. Wait for JD extraction to complete."
        )

    # Update status
    updated = repo.update_sync(job_id, JobUpdate(status=JobStatus.ACTIVE))
    return updated


@router.post("/{job_id}/pause", response_model=Job)
async def pause_job(job_id: UUID) -> Job:
    """Pause a job (temporarily stop reviewing candidates)."""
    repo = get_job_repo()
    updated = repo.update_sync(job_id, JobUpdate(status=JobStatus.PAUSED))

    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")

    return updated


@router.post("/{job_id}/close", response_model=Job)
async def close_job(job_id: UUID) -> Job:
    """Close a job (position filled or cancelled)."""
    repo = get_job_repo()
    updated = repo.update_sync(job_id, JobUpdate(status=JobStatus.CLOSED))

    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")

    return updated


@router.post("/{job_id}/reopen", response_model=Job)
async def reopen_job(job_id: UUID) -> Job:
    """Reopen a closed or paused job."""
    repo = get_job_repo()
    updated = repo.update_sync(job_id, JobUpdate(status=JobStatus.ACTIVE))

    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")

    return updated


@router.post("/{job_id}/extract", response_model=Job)
async def trigger_extraction(
    job_id: UUID,
    background_tasks: BackgroundTasks,
) -> Job:
    """
    Manually trigger JD extraction for a job.

    Useful if automatic extraction failed or you updated the description.
    """
    repo = get_job_repo()
    job = repo.get_by_id_sync(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.raw_description or len(job.raw_description) < 50:
        raise HTTPException(
            status_code=400,
            detail="Job description is too short for extraction"
        )

    # Trigger extraction in background
    background_tasks.add_task(
        trigger_jd_extraction_for_job,
        str(job_id),
        job.raw_description
    )

    return job


@router.get("/{job_id}/candidates")
async def get_job_candidates(
    job_id: UUID,
    status: Optional[str] = None,
):
    """
    Get all candidates for a specific job.

    This endpoint will be fully implemented in Phase 4.
    """
    from repositories.streamlined.candidate_repo import CandidateRepository

    repo = get_job_repo()
    job = repo.get_by_id_sync(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate_repo = CandidateRepository()
    candidates = candidate_repo.list_by_job_sync(job_id, status=status)

    return {
        "job_id": str(job_id),
        "job_title": job.title,
        "candidates": candidates,
        "total": len(candidates),
    }


@router.get("/{job_id}/analytics/summary")
async def get_job_analytics_summary(job_id: UUID):
    """
    Get aggregated analytics for all candidates in a job.

    This endpoint will be fully implemented in Phase 6.
    """
    from repositories.streamlined.analytics_repo import AnalyticsRepository

    repo = get_job_repo()
    job = repo.get_by_id_sync(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    analytics_repo = AnalyticsRepository()

    try:
        analytics_list = analytics_repo.list_by_job_sync(job_id)
    except Exception:
        analytics_list = []

    if not analytics_list:
        return {
            "job_id": str(job_id),
            "job_title": job.title,
            "total_candidates": 0,
            "avg_score": 0,
            "recommendation_breakdown": {},
            "top_candidates": [],
        }

    # Calculate aggregates
    scores = [a.overall_score for a in analytics_list if a.overall_score]
    avg_score = sum(scores) / len(scores) if scores else 0

    # Count recommendations
    rec_breakdown = {}
    for a in analytics_list:
        rec = a.recommendation.value if hasattr(a.recommendation, 'value') else str(a.recommendation)
        rec_breakdown[rec] = rec_breakdown.get(rec, 0) + 1

    # Get top candidates
    sorted_analytics = sorted(
        analytics_list,
        key=lambda a: a.overall_score or 0,
        reverse=True
    )
    top_candidates = [
        {
            "candidate_name": a.candidate_name,
            "score": a.overall_score,
            "recommendation": a.recommendation.value if hasattr(a.recommendation, 'value') else str(a.recommendation),
        }
        for a in sorted_analytics[:5]
    ]

    return {
        "job_id": str(job_id),
        "job_title": job.title,
        "total_candidates": len(analytics_list),
        "avg_score": round(avg_score, 1),
        "recommendation_breakdown": rec_breakdown,
        "top_candidates": top_candidates,
    }
