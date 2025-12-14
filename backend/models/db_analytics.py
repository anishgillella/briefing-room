"""
Database models for deep analytics (extends existing analytics.py).
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
import uuid


class DBQuestionAnalytics(BaseModel):
    """Question analytics for database storage."""
    question: str
    answer_summary: str
    topic: str = "General"
    quality_score: int = Field(ge=0, le=100)
    relevance_score: int = Field(ge=0, le=10, default=5)
    clarity_score: int = Field(ge=0, le=10, default=5)
    depth_score: int = Field(ge=0, le=10, default=5)
    key_insight: str = ""


class DBSkillEvidence(BaseModel):
    """Skill evidence with quote and confidence."""
    skill: str
    quote: str
    confidence: Literal["high", "medium", "low"] = "medium"


class DBBehavioralProfile(BaseModel):
    """Behavioral radar chart metrics."""
    leadership: int = Field(ge=0, le=10, default=5)
    resilience: int = Field(ge=0, le=10, default=5)
    communication: int = Field(ge=0, le=10, default=5)
    problem_solving: int = Field(ge=0, le=10, default=5)
    coachability: int = Field(ge=0, le=10, default=5)


class DBCommunicationMetrics(BaseModel):
    """Communication analysis metrics."""
    speaking_pace: str = "moderate"  # "fast", "moderate", "slow"
    filler_words_count: int = 0
    listen_talk_ratio: float = 0.5


class DBAnalytics(BaseModel):
    """Deep analytics stored in database."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    
    # Overall assessment
    overall_score: int = Field(ge=0, le=100)
    recommendation: Literal["Strong Hire", "Hire", "No Hire"]
    synthesis: str
    
    # Detailed analysis
    question_analytics: List[DBQuestionAnalytics] = Field(default_factory=list)
    skill_evidence: List[DBSkillEvidence] = Field(default_factory=list)
    behavioral_profile: Optional[DBBehavioralProfile] = None
    communication_metrics: Optional[DBCommunicationMetrics] = None
    topics_to_probe: List[str] = Field(default_factory=list)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
