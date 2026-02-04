"""
Candidate model - represents a person's application to a specific job.

This is a junction table between Person and Job. The same Person can
have multiple Candidate records (one for each job they apply to).
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum


class InterviewStatus(str, Enum):
    """Status of a candidate's interview progress."""
    PENDING = "pending"           # Not yet interviewed
    SCHEDULED = "scheduled"       # Interview scheduled
    IN_PROGRESS = "in_progress"   # Currently interviewing
    COMPLETED = "completed"       # Interview finished
    WITHDRAWN = "withdrawn"       # Candidate withdrew
    REJECTED = "rejected"         # Rejected after review


class CandidateBase(BaseModel):
    """Base candidate fields."""
    person_id: Optional[UUID] = Field(None, description="Reference to Person")
    job_id: UUID = Field(..., description="Reference to Job")
    bio_summary: Optional[str] = Field(
        None,
        description="AI-generated summary from resume for this job"
    )
    skills: List[str] = Field(
        default_factory=list,
        description="Extracted skills relevant to this job"
    )
    years_experience: Optional[int] = Field(
        None,
        ge=0,
        description="Years of experience"
    )
    current_company: Optional[str] = Field(None, max_length=255)
    current_title: Optional[str] = Field(None, max_length=255)
    combined_score: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="AI screening score (0-100)"
    )
    screening_notes: Optional[str] = Field(
        None,
        description="JSON with screening details (red flags, green flags, etc.)"
    )


class CandidateCreate(CandidateBase):
    """Fields required to create a new candidate."""
    pass


class CandidateUpdate(BaseModel):
    """Fields that can be updated on a candidate. All optional."""
    bio_summary: Optional[str] = None
    skills: Optional[List[str]] = None
    years_experience: Optional[int] = Field(None, ge=0)
    current_company: Optional[str] = Field(None, max_length=255)
    current_title: Optional[str] = Field(None, max_length=255)
    interview_status: Optional[InterviewStatus] = None
    notes: Optional[str] = None
    combined_score: Optional[int] = Field(None, ge=0, le=100)
    screening_notes: Optional[str] = None


class Candidate(CandidateBase):
    """Full candidate model with all fields."""
    id: UUID = Field(default_factory=uuid4, description="Unique identifier")
    interview_status: InterviewStatus = Field(
        default=InterviewStatus.PENDING,
        description="Interview progress status"
    )
    pipeline_status: Optional[str] = Field(
        None,
        description="Pipeline stage (new, round_1, round_2, etc.)"
    )
    notes: Optional[str] = Field(
        None,
        description="Recruiter notes about this candidate"
    )

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Joined data (populated by queries with relationships)
    person_name: Optional[str] = Field(None, description="From Person join")
    person_email: Optional[str] = Field(None, description="From Person join")
    job_title: Optional[str] = Field(None, description="From Job join")

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }


class CandidateWithScore(Candidate):
    """Candidate with their latest analytics score."""
    latest_score: Optional[float] = Field(
        None,
        description="Most recent interview score"
    )
    recommendation: Optional[str] = Field(
        None,
        description="Most recent recommendation"
    )


class CandidateListItem(BaseModel):
    """Lightweight candidate for list views."""
    id: UUID
    person_name: str
    person_email: str
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    interview_status: InterviewStatus
    skills: List[str] = Field(default_factory=list)
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }
