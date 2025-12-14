"""
Interview and Transcript models for database persistence.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
from enum import Enum
import uuid


class InterviewStage(str, Enum):
    """Fixed 3-stage interview pipeline."""
    ROUND_1 = "round_1"
    ROUND_2 = "round_2"
    ROUND_3 = "round_3"


class InterviewStatus(str, Enum):
    """Interview session status."""
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Interview(BaseModel):
    """An interview session for a candidate at a specific stage."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_id: str
    stage: InterviewStage
    
    # Session info
    interviewer_name: Optional[str] = None
    room_name: Optional[str] = None
    
    # Status
    status: InterviewStatus = InterviewStatus.SCHEDULED
    
    # Timing
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_sec: Optional[int] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class InterviewCreate(BaseModel):
    """Create payload for starting an interview."""
    candidate_id: str
    stage: Optional[InterviewStage] = None  # Auto-determined if not provided
    interviewer_name: Optional[str] = None


class InterviewWithAnalytics(Interview):
    """Interview with nested analytics data."""
    analytics: Optional[dict] = None
    transcript: Optional[dict] = None


class TranscriptTurn(BaseModel):
    """A single turn in the conversation."""
    speaker: Literal["agent", "candidate"]
    text: str
    timestamp: float = 0.0


class Transcript(BaseModel):
    """Full interview transcript."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    
    turns: List[TranscriptTurn] = Field(default_factory=list)
    full_text: str = ""
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class QuestionAsked(BaseModel):
    """Tracks questions asked to prevent redundancy."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    
    question_text: str
    topic: Optional[str] = None
    answer_quality: Optional[int] = Field(None, ge=0, le=10)
    follow_up_needed: bool = False
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
