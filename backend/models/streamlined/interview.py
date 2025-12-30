"""
Interview model - represents a single interview session with a candidate.

Each interview is linked to a Candidate (which links to both Person and Job).
Multiple interviews can exist for the same candidate (e.g., different rounds).
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum


class InterviewType(str, Enum):
    """Type of interview session."""
    AI_CANDIDATE = "ai_candidate"   # AI plays the candidate role (practice)
    LIVE = "live"                    # Real candidate interview
    PHONE_SCREEN = "phone_screen"    # Initial phone screening


class InterviewSessionStatus(str, Enum):
    """Status of an interview session."""
    SCHEDULED = "scheduled"       # Interview scheduled but not started
    IN_PROGRESS = "in_progress"   # Currently happening
    COMPLETED = "completed"       # Finished successfully
    CANCELLED = "cancelled"       # Cancelled before completion
    FAILED = "failed"             # Technical failure


class InterviewBase(BaseModel):
    """Base interview fields."""
    candidate_id: UUID = Field(..., description="Reference to Candidate")
    interview_type: InterviewType = Field(
        default=InterviewType.AI_CANDIDATE,
        description="Type of interview"
    )


class InterviewCreate(InterviewBase):
    """Fields required to create a new interview."""
    scheduled_at: Optional[datetime] = Field(
        None,
        description="When the interview is scheduled"
    )


class InterviewUpdate(BaseModel):
    """Fields that can be updated on an interview. All optional."""
    status: Optional[InterviewSessionStatus] = None
    transcript: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = Field(None, ge=0)
    room_name: Optional[str] = None
    room_url: Optional[str] = None
    notes: Optional[str] = None


class Interview(InterviewBase):
    """Full interview model with all fields."""
    id: UUID = Field(default_factory=uuid4, description="Unique identifier")
    status: InterviewSessionStatus = Field(
        default=InterviewSessionStatus.SCHEDULED,
        description="Current session status"
    )

    # Session data
    transcript: Optional[str] = Field(
        None,
        description="Full interview transcript"
    )
    started_at: Optional[datetime] = Field(
        None,
        description="When the interview actually started"
    )
    ended_at: Optional[datetime] = Field(
        None,
        description="When the interview ended"
    )
    duration_seconds: Optional[int] = Field(
        None,
        ge=0,
        description="Total duration in seconds"
    )

    # Room info (for LiveKit/Daily)
    room_name: Optional[str] = Field(
        None,
        description="LiveKit/Daily room name"
    )
    room_url: Optional[str] = Field(
        None,
        description="Room URL for joining"
    )

    # Notes
    notes: Optional[str] = Field(
        None,
        description="Interviewer notes"
    )

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Denormalized for easy queries (populated by joins)
    candidate_name: Optional[str] = Field(None, description="From Candidate->Person join")
    job_id: Optional[UUID] = Field(None, description="From Candidate join")
    job_title: Optional[str] = Field(None, description="From Candidate->Job join")

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }


class InterviewSummary(BaseModel):
    """Lightweight interview summary for list views."""
    id: UUID
    candidate_id: UUID
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    interview_type: InterviewType
    status: InterviewSessionStatus
    started_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }


class InterviewStartResponse(BaseModel):
    """Response when starting an interview session."""
    interview_id: UUID
    room_name: str
    token: str
    livekit_url: str
    candidate_name: str
    job_title: str

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }
