"""
Pydantic models for interviewer analytics.
Used for structured LLM output parsing.
"""
from pydantic import BaseModel, Field
from typing import List, Optional


class QuestionQualityBreakdown(BaseModel):
    """Breakdown of question quality metrics."""
    relevance: int = Field(ge=0, le=100, description="How relevant are questions to the role")
    depth: int = Field(ge=0, le=100, description="How deep do questions probe skills")
    follow_up_quality: int = Field(ge=0, le=100, description="Quality of follow-up questions")
    open_ended_ratio: int = Field(ge=0, le=100, default=50, description="Percentage of open-ended vs closed questions")
    clarity: int = Field(ge=0, le=100, default=50, description="How clear and unambiguous questions were")


class TopicCoverage(BaseModel):
    """Coverage scores for different interview topics."""
    technical: int = Field(ge=0, le=100, description="Technical skill assessment coverage")
    behavioral: int = Field(ge=0, le=100, description="Behavioral question coverage")
    culture_fit: int = Field(ge=0, le=100, description="Culture fit assessment coverage")
    problem_solving: int = Field(ge=0, le=100, description="Problem solving assessment coverage")


class BiasIndicators(BaseModel):
    """Indicators of potential interviewer bias."""
    flags: List[str] = Field(default_factory=list, description="Specific bias indicators detected")
    severity: str = Field(default="none", description="Overall severity: none, low, medium, high")
    sentiment_balance: int = Field(ge=0, le=100, description="Balance of positive/negative sentiment (50 = balanced)")


class InterviewDynamics(BaseModel):
    """Analysis of interview flow and dynamics."""
    time_management: int = Field(ge=0, le=100, default=50, description="How well time was managed across topics")
    active_listening_score: int = Field(ge=0, le=100, default=50, description="Evidence of active listening and building on answers")
    rapport_building: int = Field(ge=0, le=100, default=50, description="How well interviewer built rapport")
    interruption_count: int = Field(ge=0, default=0, description="Number of times interviewer interrupted candidate")
    avg_response_wait_time: str = Field(default="appropriate", description="Did they give candidate time to think: rushed, appropriate, too_long")


class MissedOpportunities(BaseModel):
    """Areas where interviewer could have probed deeper."""
    topic: str = Field(description="Topic that wasn't explored adequately")
    candidate_statement: str = Field(description="What the candidate said that warranted follow-up")
    suggested_followup: str = Field(description="Question that should have been asked")


class QuestionEffectiveness(BaseModel):
    """Analysis of a specific question's effectiveness."""
    question: str = Field(description="The question asked")
    effectiveness_score: int = Field(ge=0, le=100, description="How effective was this question")
    information_elicited: str = Field(description="What useful info did it reveal: high, medium, low, none")
    better_alternative: Optional[str] = Field(default=None, description="A better way to ask this, if applicable")


class InterviewerAnalyticsResult(BaseModel):
    """Complete LLM analysis result for an interview."""

    # Core Scores (0-100)
    question_quality_score: int = Field(ge=0, le=100)
    topic_coverage_score: int = Field(ge=0, le=100)
    consistency_score: int = Field(ge=0, le=100)
    bias_score: int = Field(ge=0, le=100, description="Lower is better, 0 = no bias")
    candidate_experience_score: int = Field(ge=0, le=100)
    overall_score: int = Field(ge=0, le=100)

    # Detailed breakdowns
    question_quality_breakdown: QuestionQualityBreakdown
    topics_covered: TopicCoverage
    bias_indicators: BiasIndicators

    # NEW: Interview dynamics
    interview_dynamics: Optional[InterviewDynamics] = None

    # NEW: Missed opportunities for deeper probing
    missed_opportunities: List[MissedOpportunities] = Field(default_factory=list)

    # NEW: Question-by-question effectiveness
    question_effectiveness: List[QuestionEffectiveness] = Field(default_factory=list)

    # NEW: Coverage gaps - critical areas not explored
    coverage_gaps: List[str] = Field(default_factory=list, description="Critical topics that weren't covered")

    # NEW: Strengths summary
    interviewer_strengths: List[str] = Field(default_factory=list, description="What the interviewer did well")

    # Recommendations
    improvement_suggestions: List[str] = Field(default_factory=list)

    # Summary
    summary: str = Field(description="One-line summary of interviewer performance")

    # NEW: Detailed narrative
    detailed_assessment: Optional[str] = Field(default=None, description="2-3 paragraph detailed assessment")
