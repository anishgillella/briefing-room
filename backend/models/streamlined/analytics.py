"""
Analytics model - represents the AI-generated analysis of an interview.

Each Analytics record is linked to one Interview. Analytics are scored
against the Job's specific criteria (competencies, must-haves, red flags).
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum


class Recommendation(str, Enum):
    """Hiring recommendation based on interview analysis."""
    STRONG_HIRE = "strong_hire"   # Score 85+, no red flags, all must-haves
    HIRE = "hire"                  # Score 70+, no critical red flags
    MAYBE = "maybe"                # Score 50-69, minor concerns
    NO_HIRE = "no_hire"            # Score below 50 or critical issues


class CompetencyScore(BaseModel):
    """Score for a single competency evaluated during the interview."""
    name: str = Field(..., description="Name of the competency")
    score: float = Field(..., ge=0, le=100, description="Score 0-100")
    evidence: List[str] = Field(
        default_factory=list,
        description="Quotes from transcript demonstrating this competency"
    )
    notes: Optional[str] = Field(
        None,
        description="Brief analysis of performance in this area"
    )


class MustHaveAssessment(BaseModel):
    """Assessment of whether a must-have requirement was demonstrated."""
    requirement: str = Field(..., description="The must-have requirement")
    demonstrated: bool = Field(
        ...,
        description="Whether the candidate demonstrated this"
    )
    evidence: Optional[str] = Field(
        None,
        description="How they demonstrated it (or why not)"
    )


class RedFlagDetection(BaseModel):
    """A red flag detected during the interview."""
    flag: str = Field(..., description="Description of the red flag")
    evidence: str = Field(
        ...,
        description="Quote or observation from transcript"
    )
    severity: str = Field(
        default="medium",
        description="One of: 'low', 'medium', 'high', 'critical'"
    )


class AnalyticsBase(BaseModel):
    """Base analytics fields."""
    interview_id: UUID = Field(..., description="Reference to Interview")


class AnalyticsCreate(AnalyticsBase):
    """Fields for creating analytics (usually done by AI)."""
    overall_score: float = Field(..., ge=0, le=100)
    competency_scores: List[CompetencyScore]
    strengths: List[str]
    concerns: List[str]
    red_flags_detected: List[str]
    recommendation: Recommendation
    summary: str


class AnalyticsUpdate(BaseModel):
    """Fields that can be updated on analytics. All optional."""
    overall_score: Optional[float] = Field(None, ge=0, le=100)
    competency_scores: Optional[List[CompetencyScore]] = None
    strengths: Optional[List[str]] = None
    concerns: Optional[List[str]] = None
    red_flags_detected: Optional[List[str]] = None
    recommendation: Optional[Recommendation] = None
    recommendation_reasoning: Optional[str] = None
    summary: Optional[str] = None


class Analytics(AnalyticsBase):
    """Full analytics model with all fields."""
    id: UUID = Field(default_factory=uuid4, description="Unique identifier")

    # Scores
    overall_score: float = Field(..., ge=0, le=100, description="Overall score 0-100")
    competency_scores: List[CompetencyScore] = Field(
        default_factory=list,
        description="Scores for each evaluated competency"
    )

    # Must-have assessment
    must_have_assessments: List[MustHaveAssessment] = Field(
        default_factory=list,
        description="Assessment of each must-have requirement"
    )

    # Qualitative assessment
    strengths: List[str] = Field(
        default_factory=list,
        description="Key strengths demonstrated"
    )
    concerns: List[str] = Field(
        default_factory=list,
        description="Areas of concern or improvement"
    )
    red_flags_detected: List[str] = Field(
        default_factory=list,
        description="Red flags found during interview"
    )
    red_flag_details: List[RedFlagDetection] = Field(
        default_factory=list,
        description="Detailed red flag information"
    )

    # Recommendation
    recommendation: Recommendation = Field(
        ...,
        description="Hiring recommendation"
    )
    recommendation_reasoning: Optional[str] = Field(
        None,
        description="Explanation for the recommendation"
    )

    # Summary
    summary: str = Field(
        ...,
        description="2-3 sentence overall summary"
    )

    # Raw AI response (for debugging/auditing)
    raw_ai_response: Optional[Dict[str, Any]] = Field(
        None,
        description="Full AI response for debugging"
    )

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    model_used: Optional[str] = Field(
        None,
        description="Which LLM model generated this analysis"
    )

    # Denormalized for easy queries
    candidate_id: Optional[UUID] = Field(None, description="From Interview join")
    candidate_name: Optional[str] = Field(None, description="From Interview->Candidate join")
    job_id: Optional[UUID] = Field(None, description="From Interview->Candidate join")
    job_title: Optional[str] = Field(None, description="From Interview->Candidate->Job join")

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }


class AnalyticsSummary(BaseModel):
    """Lightweight analytics summary for list views."""
    id: UUID
    interview_id: UUID
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    overall_score: float
    recommendation: Recommendation
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }


class JobAnalyticsSummary(BaseModel):
    """Aggregated analytics summary for a job."""
    job_id: UUID
    job_title: str
    total_candidates: int = 0
    avg_score: float = 0.0
    recommendation_breakdown: Dict[str, int] = Field(
        default_factory=dict,
        description="Count of each recommendation type"
    )
    top_candidates: List[AnalyticsSummary] = Field(
        default_factory=list,
        description="Top scoring candidates"
    )

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }
