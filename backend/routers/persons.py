"""
Persons Router - API endpoints for Talent Pool management.

Provides access to all People in the system across all jobs,
with search, filter, and profile viewing capabilities.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import UUID

from models.streamlined.person import Person, PersonUpdate
from models.auth import CurrentUser
from repositories.streamlined.person_repo import PersonRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from middleware.auth_middleware import get_current_user

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/talent-pool", tags=["talent-pool"])


def get_person_repo() -> PersonRepository:
    """Dependency for getting PersonRepository instance."""
    return PersonRepository()


# =============================================================================
# Response Models
# =============================================================================

class PersonSummary(BaseModel):
    """Summary view of a person for list views."""
    id: str
    name: str
    email: Optional[str] = None
    headline: Optional[str] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    location: Optional[str] = None
    skills: List[str] = []
    linkedin_url: Optional[str] = None
    application_count: int = 0


class PersonDetail(BaseModel):
    """Detailed view of a person with all profile data."""
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    resume_url: Optional[str] = None

    # Profile fields
    headline: Optional[str] = None
    summary: Optional[str] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    location: Optional[str] = None
    years_experience: Optional[float] = None
    skills: List[str] = []
    work_history: List[Dict[str, Any]] = []
    education: List[Dict[str, Any]] = []

    # Metadata
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    # Applications
    applications: List[Dict[str, Any]] = []


class TalentPoolResponse(BaseModel):
    """Response for talent pool listing."""
    persons: List[PersonSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class JobOption(BaseModel):
    """Job option for filtering."""
    id: str
    title: str
    candidate_count: int = 0


class FilterOptions(BaseModel):
    """Available filter options for the talent pool."""
    skills: List[str]
    locations: List[str]
    companies: List[str]
    jobs: List[JobOption] = []
    tiers: List[str] = ["TOP TIER", "STRONG", "GOOD", "EVALUATE", "POOR"]
    pipeline_statuses: List[str] = ["new", "round_1", "round_2", "round_3", "decision_pending", "accepted", "rejected"]
    total_persons: int


# =============================================================================
# Talent Pool Endpoints
# =============================================================================

@router.get("/", response_model=TalentPoolResponse)
async def list_talent_pool(
    query: Optional[str] = Query(None, description="Search query for name, headline, or summary"),
    skills: Optional[str] = Query(None, description="Comma-separated list of skills to filter by"),
    location: Optional[str] = Query(None, description="Location filter"),
    company: Optional[str] = Query(None, description="Company filter"),
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    tier: Optional[str] = Query(None, description="Filter by tier (TOP TIER, STRONG, GOOD, EVALUATE, POOR)"),
    pipeline_status: Optional[str] = Query(None, description="Filter by pipeline status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: CurrentUser = Depends(get_current_user),
) -> TalentPoolResponse:
    """
    List all persons in the talent pool with optional filters.

    Returns paginated list of persons with summary information.
    Supports search by name and filters by skills, location, company, job, tier, pipeline status.
    """
    person_repo = get_person_repo()
    candidate_repo = CandidateRepository()

    # Parse skills filter
    skills_list = None
    if skills:
        skills_list = [s.strip() for s in skills.split(",") if s.strip()]

    # Calculate offset
    offset = (page - 1) * page_size

    # If filtering by job, tier, or pipeline_status, we need to filter via candidates first
    if job_id or tier or pipeline_status:
        # Get person IDs that match the candidate filters
        matching_person_ids = candidate_repo.get_person_ids_by_filters_sync(
            job_id=job_id,
            tier=tier,
            pipeline_status=pipeline_status,
        ) if hasattr(candidate_repo, 'get_person_ids_by_filters_sync') else None

        if matching_person_ids is not None:
            if not matching_person_ids:
                # No matching candidates
                return TalentPoolResponse(
                    persons=[],
                    total=0,
                    page=page,
                    page_size=page_size,
                    total_pages=0,
                )

            # Search within matching person IDs
            persons = person_repo.search_by_ids_sync(
                person_ids=matching_person_ids,
                query=query,
                skills=skills_list,
                location=location,
                current_company=company,
                limit=page_size,
                offset=offset,
            ) if hasattr(person_repo, 'search_by_ids_sync') else []

            total = len(matching_person_ids)
        else:
            # Fallback to regular search
            persons = person_repo.search_sync(
                query=query,
                skills=skills_list,
                location=location,
                current_company=company,
                limit=page_size,
                offset=offset,
            )
            total = person_repo.count_all_sync()
    else:
        # Search persons without candidate filters
        persons = person_repo.search_sync(
            query=query,
            skills=skills_list,
            location=location,
            current_company=company,
            limit=page_size,
            offset=offset,
        )
        total = person_repo.count_all_sync()

    total_pages = (total + page_size - 1) // page_size

    # Build response with application counts
    person_summaries = []
    for person in persons:
        # Get application count for this person
        candidates = candidate_repo.list_by_person_sync(person.id) if hasattr(candidate_repo, 'list_by_person_sync') else []

        person_summaries.append(PersonSummary(
            id=str(person.id),
            name=person.name,
            email=person.email,
            headline=person.headline,
            current_title=person.current_title,
            current_company=person.current_company,
            location=person.location,
            skills=person.skills or [],
            linkedin_url=person.linkedin_url,
            application_count=len(candidates) if candidates else 0,
        ))

    return TalentPoolResponse(
        persons=person_summaries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/filters", response_model=FilterOptions)
async def get_filter_options(
    current_user: CurrentUser = Depends(get_current_user),
) -> FilterOptions:
    """
    Get available filter options for the talent pool.

    Returns lists of unique skills, locations, companies, and jobs
    that can be used for filtering.
    """
    from repositories.streamlined.job_repo import JobRepository

    person_repo = get_person_repo()
    candidate_repo = CandidateRepository()
    job_repo = JobRepository()

    skills = person_repo.get_all_skills_sync(limit=100)
    locations = person_repo.get_all_locations_sync(limit=50)
    companies = person_repo.get_all_companies_sync(limit=50)
    total = person_repo.count_all_sync()

    # Get jobs that have candidates
    jobs = []
    try:
        all_jobs = job_repo.list_all_sync(limit=100) if hasattr(job_repo, 'list_all_sync') else []
        for job in all_jobs:
            candidate_count = candidate_repo.count_by_job_sync(job.id) if hasattr(candidate_repo, 'count_by_job_sync') else 0
            if candidate_count > 0:
                jobs.append(JobOption(
                    id=str(job.id),
                    title=job.title,
                    candidate_count=candidate_count,
                ))
    except Exception as e:
        logger.warning(f"Failed to get jobs for filter: {e}")

    return FilterOptions(
        skills=skills,
        locations=locations,
        companies=companies,
        jobs=jobs,
        total_persons=total,
    )


@router.get("/{person_id}", response_model=PersonDetail)
async def get_person_detail(
    person_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> PersonDetail:
    """
    Get detailed profile for a specific person.

    Returns full profile including work history, education,
    and all job applications.
    """
    person_repo = get_person_repo()
    candidate_repo = CandidateRepository()

    # Get person
    person = person_repo.get_by_id_sync(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Get all applications (candidates) for this person
    applications = []
    try:
        if hasattr(candidate_repo, 'list_by_person_sync'):
            candidates = candidate_repo.list_by_person_sync(person_id)
            for c in candidates:
                applications.append({
                    "candidate_id": str(c.id),
                    "job_id": str(c.job_id) if c.job_id else None,
                    "job_title": c.job_title if hasattr(c, 'job_title') else None,
                    "pipeline_status": c.pipeline_status.value if hasattr(c.pipeline_status, 'value') else str(c.pipeline_status) if c.pipeline_status else None,
                    "interview_status": c.interview_status.value if hasattr(c.interview_status, 'value') else str(c.interview_status) if c.interview_status else None,
                    "combined_score": c.combined_score,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                })
    except Exception as e:
        logger.warning(f"Failed to get applications for person {person_id}: {e}")

    return PersonDetail(
        id=str(person.id),
        name=person.name,
        email=person.email,
        phone=person.phone,
        linkedin_url=person.linkedin_url,
        resume_url=person.resume_url,
        headline=person.headline,
        summary=person.summary,
        current_title=person.current_title,
        current_company=person.current_company,
        location=person.location,
        years_experience=person.years_experience,
        skills=person.skills or [],
        work_history=person.work_history or [],
        education=person.education or [],
        created_at=person.created_at.isoformat() if person.created_at else None,
        updated_at=person.updated_at.isoformat() if person.updated_at else None,
        applications=applications,
    )


@router.patch("/{person_id}", response_model=PersonDetail)
async def update_person(
    person_id: UUID,
    person_update: PersonUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> PersonDetail:
    """
    Update a person's profile.

    Allows updating profile fields like headline, summary, skills, etc.
    """
    person_repo = get_person_repo()

    # Verify person exists
    existing = person_repo.get_by_id_sync(person_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Person not found")

    # Update person
    updated = person_repo.update_sync(person_id, person_update)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update person")

    # Get updated detail (reuse the detail endpoint logic)
    return await get_person_detail(person_id, current_user)


@router.get("/{person_id}/applications")
async def get_person_applications(
    person_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get all job applications for a specific person.

    Returns list of candidates (applications) with job details.
    """
    person_repo = get_person_repo()
    candidate_repo = CandidateRepository()

    # Verify person exists
    person = person_repo.get_by_id_sync(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Get all candidates for this person
    applications = []
    try:
        if hasattr(candidate_repo, 'list_by_person_sync'):
            candidates = candidate_repo.list_by_person_sync(person_id)
            for c in candidates:
                applications.append({
                    "candidate_id": str(c.id),
                    "job_id": str(c.job_id) if c.job_id else None,
                    "job_title": c.job_title if hasattr(c, 'job_title') else None,
                    "current_company": c.current_company,
                    "current_title": c.current_title,
                    "pipeline_status": c.pipeline_status.value if hasattr(c.pipeline_status, 'value') else str(c.pipeline_status) if c.pipeline_status else None,
                    "interview_status": c.interview_status.value if hasattr(c.interview_status, 'value') else str(c.interview_status) if c.interview_status else None,
                    "combined_score": c.combined_score,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                })
    except Exception as e:
        logger.warning(f"Failed to get applications for person {person_id}: {e}")

    return {
        "person_id": str(person_id),
        "person_name": person.name,
        "applications": applications,
        "total": len(applications),
    }


# =============================================================================
# Global Talent Profile - Aggregated Performance Across All Applications
# =============================================================================

class GlobalTalentProfile(BaseModel):
    """Aggregated performance data for a person across all job applications."""
    person_id: str
    person_name: str
    total_applications: int
    average_score: Optional[float] = None
    highest_score: Optional[int] = None
    lowest_score: Optional[int] = None
    status_breakdown: Dict[str, int] = {}  # {"new": 2, "round_1": 1, etc.}
    applications: List[Dict[str, Any]] = []  # Detailed list sorted by score


@router.get("/{person_id}/global-profile", response_model=GlobalTalentProfile)
async def get_global_talent_profile(
    person_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> GlobalTalentProfile:
    """
    Get global performance profile for a person across all job applications.

    Aggregates scores, status breakdown, and provides a comprehensive view
    of the candidate's performance across all positions they've applied to.
    """
    person_repo = get_person_repo()
    candidate_repo = CandidateRepository()

    # Verify person exists
    person = person_repo.get_by_id_sync(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Get all candidates for this person
    candidates = []
    try:
        if hasattr(candidate_repo, 'list_by_person_sync'):
            candidates = candidate_repo.list_by_person_sync(person_id)
    except Exception as e:
        logger.warning(f"Failed to get candidates for person {person_id}: {e}")

    # Aggregate scores
    scores = [c.combined_score for c in candidates if c.combined_score is not None]

    average_score = None
    highest_score = None
    lowest_score = None

    if scores:
        average_score = round(sum(scores) / len(scores), 1)
        highest_score = int(max(scores))
        lowest_score = int(min(scores))

    # Build status breakdown
    status_breakdown: Dict[str, int] = {}
    for c in candidates:
        status = c.pipeline_status
        if hasattr(status, 'value'):
            status = status.value
        status = str(status) if status else "new"
        status_breakdown[status] = status_breakdown.get(status, 0) + 1

    # Build applications list sorted by score descending
    applications = []
    for c in candidates:
        pipeline_status = c.pipeline_status
        if hasattr(pipeline_status, 'value'):
            pipeline_status = pipeline_status.value

        interview_status = c.interview_status
        if hasattr(interview_status, 'value'):
            interview_status = interview_status.value

        applications.append({
            "candidate_id": str(c.id),
            "job_id": str(c.job_id) if c.job_id else None,
            "job_title": c.job_title if hasattr(c, 'job_title') else None,
            "score": c.combined_score,
            "pipeline_status": str(pipeline_status) if pipeline_status else "new",
            "interview_status": str(interview_status) if interview_status else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    # Sort by score descending (None values at end)
    applications.sort(key=lambda x: (x["score"] is None, -(x["score"] or 0)))

    return GlobalTalentProfile(
        person_id=str(person_id),
        person_name=person.name,
        total_applications=len(candidates),
        average_score=average_score,
        highest_score=highest_score,
        lowest_score=lowest_score,
        status_breakdown=status_breakdown,
        applications=applications,
    )
