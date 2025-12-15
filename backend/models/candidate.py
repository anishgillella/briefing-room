"""
Unified Candidate model for Pluto integration.
Combines scoring fields from Pluto with interview tracking from Briefing Room.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal, Union, Any
from datetime import datetime
import uuid


class Candidate(BaseModel):
    """Unified candidate model for the entire application."""
    
    # Identity
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    
    # Basic Info (from resume/CSV)
    job_title: Optional[str] = None
    current_company: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    years_experience: Optional[float] = None
    
    # Extracted Resume Data
    bio_summary: Optional[str] = None
    industries: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    education: Optional[Union[str, List[Any]]] = None
    sales_methodologies: List[str] = Field(default_factory=list)
    
    # Pluto Scoring Signals
    sold_to_finance: bool = False
    is_founder: bool = False
    startup_experience: bool = False
    enterprise_experience: bool = False
    max_acv_mentioned: Optional[int] = None
    quota_attainment: Optional[float] = None
    
    # Pluto Scores (0-100)
    algo_score: Optional[int] = None
    ai_score: Optional[int] = None
    combined_score: Optional[int] = None
    tier: Optional[str] = None  # "Top Tier", "Strong", "Good", "Evaluate", "Poor"
    
    # AI Evaluation Details
    one_line_summary: Optional[str] = None
    pros: List[str] = Field(default_factory=list)
    cons: List[str] = Field(default_factory=list)
    reasoning: Optional[str] = None
    interview_questions: List[str] = Field(default_factory=list)
    
    # Data Quality (Pluto)
    missing_required: List[str] = Field(default_factory=list)
    missing_preferred: List[str] = Field(default_factory=list)
    red_flags: List[str] = Field(default_factory=list)
    red_flag_count: int = 0
    completeness: int = 0  # 0-100%
    
    # Interview Tracking (Briefing Room)
    interview_status: Optional[str] = "not_scheduled"
    room_name: Optional[str] = None
    interview_score: Optional[int] = None
    recommendation: Optional[str] = None  # "Strong Hire", "Hire", etc.
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    source: Literal["csv_upload", "manual", "voice_enriched"] = "csv_upload"
    has_enrichment_data: bool = False
    
    # Dynamic Fields (job-specific extraction fields stored as JSONB)
    custom_fields: dict = Field(default_factory=dict)
    
    class Config:
        extra = "allow"
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CandidateCreate(BaseModel):
    """Schema for creating a new candidate manually."""
    name: str
    email: Optional[str] = None
    job_title: Optional[str] = None
    current_company: Optional[str] = None
    bio_summary: Optional[str] = None


class CandidateUpdate(BaseModel):
    """Schema for updating candidate fields."""
    name: Optional[str] = None
    email: Optional[str] = None
    job_title: Optional[str] = None
    current_company: Optional[str] = None
    bio_summary: Optional[str] = None
    interview_status: Optional[Literal["not_scheduled", "briefing", "in_progress", "completed"]] = None
    room_name: Optional[str] = None
    interview_score: Optional[int] = None
    recommendation: Optional[str] = None


class ProcessingStatus(BaseModel):
    """Status of CSV processing pipeline."""
    status: Literal["idle", "extracting", "scoring", "complete", "error"] = "idle"
    phase: str = ""
    progress: int = 0
    message: str = ""
    candidates_total: int = 0
    candidates_extracted: int = 0
    candidates_scored: int = 0
    error: Optional[str] = None
