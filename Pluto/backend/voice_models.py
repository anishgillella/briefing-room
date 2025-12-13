"""
Pydantic models for voice agent and resume processing.
Production-ready schemas for structured data extraction.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


# ============================================================================
# Resume Extraction Models
# ============================================================================

class Project(BaseModel):
    name: str
    description: str
    tech_stack: List[str]
    url: Optional[str] = None

class JobRole(BaseModel):
    company: str
    title: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    key_achievements: List[str] = Field(description="Bulleted list of quantitative impact")
    tech_used: List[str] = Field(default_factory=list)

class Education(BaseModel):
    institution: str
    degree: str
    graduation_date: Optional[str] = None
    gpa: Optional[str] = None
    highlights: List[str] = Field(default_factory=list, description="Coursework, honors, clubs")

class ResumeExtraction(BaseModel):
    # Personal
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None
    
    # High Level
    summary: Optional[str] = Field(description="Executive summary of the candidate")
    years_experience: Optional[float] = None
    
    # Detailed Sections
    work_history: List[JobRole] = Field(default_factory=list)
    education: List[Education] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    
    # Skills Deep Dive
    languages: List[str] = Field(default_factory=list, description="Programming languages")
    frameworks: List[str] = Field(default_factory=list, description="Libraries/Frameworks")
    tools: List[str] = Field(default_factory=list, description="DevOps, Cloud, DBs")
    
    # Signals
    awards: List[str] = Field(default_factory=list)
    publications: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    
    # Role Classification
    is_technical: bool = False
    is_sales: bool = False
    
    # Sales Specifics (if applicable)
    quota_attainment: Optional[str] = None
    deal_size: Optional[str] = None
    
    # Meta
    confidence_scores: Dict[str, int] = Field(default_factory=dict, description="0-100 confidence score for inferred fields")

class CandidateAnalysis(BaseModel):
    """AI-generated analysis of the candidate."""
    strengths: List[str] = Field(default_factory=list, description="Key strengths based on resume")
    weaknesses: List[str] = Field(default_factory=list, description="Potential concerns or gaps")
    red_flags: List[str] = Field(default_factory=list, description="Things to probe deeper")
    why_consider: str = Field("", description="Why this candidate might be a good fit")
    suggested_questions: List[str] = Field(default_factory=list, description="Interview questions to ask")

class GapAnalysisResult(BaseModel):
    missing_critical: List[str] = Field(default_factory=list)
    missing_nice_to_have: List[str] = Field(default_factory=list)
    suggested_deep_dive_questions: List[str] = Field(default_factory=list)
    completeness_score: int = Field(ge=0, le=100)
    candidate_analysis: Optional[CandidateAnalysis] = None


# ============================================================================
# Voice Agent Models
# ============================================================================

class VoiceQuestion(BaseModel):
    """A question to be asked by the voice agent."""
    
    field_key: str = Field(description="The data field this question fills")
    question_text: str = Field(description="The question to ask")
    follow_up: Optional[str] = Field(default=None, description="Follow-up if answer is unclear")


class VoiceSessionConfig(BaseModel):
    """Configuration for a voice agent session."""
    
    candidate_name: str = Field(description="Candidate's name for personalization")
    known_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Data already extracted from resume"
    )
    questions_to_ask: List[VoiceQuestion] = Field(
        default_factory=list,
        description="Dynamic questions based on gaps"
    )
    first_message: str = Field(description="Opening message from voice agent")
    system_prompt: str = Field(description="Complete system prompt for LLM")


# ============================================================================
# API Request/Response Models
# ============================================================================

class ResumeUploadResponse(BaseModel):
    """Response after resume upload and extraction."""
    
    candidate_id: str
    extracted_data: ResumeExtraction
    gaps: GapAnalysisResult
    voice_session_config: Optional[VoiceSessionConfig] = Field(
        default=None,
        description="Config for voice follow-up if needed"
    )
