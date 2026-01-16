"""
Recruiters Router - API endpoints for recruiter management.

Handles CRUD operations for recruiters and their performance metrics.
Simple mode: No real authentication, just a selector dropdown.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from uuid import UUID

from models.streamlined.recruiter import (
    Recruiter, RecruiterCreate, RecruiterUpdate,
    RecruiterSummary, RecruiterStats
)
from repositories.streamlined.recruiter_repo import RecruiterRepository

router = APIRouter(prefix="/api/recruiters", tags=["recruiters"])


def get_recruiter_repo() -> RecruiterRepository:
    """Dependency for getting RecruiterRepository instance."""
    return RecruiterRepository()


@router.post("/", response_model=Recruiter)
async def create_recruiter(recruiter_data: RecruiterCreate) -> Recruiter:
    """
    Create a new recruiter.

    Used when a new recruiter needs to be added to the system.
    For simple mode, this is typically done once per recruiter.
    """
    repo = get_recruiter_repo()

    # Check if email already exists
    existing = repo.get_by_email_sync(recruiter_data.email)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Recruiter with email {recruiter_data.email} already exists"
        )

    recruiter = repo.create_sync(recruiter_data)
    return recruiter


@router.get("/", response_model=List[RecruiterSummary])
async def list_recruiters() -> List[RecruiterSummary]:
    """
    List all recruiters (for dropdown selector).

    Returns lightweight summaries with job counts.
    """
    repo = get_recruiter_repo()
    return repo.list_summaries_sync()


@router.get("/{recruiter_id}", response_model=Recruiter)
async def get_recruiter(recruiter_id: UUID) -> Recruiter:
    """Get a single recruiter by ID with full details."""
    repo = get_recruiter_repo()
    recruiter = repo.get_by_id_sync(recruiter_id)

    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    return recruiter


@router.patch("/{recruiter_id}", response_model=Recruiter)
async def update_recruiter(
    recruiter_id: UUID,
    recruiter_update: RecruiterUpdate,
) -> Recruiter:
    """Update a recruiter's details."""
    repo = get_recruiter_repo()
    recruiter = repo.update_sync(recruiter_id, recruiter_update)

    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    return recruiter


@router.delete("/{recruiter_id}")
async def delete_recruiter(recruiter_id: UUID):
    """
    Delete a recruiter.

    Warning: This does NOT delete their jobs - those are preserved
    but will no longer have an owner.
    """
    repo = get_recruiter_repo()
    success = repo.delete_sync(recruiter_id)

    if not success:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    return {"message": "Recruiter deleted successfully", "recruiter_id": str(recruiter_id)}


@router.get("/{recruiter_id}/stats", response_model=RecruiterStats)
async def get_recruiter_stats(recruiter_id: UUID) -> RecruiterStats:
    """
    Get comprehensive statistics for a recruiter.

    Includes:
    - Job counts (total, active, closed)
    - Candidate counts (total, interviewed, pending)
    - Hiring outcomes (strong_hire, hire, maybe, no_hire)
    - Performance metrics (avg score, hire rate)
    """
    repo = get_recruiter_repo()
    stats = repo.get_stats_sync(recruiter_id)

    if not stats:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    return stats


@router.get("/{recruiter_id}/jobs")
async def get_recruiter_jobs(
    recruiter_id: UUID,
    status: Optional[str] = None,
):
    """
    Get all jobs for a specific recruiter.

    Args:
        recruiter_id: UUID of the recruiter
        status: Optional filter - one of 'draft', 'active', 'paused', 'closed'
    """
    from repositories.streamlined.job_repo import JobRepository

    recruiter_repo = get_recruiter_repo()
    job_repo = JobRepository()

    # Verify recruiter exists
    recruiter = recruiter_repo.get_by_id_sync(recruiter_id)
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    # Get jobs for this recruiter
    jobs = job_repo.list_all_sync(status=status, recruiter_id=recruiter_id)

    return {
        "recruiter_id": str(recruiter_id),
        "recruiter_name": recruiter.name,
        "jobs": [
            {
                "id": str(j.id),
                "title": j.title,
                "status": j.status,
                "candidate_count": j.candidate_count,
                "interviewed_count": j.interviewed_count,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in jobs
        ],
        "total": len(jobs),
    }


@router.post("/login")
async def simple_login(email: str):
    """
    Simple "login" - just returns recruiter by email.

    For simple mode without real authentication.
    Creates a new recruiter if one doesn't exist with this email.
    """
    repo = get_recruiter_repo()

    recruiter = repo.get_by_email_sync(email)

    if not recruiter:
        # Auto-create with email as name (can be updated later)
        name = email.split("@")[0].replace(".", " ").title()
        recruiter = repo.create_sync(RecruiterCreate(
            name=name,
            email=email,
        ))

    return {
        "recruiter_id": str(recruiter.id),
        "name": recruiter.name,
        "email": recruiter.email,
    }
