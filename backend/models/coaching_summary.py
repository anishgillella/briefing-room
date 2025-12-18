"""
Coaching Summary models for offer preparation.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ObjectionResponse(BaseModel):
    """A prepared response to an anticipated objection."""
    objection: str
    response: str
    notes: Optional[str] = None


class OfferScript(BaseModel):
    """Structured offer presentation script."""
    opening: str
    equity_explanation: str
    competitor_handling: Optional[str] = None
    closing: str


class CoachingSummary(BaseModel):
    """Summary generated after a coaching session."""
    id: Optional[str] = None
    candidate_id: str
    candidate_name: str

    # Session info
    session_duration_seconds: Optional[int] = None
    session_date: datetime = Field(default_factory=datetime.utcnow)

    # Generated content
    offer_script: Optional[OfferScript] = None
    key_reminders: List[str] = Field(default_factory=list)
    objection_responses: List[ObjectionResponse] = Field(default_factory=list)

    # What to emphasize
    lead_with: Optional[str] = None  # What to lead with in the offer
    avoid: List[str] = Field(default_factory=list)  # What to avoid saying

    # Risk mitigation
    competitor_strategy: Optional[str] = None
    negotiation_boundaries: Optional[str] = None

    # Raw data
    coaching_transcript: Optional[str] = None
    transcript_turns: List[dict] = Field(default_factory=list)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class CoachingSummaryCreate(BaseModel):
    """Request to create a coaching summary."""
    candidate_id: str
    transcript_turns: List[dict]
    session_duration_seconds: Optional[int] = None
    offer_base: Optional[int] = None
    offer_equity: Optional[float] = None


class CoachingSummaryResponse(BaseModel):
    """Response with coaching summary."""
    status: str
    summary: Optional[CoachingSummary] = None
    errors: List[str] = Field(default_factory=list)
