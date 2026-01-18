"""
Scheduling models for interview availability and booking.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date, time
from enum import Enum
import uuid


class DayOfWeek(int, Enum):
    """Days of the week (0 = Sunday, 6 = Saturday)."""
    SUNDAY = 0
    MONDAY = 1
    TUESDAY = 2
    WEDNESDAY = 3
    THURSDAY = 4
    FRIDAY = 5
    SATURDAY = 6


class OverrideType(str, Enum):
    """Type of availability override."""
    AVAILABLE = "available"      # Adds extra availability
    UNAVAILABLE = "unavailable"  # Blocks time off


# ============================================
# WEEKLY AVAILABILITY
# ============================================

class AvailabilityWeeklyBase(BaseModel):
    """Base fields for weekly availability slots."""
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    is_active: bool = True

    @field_validator('end_time')
    @classmethod
    def end_after_start(cls, v, info):
        if 'start_time' in info.data and v <= info.data['start_time']:
            raise ValueError('end_time must be after start_time')
        return v


class AvailabilityWeeklyCreate(AvailabilityWeeklyBase):
    """Create payload for weekly availability."""
    interviewer_id: str


class AvailabilityWeekly(AvailabilityWeeklyBase):
    """Full weekly availability model."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interviewer_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            time: lambda v: v.isoformat() if v else None,
        }


# ============================================
# AVAILABILITY OVERRIDES (Specific Dates)
# ============================================

class AvailabilityOverrideBase(BaseModel):
    """Base fields for availability overrides."""
    override_date: date
    override_type: OverrideType
    start_time: Optional[time] = None  # None = all day
    end_time: Optional[time] = None
    reason: Optional[str] = None

    @field_validator('end_time')
    @classmethod
    def validate_times(cls, v, info):
        start = info.data.get('start_time')
        if start is not None and v is not None and v <= start:
            raise ValueError('end_time must be after start_time')
        if (start is None) != (v is None):
            raise ValueError('both start_time and end_time must be provided, or neither')
        return v


class AvailabilityOverrideCreate(AvailabilityOverrideBase):
    """Create payload for availability override."""
    interviewer_id: str


class AvailabilityOverride(AvailabilityOverrideBase):
    """Full availability override model."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interviewer_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            date: lambda v: v.isoformat() if v else None,
            time: lambda v: v.isoformat() if v else None,
        }


# ============================================
# INTERVIEW SCHEDULING
# ============================================

class ScheduleInterviewRequest(BaseModel):
    """Request to schedule an interview."""
    candidate_id: str
    job_posting_id: str
    interviewer_id: str
    stage: str = "round_1"
    scheduled_at: datetime
    duration_minutes: int = Field(default=45, ge=15, le=180)
    timezone: str = "America/New_York"
    interview_type: str = "live"
    notes: Optional[str] = None


class RescheduleInterviewRequest(BaseModel):
    """Request to reschedule an existing interview."""
    new_scheduled_at: datetime
    new_interviewer_id: Optional[str] = None
    reason: Optional[str] = None


class CancelInterviewRequest(BaseModel):
    """Request to cancel an interview."""
    reason: Optional[str] = None


# ============================================
# TIME SLOTS (for availability display)
# ============================================

class TimeSlot(BaseModel):
    """A single available time slot."""
    start: datetime
    end: datetime
    interviewer_id: str
    interviewer_name: Optional[str] = None
    is_available: bool = True


class AvailableSlotsRequest(BaseModel):
    """Request to get available slots."""
    interviewer_id: Optional[str] = None  # None = any interviewer
    date_from: date
    date_to: date
    duration_minutes: int = 45
    timezone: str = "America/New_York"


class AvailableSlotsResponse(BaseModel):
    """Response containing available time slots."""
    slots: List[TimeSlot]
    interviewer_id: Optional[str] = None
    date_from: date
    date_to: date


# ============================================
# SCHEDULED INTERVIEW (Extended Interview)
# ============================================

class ScheduledInterview(BaseModel):
    """Interview with scheduling details."""
    id: str
    candidate_id: str
    job_posting_id: Optional[str] = None
    interviewer_id: Optional[str] = None
    stage: str
    interview_type: str = "live"

    # Scheduling fields
    scheduled_at: Optional[datetime] = None
    duration_minutes: int = 45
    timezone: str = "America/New_York"
    meeting_link: Optional[str] = None
    room_name: Optional[str] = None

    # Status
    status: str = "scheduled"

    # Actual timing
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    # Metadata
    notes: Optional[str] = None
    cancel_reason: Optional[str] = None
    reminder_sent_at: Optional[datetime] = None

    # Joined data
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    interviewer_name: Optional[str] = None
    interviewer_email: Optional[str] = None
    job_title: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
        }


# ============================================
# INTERVIEWER SETTINGS
# ============================================

class InterviewerSchedulingSettings(BaseModel):
    """Scheduling preferences for an interviewer."""
    interviewer_id: str
    timezone: str = "America/New_York"
    default_interview_duration_minutes: int = 45
    max_interviews_per_day: int = 5


class UpdateInterviewerSettingsRequest(BaseModel):
    """Request to update interviewer scheduling settings."""
    timezone: Optional[str] = None
    default_interview_duration_minutes: Optional[int] = Field(None, ge=15, le=180)
    max_interviews_per_day: Optional[int] = Field(None, ge=1, le=20)
