"""
Recruiter model - represents a recruiter/hiring manager who owns jobs.

Each recruiter can have multiple jobs, and their performance is tracked
based on their hiring outcomes across all their jobs.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from uuid import UUID, uuid4


class RecruiterBase(BaseModel):
    """Base recruiter fields."""
    name: str = Field(..., min_length=1, max_length=255, description="Recruiter's full name")
    email: EmailStr = Field(..., description="Recruiter's email (unique identifier)")


class RecruiterCreate(RecruiterBase):
    """Fields required to create a new recruiter."""
    pass


class RecruiterUpdate(BaseModel):
    """Fields that can be updated on a recruiter. All optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None


class Recruiter(RecruiterBase):
    """Full recruiter model with all fields."""
    id: UUID = Field(default_factory=uuid4, description="Unique identifier")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Computed fields (populated by queries)
    job_count: int = Field(default=0, description="Number of jobs owned")
    active_job_count: int = Field(default=0, description="Number of active jobs")
    total_candidates: int = Field(default=0, description="Total candidates across all jobs")
    total_hires: int = Field(default=0, description="Total strong_hire recommendations")

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }


class RecruiterSummary(BaseModel):
    """Lightweight recruiter summary for dropdowns and lists."""
    id: UUID
    name: str
    email: str
    job_count: int = 0
    active_job_count: int = 0

    class Config:
        from_attributes = True
        json_encoders = {
            UUID: lambda v: str(v),
        }


class RecruiterStats(BaseModel):
    """Performance statistics for a recruiter."""
    recruiter_id: UUID
    recruiter_name: str

    # Job metrics
    total_jobs: int = 0
    active_jobs: int = 0
    closed_jobs: int = 0

    # Candidate metrics
    total_candidates: int = 0
    interviewed_candidates: int = 0
    pending_candidates: int = 0

    # Outcome metrics
    strong_hires: int = 0
    hires: int = 0
    maybes: int = 0
    no_hires: int = 0

    # Performance metrics
    avg_candidate_score: float = 0.0
    hire_rate: float = 0.0  # (strong_hires + hires) / total_interviewed
    avg_time_to_fill_days: Optional[float] = None  # Average days from job creation to first hire

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }
