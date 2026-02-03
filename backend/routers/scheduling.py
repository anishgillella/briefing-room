"""
Scheduling Router - API endpoints for interview scheduling and availability management.

Endpoints:
- Interviewer availability (weekly slots + overrides)
- Interview scheduling, rescheduling, cancellation
- Available slots calculation
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, date, time
from uuid import UUID
import logging

from models.scheduling import (
    AvailabilityWeekly,
    AvailabilityWeeklyCreate,
    AvailabilityOverride,
    AvailabilityOverrideCreate,
    ScheduleInterviewRequest,
    RescheduleInterviewRequest,
    CancelInterviewRequest,
    ScheduledInterview,
    CandidateScores,
    TimeSlot,
    AvailableSlotsResponse,
    InterviewerSchedulingSettings,
    UpdateInterviewerSettingsRequest,
    DayOfWeek,
    OverrideType,
)
from repositories.scheduling_repository import SchedulingRepository
from repositories.interview_repository import InterviewRepository
from middleware.auth_middleware import get_current_user, get_optional_user
from models.auth import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scheduling", tags=["scheduling"])


def get_scheduling_repo() -> SchedulingRepository:
    """Dependency for getting SchedulingRepository instance."""
    return SchedulingRepository()


def get_interview_repo() -> InterviewRepository:
    """Dependency for getting InterviewRepository instance."""
    return InterviewRepository()


def get_candidate_scores(candidate_id: str, interview_repo: InterviewRepository) -> CandidateScores:
    """
    Get scores for a candidate across all completed interview rounds.
    Returns round_1, round_2, round_3 scores and cumulative average.
    """
    interviews = interview_repo.get_candidate_interviews(candidate_id)

    scores = CandidateScores()
    all_scores = []

    for interview in interviews:
        if interview.get("status") != "completed":
            continue

        scores.has_completed_interviews = True
        analytics = interview.get("analytics")

        if not analytics:
            continue

        # Handle both list and dict formats
        if isinstance(analytics, list) and analytics:
            overall_score = analytics[0].get("overall_score")
        elif isinstance(analytics, dict):
            overall_score = analytics.get("overall_score")
        else:
            overall_score = None

        if overall_score is not None:
            stage = interview.get("stage")
            if stage == "round_1":
                scores.round_1 = overall_score
            elif stage == "round_2":
                scores.round_2 = overall_score
            elif stage == "round_3":
                scores.round_3 = overall_score
            all_scores.append(overall_score)

    if all_scores:
        scores.cumulative = round(sum(all_scores) / len(all_scores), 1)

    return scores


# ============================================
# INTERVIEWER SETTINGS
# ============================================

@router.get("/interviewers/{interviewer_id}/settings", response_model=InterviewerSchedulingSettings)
async def get_interviewer_settings(
    interviewer_id: UUID,
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Get scheduling settings for an interviewer."""
    repo = get_scheduling_repo()
    settings = repo.get_interviewer_settings(str(interviewer_id))

    if not settings:
        raise HTTPException(status_code=404, detail="Interviewer not found")

    return InterviewerSchedulingSettings(
        interviewer_id=str(settings['id']),
        timezone=settings.get('timezone', 'America/New_York'),
        default_interview_duration_minutes=settings.get('default_interview_duration_minutes', 45),
        max_interviews_per_day=settings.get('max_interviews_per_day', 5),
    )


@router.patch("/interviewers/{interviewer_id}/settings", response_model=InterviewerSchedulingSettings)
async def update_interviewer_settings(
    interviewer_id: UUID,
    updates: UpdateInterviewerSettingsRequest,
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Update scheduling settings for an interviewer."""
    repo = get_scheduling_repo()
    result = repo.update_interviewer_settings(
        str(interviewer_id),
        updates.model_dump(exclude_unset=True)
    )

    if not result:
        raise HTTPException(status_code=404, detail="Interviewer not found")

    return InterviewerSchedulingSettings(
        interviewer_id=str(result['id']),
        timezone=result.get('timezone', 'America/New_York'),
        default_interview_duration_minutes=result.get('default_interview_duration_minutes', 45),
        max_interviews_per_day=result.get('max_interviews_per_day', 5),
    )


# ============================================
# WEEKLY AVAILABILITY
# ============================================

@router.get("/interviewers/{interviewer_id}/availability/weekly", response_model=List[AvailabilityWeekly])
async def get_weekly_availability(
    interviewer_id: UUID,
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Get weekly availability slots for an interviewer."""
    repo = get_scheduling_repo()
    slots = repo.get_weekly_availability(str(interviewer_id))

    return [
        AvailabilityWeekly(
            id=s['id'],
            interviewer_id=s['interviewer_id'],
            day_of_week=DayOfWeek(s['day_of_week']),
            start_time=time.fromisoformat(s['start_time']) if isinstance(s['start_time'], str) else s['start_time'],
            end_time=time.fromisoformat(s['end_time']) if isinstance(s['end_time'], str) else s['end_time'],
            is_active=s.get('is_active', True),
            created_at=datetime.fromisoformat(s['created_at'].replace('Z', '+00:00')) if isinstance(s['created_at'], str) else s['created_at'],
            updated_at=datetime.fromisoformat(s['updated_at'].replace('Z', '+00:00')) if isinstance(s['updated_at'], str) else s['updated_at'],
        )
        for s in slots
    ]


@router.post("/interviewers/{interviewer_id}/availability/weekly", response_model=AvailabilityWeekly)
async def create_weekly_slot(
    interviewer_id: UUID,
    day_of_week: int = Query(..., ge=0, le=6, description="Day of week (0=Sunday, 6=Saturday)"),
    start_time: str = Query(..., description="Start time in HH:MM format"),
    end_time: str = Query(..., description="End time in HH:MM format"),
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Create a weekly availability slot."""
    repo = get_scheduling_repo()

    try:
        start = time.fromisoformat(start_time)
        end = time.fromisoformat(end_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    result = repo.create_weekly_slot(
        str(interviewer_id),
        day_of_week,
        start,
        end
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to create availability slot")

    return AvailabilityWeekly(
        id=result['id'],
        interviewer_id=result['interviewer_id'],
        day_of_week=DayOfWeek(result['day_of_week']),
        start_time=time.fromisoformat(result['start_time']) if isinstance(result['start_time'], str) else result['start_time'],
        end_time=time.fromisoformat(result['end_time']) if isinstance(result['end_time'], str) else result['end_time'],
        is_active=result.get('is_active', True),
    )


@router.delete("/availability/weekly/{slot_id}")
async def delete_weekly_slot(
    slot_id: UUID,
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Delete a weekly availability slot."""
    repo = get_scheduling_repo()
    success = repo.delete_weekly_slot(str(slot_id))

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete availability slot")

    return {"success": True, "deleted_id": str(slot_id)}


# ============================================
# AVAILABILITY OVERRIDES
# ============================================

@router.get("/interviewers/{interviewer_id}/availability/overrides", response_model=List[AvailabilityOverride])
async def get_availability_overrides(
    interviewer_id: UUID,
    date_from: Optional[date] = Query(None, description="Start date for range"),
    date_to: Optional[date] = Query(None, description="End date for range"),
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Get availability overrides for an interviewer."""
    repo = get_scheduling_repo()
    overrides = repo.get_overrides(str(interviewer_id), date_from, date_to)

    return [
        AvailabilityOverride(
            id=o['id'],
            interviewer_id=o['interviewer_id'],
            override_date=date.fromisoformat(o['override_date']) if isinstance(o['override_date'], str) else o['override_date'],
            override_type=OverrideType(o['override_type']),
            start_time=time.fromisoformat(o['start_time']) if o.get('start_time') and isinstance(o['start_time'], str) else o.get('start_time'),
            end_time=time.fromisoformat(o['end_time']) if o.get('end_time') and isinstance(o['end_time'], str) else o.get('end_time'),
            reason=o.get('reason'),
            created_at=datetime.fromisoformat(o['created_at'].replace('Z', '+00:00')) if isinstance(o['created_at'], str) else o['created_at'],
        )
        for o in overrides
    ]


@router.post("/interviewers/{interviewer_id}/availability/overrides", response_model=AvailabilityOverride)
async def create_availability_override(
    interviewer_id: UUID,
    override_date: date = Query(..., description="Date for the override"),
    override_type: OverrideType = Query(..., description="Type: available or unavailable"),
    start_time: Optional[str] = Query(None, description="Start time in HH:MM format (optional)"),
    end_time: Optional[str] = Query(None, description="End time in HH:MM format (optional)"),
    reason: Optional[str] = Query(None, description="Reason for override"),
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Create an availability override for a specific date."""
    repo = get_scheduling_repo()

    start = None
    end = None

    if start_time and end_time:
        try:
            start = time.fromisoformat(start_time)
            end = time.fromisoformat(end_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

        if end <= start:
            raise HTTPException(status_code=400, detail="End time must be after start time")
    elif start_time or end_time:
        raise HTTPException(status_code=400, detail="Both start_time and end_time must be provided, or neither")

    result = repo.create_override(
        str(interviewer_id),
        override_date,
        override_type.value,
        start,
        end,
        reason
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to create override")

    return AvailabilityOverride(
        id=result['id'],
        interviewer_id=result['interviewer_id'],
        override_date=date.fromisoformat(result['override_date']) if isinstance(result['override_date'], str) else result['override_date'],
        override_type=OverrideType(result['override_type']),
        start_time=time.fromisoformat(result['start_time']) if result.get('start_time') else None,
        end_time=time.fromisoformat(result['end_time']) if result.get('end_time') else None,
        reason=result.get('reason'),
    )


@router.delete("/availability/overrides/{override_id}")
async def delete_availability_override(
    override_id: UUID,
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Delete an availability override."""
    repo = get_scheduling_repo()
    success = repo.delete_override(str(override_id))

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete override")

    return {"success": True, "deleted_id": str(override_id)}


# ============================================
# AVAILABLE SLOTS
# ============================================

@router.get("/interviewers/{interviewer_id}/slots", response_model=AvailableSlotsResponse)
async def get_available_slots(
    interviewer_id: UUID,
    date_from: date = Query(..., description="Start date"),
    date_to: date = Query(..., description="End date"),
    duration_minutes: int = Query(45, ge=15, le=180, description="Interview duration"),
    timezone: str = Query("America/New_York", description="Timezone for slots"),
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Get available time slots for an interviewer within a date range."""
    if date_to < date_from:
        raise HTTPException(status_code=400, detail="date_to must be >= date_from")

    if (date_to - date_from).days > 30:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 30 days")

    repo = get_scheduling_repo()
    slots = repo.get_available_slots(
        str(interviewer_id),
        date_from,
        date_to,
        duration_minutes,
        timezone
    )

    return AvailableSlotsResponse(
        slots=[
            TimeSlot(
                start=datetime.fromisoformat(s['start']),
                end=datetime.fromisoformat(s['end']),
                interviewer_id=s['interviewer_id'],
                interviewer_name=s.get('interviewer_name'),
                is_available=s.get('is_available', True),
            )
            for s in slots
        ],
        interviewer_id=str(interviewer_id),
        date_from=date_from,
        date_to=date_to,
    )


# ============================================
# INTERVIEW SCHEDULING
# ============================================

@router.post("/interviews", response_model=ScheduledInterview)
async def schedule_interview(
    request: ScheduleInterviewRequest,
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Schedule a new interview."""
    repo = get_scheduling_repo()

    # Check if slot is available
    interview_date = request.scheduled_at.date()
    slots = repo.get_available_slots(
        request.interviewer_id,
        interview_date,
        interview_date,
        request.duration_minutes,
        request.timezone
    )

    # Verify the requested time is in an available slot
    slot_available = any(
        datetime.fromisoformat(s['start']) <= request.scheduled_at < datetime.fromisoformat(s['end'])
        for s in slots
    )

    if not slot_available:
        logger.warning(f"Requested slot not available, but proceeding anyway for flexibility")
        # We allow scheduling anyway - the availability is a guide, not a hard constraint

    try:
        result = repo.schedule_interview(
            candidate_id=request.candidate_id,
            job_posting_id=request.job_posting_id,
            interviewer_id=request.interviewer_id,
            stage=request.stage,
            scheduled_at=request.scheduled_at,
            duration_minutes=request.duration_minutes,
            timezone=request.timezone,
            interview_type=request.interview_type,
            notes=request.notes,
        )
    except Exception as e:
        # Check for unique constraint violation
        error_str = str(e).lower()
        if "unique" in error_str and "constraint" in error_str:
            raise HTTPException(
                status_code=409, 
                detail=f"An interview for this candidate and stage ({request.stage}) is already scheduled."
            )
        raise e

    if not result:
        raise HTTPException(status_code=500, detail="Failed to schedule interview")

    return ScheduledInterview(
        id=result['id'],
        candidate_id=result['candidate_id'],
        job_posting_id=result.get('job_posting_id'),
        interviewer_id=result.get('interviewer_id'),
        stage=result['stage'],
        interview_type=result.get('interview_type', 'live'),
        scheduled_at=datetime.fromisoformat(result['scheduled_at'].replace('Z', '+00:00')) if result.get('scheduled_at') else None,
        duration_minutes=result.get('duration_minutes', 45),
        timezone=result.get('timezone', 'America/New_York'),
        room_name=result.get('room_name'),
        status=result.get('status', 'scheduled'),
        notes=result.get('notes'),
    )


@router.get("/interviews", response_model=List[ScheduledInterview])
async def get_scheduled_interviews(
    interviewer_id: Optional[UUID] = Query(None, description="Filter by interviewer"),
    candidate_id: Optional[UUID] = Query(None, description="Filter by candidate"),
    job_id: Optional[UUID] = Query(None, description="Filter by job"),
    date_from: Optional[date] = Query(None, description="Start date"),
    date_to: Optional[date] = Query(None, description="End date"),
    status: Optional[str] = Query(None, description="Interview status (scheduled, in_progress, completed, cancelled). Leave empty for all"),
    include_scores: bool = Query(True, description="Include candidate scores from completed interviews"),
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Get scheduled interviews with optional filters."""
    repo = get_scheduling_repo()

    interviews = repo.get_scheduled_interviews(
        interviewer_id=str(interviewer_id) if interviewer_id else None,
        candidate_id=str(candidate_id) if candidate_id else None,
        job_id=str(job_id) if job_id else None,
        date_from=date_from,
        date_to=date_to,
        status=status,
    )

    # Pre-fetch scores for all unique candidates if requested - BATCH FETCH
    candidate_scores_cache: dict[str, CandidateScores] = {}
    if include_scores:
        interview_repo = get_interview_repo()
        unique_candidate_ids = list(set(i['candidate_id'] for i in interviews))
        
        # BATCH FETCH: Get all interviews for all candidates in ONE query
        interviews_by_candidate = interview_repo.get_candidate_interviews_batch(unique_candidate_ids)
        
        # Build scores cache from pre-fetched data (no additional queries)
        for cid in unique_candidate_ids:
            candidate_interviews = interviews_by_candidate.get(cid, [])
            scores = CandidateScores()
            all_scores = []
            
            for interview in candidate_interviews:
                if interview.get("status") != "completed":
                    continue
                    
                scores.has_completed_interviews = True
                analytics = interview.get("analytics")
                
                if not analytics:
                    continue
                    
                if isinstance(analytics, list) and analytics:
                    overall_score = analytics[0].get("overall_score")
                elif isinstance(analytics, dict):
                    overall_score = analytics.get("overall_score")
                else:
                    overall_score = None
                    
                if overall_score is not None:
                    stage = interview.get("stage")
                    if stage == "round_1":
                        scores.round_1 = overall_score
                    elif stage == "round_2":
                        scores.round_2 = overall_score
                    elif stage == "round_3":
                        scores.round_3 = overall_score
                    all_scores.append(overall_score)
            
            if all_scores:
                scores.cumulative = round(sum(all_scores) / len(all_scores), 1)
            
            candidate_scores_cache[cid] = scores

    result = []
    for i in interviews:
        # Extract nested data
        candidate_name = None
        candidate_email = None
        if i.get('candidates'):
            candidate = i['candidates']
            if candidate.get('persons'):
                candidate_name = candidate['persons'].get('name')
                candidate_email = candidate['persons'].get('email')

        interviewer_name = None
        interviewer_email = None
        if i.get('hiring_managers'):
            interviewer_name = i['hiring_managers'].get('name')
            interviewer_email = i['hiring_managers'].get('email')

        job_title = None
        if i.get('job_postings'):
            job_title = i['job_postings'].get('title')

        # Get scores from cache if available
        scores = candidate_scores_cache.get(i['candidate_id']) if include_scores else None

        result.append(ScheduledInterview(
            id=i['id'],
            candidate_id=i['candidate_id'],
            job_posting_id=i.get('job_posting_id'),
            interviewer_id=i.get('interviewer_id'),
            stage=i['stage'],
            interview_type=i.get('interview_type', 'live'),
            scheduled_at=datetime.fromisoformat(i['scheduled_at'].replace('Z', '+00:00')) if i.get('scheduled_at') else None,
            duration_minutes=i.get('duration_minutes', 45),
            timezone=i.get('timezone', 'America/New_York'),
            meeting_link=i.get('meeting_link'),
            room_name=i.get('room_name'),
            status=i.get('status', 'scheduled'),
            started_at=datetime.fromisoformat(i['started_at'].replace('Z', '+00:00')) if i.get('started_at') else None,
            ended_at=datetime.fromisoformat(i['ended_at'].replace('Z', '+00:00')) if i.get('ended_at') else None,
            notes=i.get('notes'),
            cancel_reason=i.get('cancel_reason'),
            reminder_sent_at=datetime.fromisoformat(i['reminder_sent_at'].replace('Z', '+00:00')) if i.get('reminder_sent_at') else None,
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            interviewer_name=interviewer_name,
            interviewer_email=interviewer_email,
            job_title=job_title,
            scores=scores,
            created_at=datetime.fromisoformat(i['created_at'].replace('Z', '+00:00')) if isinstance(i['created_at'], str) else i['created_at'],
        ))

    return result


@router.patch("/interviews/{interview_id}/reschedule", response_model=ScheduledInterview)
async def reschedule_interview(
    interview_id: UUID,
    request: RescheduleInterviewRequest,
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Reschedule an existing interview."""
    repo = get_scheduling_repo()

    result = repo.reschedule_interview(
        str(interview_id),
        request.new_scheduled_at,
        request.new_interviewer_id,
        request.reason,
    )

    if not result:
        raise HTTPException(status_code=404, detail="Interview not found or cannot be rescheduled")

    return ScheduledInterview(
        id=result['id'],
        candidate_id=result['candidate_id'],
        job_posting_id=result.get('job_posting_id'),
        interviewer_id=result.get('interviewer_id'),
        stage=result['stage'],
        interview_type=result.get('interview_type', 'live'),
        scheduled_at=datetime.fromisoformat(result['scheduled_at'].replace('Z', '+00:00')) if result.get('scheduled_at') else None,
        duration_minutes=result.get('duration_minutes', 45),
        timezone=result.get('timezone', 'America/New_York'),
        room_name=result.get('room_name'),
        status=result.get('status', 'scheduled'),
        notes=result.get('notes'),
    )


@router.patch("/interviews/{interview_id}/cancel")
async def cancel_interview(
    interview_id: UUID,
    request: CancelInterviewRequest,
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Cancel a scheduled interview."""
    repo = get_scheduling_repo()

    result = repo.cancel_interview(str(interview_id), request.reason)

    if not result:
        raise HTTPException(status_code=404, detail="Interview not found")

    return {
        "success": True,
        "interview_id": str(interview_id),
        "status": "cancelled",
        "reason": request.reason,
    }


# ============================================
# UPCOMING INTERVIEWS (Dashboard)
# ============================================

@router.get("/interviews/upcoming", response_model=List[ScheduledInterview])
async def get_upcoming_interviews(
    limit: int = Query(10, ge=1, le=50, description="Max number of interviews to return"),
    current_user: CurrentUser = Depends(get_optional_user),
):
    """Get upcoming scheduled interviews for the dashboard."""
    from datetime import timedelta

    repo = get_scheduling_repo()
    today = date.today()
    future = today + timedelta(days=14)  # Next 2 weeks

    interviews = repo.get_scheduled_interviews(
        date_from=today,
        date_to=future,
        status="scheduled",
    )

    # Limit results
    interviews = interviews[:limit]

    result = []
    for i in interviews:
        candidate_name = None
        candidate_email = None
        if i.get('candidates'):
            candidate = i['candidates']
            if candidate.get('persons'):
                candidate_name = candidate['persons'].get('name')
                candidate_email = candidate['persons'].get('email')

        interviewer_name = None
        interviewer_email = None
        if i.get('hiring_managers'):
            interviewer_name = i['hiring_managers'].get('name')
            interviewer_email = i['hiring_managers'].get('email')

        job_title = None
        if i.get('job_postings'):
            job_title = i['job_postings'].get('title')

        result.append(ScheduledInterview(
            id=i['id'],
            candidate_id=i['candidate_id'],
            job_posting_id=i.get('job_posting_id'),
            interviewer_id=i.get('interviewer_id'),
            stage=i['stage'],
            interview_type=i.get('interview_type', 'live'),
            scheduled_at=datetime.fromisoformat(i['scheduled_at'].replace('Z', '+00:00')) if i.get('scheduled_at') else None,
            duration_minutes=i.get('duration_minutes', 45),
            timezone=i.get('timezone', 'America/New_York'),
            meeting_link=i.get('meeting_link'),
            room_name=i.get('room_name'),
            status=i.get('status', 'scheduled'),
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            interviewer_name=interviewer_name,
            interviewer_email=interviewer_email,
            job_title=job_title,
            created_at=datetime.fromisoformat(i['created_at'].replace('Z', '+00:00')) if isinstance(i['created_at'], str) else i['created_at'],
        ))

    return result
