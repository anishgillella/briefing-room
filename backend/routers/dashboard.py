"""
Phase 7: Recruiter Dashboard API

Provides high-level statistics and summaries for the recruiter dashboard,
including job summaries, pipeline funnel, recent activity, and top candidates.

Phase 4 Multi-tenancy: Organization-scoped queries with authentication.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID
from pydantic import BaseModel

from repositories.streamlined.job_repo import JobRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from repositories.streamlined.interview_repo import InterviewRepository
from repositories.streamlined.analytics_repo import AnalyticsRepository
from middleware.auth_middleware import get_current_user
from models.auth import CurrentUser

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# =============================================================================
# Response Models
# =============================================================================

class DashboardStats(BaseModel):
    """High-level dashboard statistics."""
    active_jobs: int
    total_jobs: int
    total_candidates: int
    interviewed_candidates: int
    pending_candidates: int
    completed_interviews: int
    strong_hires: int
    avg_score: float


class JobSummary(BaseModel):
    """Summary of a single job for dashboard display."""
    id: str
    title: str
    status: str
    candidate_count: int
    interviewed_count: int
    pending_count: int
    avg_score: Optional[float] = None
    created_at: Optional[str] = None


class JobsSummaryResponse(BaseModel):
    """Response containing job summaries."""
    jobs: List[JobSummary]
    total_active: int
    total_all: int


class PipelineStats(BaseModel):
    """Pipeline funnel statistics."""
    applied: int  # pending candidates
    in_progress: int  # currently interviewing
    completed: int  # interview completed
    strong_hire: int  # recommended for hire
    hire: int
    maybe: int
    no_hire: int


class ActivityItem(BaseModel):
    """A single activity item."""
    type: str
    candidate_name: Optional[str]
    job_title: Optional[str]
    job_id: Optional[str]
    score: Optional[float] = None
    recommendation: Optional[str] = None
    timestamp: str
    interview_id: Optional[str] = None


class RecentActivityResponse(BaseModel):
    """Response containing recent activity."""
    activities: List[ActivityItem]
    total: int


class TopCandidate(BaseModel):
    """A top-scoring candidate."""
    candidate_id: str
    candidate_name: Optional[str]
    job_id: str
    job_title: Optional[str]
    score: float
    recommendation: str
    interview_date: Optional[str] = None


class TopCandidatesResponse(BaseModel):
    """Response containing top candidates."""
    candidates: List[TopCandidate]
    total: int


# =============================================================================
# Helper Functions
# =============================================================================

def get_job_repo() -> JobRepository:
    return JobRepository()

def get_candidate_repo() -> CandidateRepository:
    return CandidateRepository()

def get_interview_repo() -> InterviewRepository:
    return InterviewRepository()

def get_analytics_repo() -> AnalyticsRepository:
    return AnalyticsRepository()


# =============================================================================
# Dashboard Endpoints
# =============================================================================

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: CurrentUser = Depends(get_current_user),
) -> DashboardStats:
    """
    Get high-level dashboard statistics for the authenticated user's organization.

    Returns counts of jobs, candidates, interviews, and analytics summaries.

    Optimized: Uses batch count queries instead of N+1 pattern.
    """
    job_repo = get_job_repo()
    candidate_repo = get_candidate_repo()
    interview_repo = get_interview_repo()
    analytics_repo = get_analytics_repo()

    # Get job counts efficiently (no N+1)
    job_counts = job_repo.count_for_org_sync(current_user.organization_id)

    # Get candidate counts using optimized batch queries
    total_candidates = 0
    interviewed_candidates = 0
    completed_interviews = 0

    try:
        # Use batch counting method if available
        if hasattr(candidate_repo, 'count_for_org_sync'):
            candidate_counts = candidate_repo.count_for_org_sync(current_user.organization_id)
            total_candidates = candidate_counts.get('total', 0)
            interviewed_candidates = candidate_counts.get('interviewed', 0)
        else:
            # Fallback: Get all jobs, then batch fetch all candidates in ONE query
            all_jobs = job_repo.list_all_for_org_sync(
                current_user.organization_id,
                include_counts=False
            )
            job_ids = [str(job.id) for job in all_jobs]
            
            if job_ids:
                # BATCH FETCH: Get all candidates for all jobs in one query
                all_candidates = candidate_repo.list_by_job_ids_sync(job_ids)
                total_candidates = len(all_candidates)
                for candidate in all_candidates:
                    status = candidate.interview_status
                    if hasattr(status, 'value'):
                        status = status.value
                    if status in ["completed", "in_progress"]:
                        interviewed_candidates += 1
    except Exception:
        pass

    # Count completed interviews
    try:
        if hasattr(interview_repo, 'count_completed_for_org_sync'):
            completed_interviews = interview_repo.count_completed_for_org_sync(
                current_user.organization_id
            )
        else:
            # Fallback to list method
            interviews = interview_repo.list_for_org_sync(current_user.organization_id)
            completed_interviews = len([i for i in interviews if hasattr(i.status, 'value') and i.status.value == "completed"])
    except Exception:
        pass

    # Get analytics summaries
    strong_hires = 0
    total_score = 0.0
    score_count = 0

    try:
        all_analytics = analytics_repo.list_all_sync()
        for a in all_analytics:
            score_count += 1
            total_score += a.overall_score
            if hasattr(a.recommendation, 'value'):
                if a.recommendation.value == "strong_hire":
                    strong_hires += 1
            elif a.recommendation == "strong_hire":
                strong_hires += 1
    except Exception:
        all_analytics = []

    avg_score = round(total_score / score_count, 1) if score_count > 0 else 0.0

    return DashboardStats(
        active_jobs=job_counts.get("active", 0),
        total_jobs=job_counts.get("total", 0),
        total_candidates=total_candidates,
        interviewed_candidates=interviewed_candidates,
        pending_candidates=total_candidates - interviewed_candidates,
        completed_interviews=completed_interviews,
        strong_hires=strong_hires,
        avg_score=avg_score,
    )


@router.get("/jobs/summary", response_model=JobsSummaryResponse)
async def get_jobs_summary(
    limit: int = 5,
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
) -> JobsSummaryResponse:
    """
    Get summary of jobs for dashboard display (organization-scoped).

    Optimized: Uses batch queries and includes counts from job listing.

    Args:
        limit: Maximum number of jobs to return (default 5)
        status: Filter by job status (active, paused, closed)
    """
    job_repo = get_job_repo()
    analytics_repo = get_analytics_repo()

    # Get job counts efficiently for totals
    job_counts = job_repo.count_for_org_sync(current_user.organization_id)

    # Get jobs for the user's organization (with counts already included)
    all_jobs = job_repo.list_all_for_org_sync(
        current_user.organization_id,
        include_counts=True
    )

    # Filter by status if provided
    if status:
        filtered_jobs = [j for j in all_jobs if j.status == status]
    else:
        # Default to showing active jobs first
        active = [j for j in all_jobs if j.status == "active"]
        other = [j for j in all_jobs if j.status != "active"]
        filtered_jobs = active + other

    # Batch fetch analytics scores for the jobs we are about to return
    jobs_to_return = filtered_jobs[:limit]
    job_ids = [job.id for job in jobs_to_return]
    
    scores_map = {}
    try:
        scores_map = analytics_repo.get_batch_scores_by_job_ids_sync(job_ids)
    except Exception:
        pass

    summaries = []
    for job in jobs_to_return:
        # Use counts already included in job from batch query
        candidate_count = job.candidate_count or 0
        interviewed_count = job.interviewed_count or 0

        # Get average score from batch map
        avg_score = None
        scores = scores_map.get(str(job.id), [])
        if scores:
            avg_score = round(sum(scores) / len(scores), 1)

        summaries.append(JobSummary(
            id=str(job.id),
            title=job.title,
            status=job.status,
            candidate_count=candidate_count,
            interviewed_count=interviewed_count,
            pending_count=candidate_count - interviewed_count,
            avg_score=avg_score,
            created_at=job.created_at.isoformat() if job.created_at else None,
        ))

    return JobsSummaryResponse(
        jobs=summaries,
        total_active=job_counts.get("active", 0),
        total_all=job_counts.get("total", 0),
    )


@router.get("/pipeline", response_model=PipelineStats)
async def get_pipeline_stats(
    current_user: CurrentUser = Depends(get_current_user),
) -> PipelineStats:
    """
    Get pipeline funnel statistics for the user's organization.

    Shows candidate distribution across interview stages and recommendations.

    Optimized: Uses batch queries to avoid N+1 pattern.
    """
    job_repo = get_job_repo()
    candidate_repo = get_candidate_repo()
    analytics_repo = get_analytics_repo()

    # Initialize counters
    pipeline = {
        "applied": 0,      # pending
        "in_progress": 0,  # interview in progress
        "completed": 0,    # interview completed
        "strong_hire": 0,
        "hire": 0,
        "maybe": 0,
        "no_hire": 0,
    }

    # Get all job IDs for the user's organization
    all_jobs = job_repo.list_all_for_org_sync(current_user.organization_id, include_counts=False)
    job_ids = [str(job.id) for job in all_jobs]

    if not job_ids:
        return PipelineStats(**pipeline)

    # BATCH FETCH: Get all candidates for all jobs in ONE query
    try:
        all_candidates = candidate_repo.list_by_job_ids_sync(job_ids)
    except Exception:
        all_candidates = []

    # BATCH FETCH: Get all analytics in ONE query
    try:
        all_analytics = analytics_repo.list_all_sync(limit=1000)
        # Build lookup by interview_id for O(1) access
        analytics_by_interview = {str(a.interview_id): a for a in all_analytics}
    except Exception:
        analytics_by_interview = {}

    # Count candidate statuses (no additional queries needed)
    for candidate in all_candidates:
        status = candidate.interview_status
        if hasattr(status, 'value'):
            status = status.value

        if status == "pending":
            pipeline["applied"] += 1
        elif status == "in_progress":
            pipeline["in_progress"] += 1
        elif status == "completed":
            pipeline["completed"] += 1

    # Count recommendations from analytics (already fetched in batch)
    for analytics in all_analytics:
        rec = analytics.recommendation
        if hasattr(rec, 'value'):
            rec = rec.value

        if rec == "strong_hire":
            pipeline["strong_hire"] += 1
        elif rec == "hire":
            pipeline["hire"] += 1
        elif rec == "maybe":
            pipeline["maybe"] += 1
        elif rec == "no_hire":
            pipeline["no_hire"] += 1

    return PipelineStats(**pipeline)


@router.get("/activity", response_model=RecentActivityResponse)
async def get_recent_activity(
    limit: int = 10,
    days: int = 7,
    current_user: CurrentUser = Depends(get_current_user),
) -> RecentActivityResponse:
    """
    Get recent activity for the user's organization (completed interviews with analytics).

    Args:
        limit: Maximum number of activities to return
        days: Look back period in days
    """
    job_repo = get_job_repo()
    interview_repo = get_interview_repo()
    analytics_repo = get_analytics_repo()
    candidate_repo = get_candidate_repo()

    activities: List[ActivityItem] = []
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Get all jobs for the user's organization (skip expensive counts)
    all_jobs = job_repo.list_all_for_org_sync(current_user.organization_id, include_counts=False)

    # Build job lookup map
    job_map = {str(job.id): job for job in all_jobs}
    job_ids = [job.id for job in all_jobs]

    # Fetch all interviews in a single query (much faster than N queries)
    try:
        all_raw_interviews = interview_repo.list_by_job_ids_sync(job_ids, limit=500)
    except Exception:
        all_raw_interviews = []

    # Filter by date and pair with job
    all_interviews = []
    for interview in all_raw_interviews:
        job = job_map.get(str(interview.job_id))
        if not job:
            continue

        # Filter by date if available
        if interview.ended_at:
            ended_at = interview.ended_at
            if hasattr(ended_at, 'replace') and ended_at.tzinfo:
                ended_at = ended_at.replace(tzinfo=None)
            if ended_at >= cutoff_date:
                all_interviews.append((interview, job))
        elif interview.created_at:
            created_at = interview.created_at
            if hasattr(created_at, 'replace') and created_at.tzinfo:
                created_at = created_at.replace(tzinfo=None)
            if created_at >= cutoff_date:
                all_interviews.append((interview, job))

    # Sort by date (most recent first) - already sorted from query but re-sort for consistency
    all_interviews.sort(
        key=lambda x: x[0].ended_at or x[0].created_at or datetime.min,
        reverse=True
    )

    # Build activity items
    for interview, job in all_interviews[:limit]:
        # Get candidate name
        candidate_name = interview.candidate_name
        if not candidate_name:
            try:
                candidate = candidate_repo.get_by_id_sync(interview.candidate_id)
                candidate_name = candidate.person_name if candidate else None
            except Exception:
                pass

        # Get analytics if available
        score = None
        recommendation = None
        try:
            analytics = analytics_repo.get_by_interview_sync(interview.id)
            if analytics:
                score = analytics.overall_score
                rec = analytics.recommendation
                recommendation = rec.value if hasattr(rec, 'value') else str(rec)
        except Exception:
            pass

        # Determine activity type
        if interview.status.value == "completed":
            activity_type = "interview_completed"
        elif interview.status.value == "in_progress":
            activity_type = "interview_started"
        else:
            activity_type = "interview_scheduled"

        timestamp = interview.ended_at or interview.started_at or interview.created_at

        activities.append(ActivityItem(
            type=activity_type,
            candidate_name=candidate_name,
            job_title=job.title,
            job_id=str(job.id),
            score=score,
            recommendation=recommendation,
            timestamp=timestamp.isoformat() if timestamp else datetime.utcnow().isoformat(),
            interview_id=str(interview.id),
        ))

    return RecentActivityResponse(
        activities=activities,
        total=len(activities),
    )


@router.get("/top-candidates", response_model=TopCandidatesResponse)
async def get_top_candidates(
    limit: int = 10,
    min_score: float = 0,
    current_user: CurrentUser = Depends(get_current_user),
) -> TopCandidatesResponse:
    """
    Get top-scoring candidates for the user's organization.

    Optimized: Uses batch queries to pre-fetch interviews and candidates.

    Args:
        limit: Maximum number of candidates to return
        min_score: Minimum score threshold
    """
    job_repo = get_job_repo()
    analytics_repo = get_analytics_repo()
    candidate_repo = get_candidate_repo()
    interview_repo = get_interview_repo()

    top_candidates: List[TopCandidate] = []

    # Get organization's jobs for filtering
    org_jobs = job_repo.list_all_for_org_sync(current_user.organization_id, include_counts=False)
    org_job_ids = {str(j.id) for j in org_jobs}
    job_map = {str(j.id): j for j in org_jobs}

    if not org_job_ids:
        return TopCandidatesResponse(candidates=[], total=0)

    # BATCH FETCH: Get all analytics
    try:
        all_analytics = analytics_repo.list_all_sync(limit=500)
    except Exception:
        all_analytics = []

    # BATCH FETCH: Get all interviews for org's jobs in ONE query
    try:
        all_interviews = interview_repo.list_by_job_ids_sync(list(org_job_ids), limit=1000)
        interview_map = {str(i.id): i for i in all_interviews}
    except Exception:
        interview_map = {}

    # BATCH FETCH: Get all candidates for org's jobs in ONE query
    try:
        all_candidates = candidate_repo.list_by_job_ids_sync(list(org_job_ids))
        candidate_map = {str(c.id): c for c in all_candidates}
    except Exception:
        candidate_map = {}

    # Filter and sort by score
    filtered = [a for a in all_analytics if a.overall_score >= min_score]
    sorted_analytics = sorted(filtered, key=lambda a: a.overall_score, reverse=True)

    # Build top candidates list using pre-fetched data (no additional queries)
    seen_candidates = set()

    for analytics in sorted_analytics:
        if len(top_candidates) >= limit:
            break

        try:
            # Use pre-fetched interview map (O(1) lookup)
            interview = interview_map.get(str(analytics.interview_id))
            if not interview:
                continue

            candidate_id = str(interview.candidate_id)
            if candidate_id in seen_candidates:
                continue

            # Use pre-fetched candidate map (O(1) lookup)
            candidate = candidate_map.get(candidate_id)
            if not candidate:
                continue

            # Filter by organization
            if str(candidate.job_id) not in org_job_ids:
                continue

            seen_candidates.add(candidate_id)

            # Use pre-fetched job map (O(1) lookup)
            job = job_map.get(str(candidate.job_id))

            rec = analytics.recommendation
            recommendation = rec.value if hasattr(rec, 'value') else str(rec)

            top_candidates.append(TopCandidate(
                candidate_id=candidate_id,
                candidate_name=candidate.person_name,
                job_id=str(candidate.job_id),
                job_title=job.title if job else None,
                score=analytics.overall_score,
                recommendation=recommendation,
                interview_date=interview.ended_at.isoformat() if interview.ended_at else None,
            ))
        except Exception:
            continue

    return TopCandidatesResponse(
        candidates=top_candidates,
        total=len(top_candidates),
    )


@router.get("/job/{job_id}/summary")
async def get_job_dashboard_summary(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get detailed dashboard summary for a specific job (must belong to user's org).

    Includes candidate breakdown, interview stats, and analytics summary.
    """
    job_repo = get_job_repo()
    candidate_repo = get_candidate_repo()
    interview_repo = get_interview_repo()
    analytics_repo = get_analytics_repo()

    # Verify job exists and belongs to user's organization
    job = job_repo.get_by_id_for_org_sync(job_id, current_user.organization_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get candidates
    try:
        candidates = candidate_repo.list_by_job_sync(job_id)
    except Exception:
        candidates = []

    # Calculate candidate stats
    status_counts = {
        "pending": 0,
        "in_progress": 0,
        "completed": 0,
    }

    for candidate in candidates:
        status = candidate.interview_status
        if status in status_counts:
            status_counts[status] += 1

    # Get interview stats - fetch all interviews for job in one query instead of N+1
    total_interviews = 0
    completed_interviews = 0
    total_duration = 0

    try:
        all_interviews = interview_repo.list_by_job_sync(job_id)
        total_interviews = len(all_interviews)
        for interview in all_interviews:
            if interview.status.value == "completed":
                completed_interviews += 1
                if interview.duration_seconds:
                    total_duration += interview.duration_seconds
    except Exception:
        all_interviews = []

    avg_duration = total_duration // completed_interviews if completed_interviews > 0 else 0

    # Get analytics stats
    recommendation_counts = {
        "strong_hire": 0,
        "hire": 0,
        "maybe": 0,
        "no_hire": 0,
    }
    total_score = 0.0
    score_count = 0

    try:
        job_analytics = analytics_repo.list_by_job_sync(job_id)
        for analytics in job_analytics:
            score_count += 1
            total_score += analytics.overall_score

            rec = analytics.recommendation
            rec_value = rec.value if hasattr(rec, 'value') else str(rec)
            if rec_value in recommendation_counts:
                recommendation_counts[rec_value] += 1
    except Exception:
        job_analytics = []

    avg_score = round(total_score / score_count, 1) if score_count > 0 else 0.0

    return {
        "job_id": str(job_id),
        "job_title": job.title,
        "job_status": job.status,
        "candidate_stats": {
            "total": len(candidates),
            "pending": status_counts["pending"],
            "in_progress": status_counts["in_progress"],
            "completed": status_counts["completed"],
        },
        "interview_stats": {
            "total": total_interviews,
            "completed": completed_interviews,
            "avg_duration_seconds": avg_duration,
            "avg_duration_minutes": round(avg_duration / 60, 1) if avg_duration > 0 else 0,
        },
        "analytics_stats": {
            "total_evaluated": score_count,
            "avg_score": avg_score,
            "recommendations": recommendation_counts,
        },
    }
