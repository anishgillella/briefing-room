"""
Job model - represents a job opening/position that candidates apply to.

The Job is the central organizing entity in the streamlined flow.
All candidates, interviews, and analytics reference a Job.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum


class JobStatus(str, Enum):
    """Status of a job opening."""
    DRAFT = "draft"           # Job being set up, not ready for candidates
    ACTIVE = "active"         # Actively hiring
    PAUSED = "paused"         # Temporarily not reviewing candidates
    CLOSED = "closed"         # Position filled or cancelled


class WeightedAttribute(BaseModel):
    """An attribute with an associated weight for candidate scoring."""
    value: str = Field(..., description="The attribute text/description")
    weight: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Weight for scoring (0.0-1.0). Higher = more important."
    )


class BasicRequirement(BaseModel):
    """A basic requirement extracted from the JD with weight."""
    value: str = Field(..., description="The requirement value")
    weight: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Weight for scoring (0.0-1.0)"
    )


class ExtractedRequirements(BaseModel):
    """Structured requirements extracted from job description via AI."""
    # Basic info
    years_experience: Optional[str] = Field(
        None,
        description="e.g., '3-5 years' or '5+ years'"
    )
    education: Optional[str] = Field(
        None,
        description="e.g., 'Bachelor's in Computer Science'"
    )
    location: Optional[str] = Field(
        None,
        description="e.g., 'San Francisco, CA' or 'Remote'"
    )
    work_type: Optional[str] = Field(
        None,
        description="One of: 'remote', 'hybrid', 'onsite'"
    )
    salary_range: Optional[str] = Field(
        None,
        description="e.g., '$120k-$150k'"
    )

    # Technical skills with weights for scoring
    required_skills: List[WeightedAttribute] = Field(
        default_factory=list,
        description="List of required/must-have skills with weights"
    )
    preferred_skills: List[WeightedAttribute] = Field(
        default_factory=list,
        description="List of nice-to-have skills with weights"
    )
    certifications: List[str] = Field(
        default_factory=list,
        description="Any required certifications"
    )

    # Semantic profile attributes for candidate screening - ALL with weights
    success_signals: List[WeightedAttribute] = Field(
        default_factory=list,
        description="Green flags - indicators of a strong candidate with importance weights"
    )
    red_flags: List[WeightedAttribute] = Field(
        default_factory=list,
        description="Red flags - warning signs with severity weights (higher = more disqualifying)"
    )
    behavioral_traits: List[WeightedAttribute] = Field(
        default_factory=list,
        description="Key behavioral traits with importance weights"
    )
    cultural_indicators: List[WeightedAttribute] = Field(
        default_factory=list,
        description="Cultural fit indicators with importance weights"
    )
    deal_breakers: List[WeightedAttribute] = Field(
        default_factory=list,
        description="Non-negotiable requirements with weights (typically high)"
    )
    ideal_background: Optional[str] = Field(
        None,
        description="Description of the ideal candidate's background and experience"
    )

    # Category-level weights for overall scoring
    category_weights: dict = Field(
        default_factory=lambda: {
            "required_skills": 0.25,
            "preferred_skills": 0.10,
            "success_signals": 0.20,
            "red_flags": 0.15,
            "behavioral_traits": 0.15,
            "cultural_indicators": 0.10,
            "deal_breakers": 0.05,
        },
        description="Weights for each category in overall candidate scoring"
    )

    # Missing fields indicator
    missing_fields: List[str] = Field(
        default_factory=list,
        description="Fields that could not be extracted from the JD and need recruiter input"
    )
    extraction_confidence: float = Field(
        default=0.0,
        ge=0,
        le=1,
        description="Overall confidence score for the extraction (0-1)"
    )


class CompanyContext(BaseModel):
    """Company information enriched via voice agent conversation with recruiter."""
    company_name: Optional[str] = Field(None, description="Name of the company")
    company_description: Optional[str] = Field(
        None,
        description="Brief description of what the company does"
    )
    team_size: Optional[str] = Field(
        None,
        description="e.g., '8 engineers' or 'small startup'"
    )
    team_culture: Optional[str] = Field(
        None,
        description="Description of team culture and work style"
    )
    reporting_to: Optional[str] = Field(
        None,
        description="Who the role reports to, e.g., 'VP of Engineering'"
    )
    growth_stage: Optional[str] = Field(
        None,
        description="e.g., 'Series A startup', 'scale-up', 'enterprise'"
    )
    key_projects: List[str] = Field(
        default_factory=list,
        description="Key projects the hire would work on"
    )


class ScoringCriteria(BaseModel):
    """Criteria for evaluating candidates, extracted via voice agent."""
    must_haves: List[str] = Field(
        default_factory=list,
        description="Non-negotiable requirements - candidate must demonstrate these"
    )
    nice_to_haves: List[str] = Field(
        default_factory=list,
        description="Bonus points if candidate has these"
    )
    cultural_fit_traits: List[str] = Field(
        default_factory=list,
        description="Personality traits and work styles that fit the team"
    )
    technical_competencies: List[str] = Field(
        default_factory=list,
        description="Technical skills/competencies to evaluate"
    )
    weight_technical: float = Field(
        default=0.5,
        ge=0,
        le=1,
        description="Weight for technical skills (0-1)"
    )
    weight_experience: float = Field(
        default=0.3,
        ge=0,
        le=1,
        description="Weight for experience (0-1)"
    )
    weight_cultural: float = Field(
        default=0.2,
        ge=0,
        le=1,
        description="Weight for cultural fit (0-1)"
    )


class JobBase(BaseModel):
    """Base job fields for create/update operations."""
    title: str = Field(..., min_length=1, max_length=255, description="Job title")
    raw_description: str = Field(..., min_length=1, description="Full job description text")
    status: JobStatus = Field(default=JobStatus.DRAFT, description="Job status")
    recruiter_id: Optional[UUID] = Field(None, description="ID of the recruiter who owns this job")


class JobCreate(JobBase):
    """Fields required to create a new job."""
    pass


class JobUpdate(BaseModel):
    """Fields that can be updated on a job. All optional."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    raw_description: Optional[str] = Field(None, min_length=1)
    status: Optional[JobStatus] = None
    recruiter_id: Optional[UUID] = None
    extracted_requirements: Optional[ExtractedRequirements] = None
    company_context: Optional[CompanyContext] = None
    scoring_criteria: Optional[ScoringCriteria] = None
    red_flags: Optional[List[str]] = None


class Job(JobBase):
    """Full job model with all fields including AI-extracted data."""
    id: UUID = Field(default_factory=uuid4, description="Unique identifier")

    # AI-extracted/enriched data
    extracted_requirements: Optional[ExtractedRequirements] = Field(
        None,
        description="Requirements extracted from JD via AI"
    )
    company_context: Optional[CompanyContext] = Field(
        None,
        description="Company context from voice agent conversation"
    )
    scoring_criteria: Optional[ScoringCriteria] = Field(
        None,
        description="Evaluation criteria from voice agent conversation"
    )
    red_flags: List[str] = Field(
        default_factory=list,
        description="Things to watch out for in candidates"
    )

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(
        None,
        description="Soft delete timestamp. If set, job is archived."
    )

    # Computed fields (populated by queries)
    candidate_count: int = Field(default=0, description="Number of candidates")
    interviewed_count: int = Field(default=0, description="Number interviewed")
    recruiter_name: Optional[str] = Field(None, description="Name of the recruiter who owns this job")
    is_archived: bool = Field(default=False, description="True if job is archived (deleted_at is set)")

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }


class JobSummary(BaseModel):
    """Lightweight job summary for list views."""
    id: UUID
    title: str
    status: JobStatus
    candidate_count: int = 0
    interviewed_count: int = 0
    created_at: datetime
    deleted_at: Optional[datetime] = None
    is_archived: bool = False

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }
