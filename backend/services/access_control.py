"""
Access Control Service - Organization-based access verification.

Phase 4: Provides helper functions to verify that resources belong
to the authenticated user's organization.
"""

from uuid import UUID
from fastapi import HTTPException, status
from db.client import get_db


def verify_job_access(job_id: UUID, organization_id: UUID) -> dict:
    """
    Verify that a job belongs to the given organization.

    Args:
        job_id: UUID of the job
        organization_id: UUID of the organization

    Returns:
        The job data if access is granted

    Raises:
        HTTPException 404 if not found or doesn't belong to org
    """
    db = get_db()

    result = db.table("job_postings")\
        .select("*")\
        .eq("id", str(job_id))\
        .eq("organization_id", str(organization_id))\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    return result.data[0]


def verify_candidate_access(candidate_id: UUID, organization_id: UUID) -> dict:
    """
    Verify that a candidate belongs to a job in the given organization.

    Args:
        candidate_id: UUID of the candidate
        organization_id: UUID of the organization

    Returns:
        The candidate data if access is granted

    Raises:
        HTTPException 404 if not found or doesn't belong to org
    """
    db = get_db()

    # Get candidate with job info
    result = db.table("candidates")\
        .select("*, job_postings!job_posting_id(organization_id)")\
        .eq("id", str(candidate_id))\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    candidate = result.data[0]
    job = candidate.get("job_postings", {})

    if job.get("organization_id") != str(organization_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    return candidate


def verify_interview_access(interview_id: UUID, organization_id: UUID) -> dict:
    """
    Verify that an interview belongs to a candidate in the given organization.

    Args:
        interview_id: UUID of the interview
        organization_id: UUID of the organization

    Returns:
        The interview data if access is granted

    Raises:
        HTTPException 404 if not found or doesn't belong to org
    """
    db = get_db()

    # Get interview with candidate and job info
    result = db.table("interviews")\
        .select("*")\
        .eq("id", str(interview_id))\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )

    interview = result.data[0]

    # Get candidate to verify org access
    candidate_id = interview.get("candidate_id")
    if candidate_id:
        try:
            verify_candidate_access(UUID(candidate_id), organization_id)
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Interview not found"
            )

    return interview


def get_org_job_ids(organization_id: UUID) -> list:
    """
    Get all job IDs for an organization.

    Args:
        organization_id: UUID of the organization

    Returns:
        List of job ID strings
    """
    db = get_db()

    result = db.table("job_postings")\
        .select("id")\
        .eq("organization_id", str(organization_id))\
        .execute()

    return [row["id"] for row in result.data]
