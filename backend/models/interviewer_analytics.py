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


class InterviewerAnalyticsResult(BaseModel):
    """Complete LLM analysis result for an interview."""
    
    # Scores (0-100)
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
    
    # Recommendations
    improvement_suggestions: List[str] = Field(default_factory=list)
    
    # Summary
    summary: str = Field(description="One-line summary of interviewer performance")
