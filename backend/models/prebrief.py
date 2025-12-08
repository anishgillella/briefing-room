"""
Pydantic models for Pre-Interview Brief - comprehensive candidate analysis
"""
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class SkillLevel(str, Enum):
    EXPERT = "expert"
    PROFICIENT = "proficient"
    COMPETENT = "competent"
    BEGINNER = "beginner"
    NOT_FOUND = "not_found"


class SkillMatch(BaseModel):
    """A single skill requirement and candidate match"""
    skill: str = Field(..., description="The skill name")
    required_level: str = Field(..., description="Level required for the job")
    candidate_level: SkillLevel = Field(..., description="Candidate's assessed level")
    evidence: Optional[str] = Field(None, description="Evidence from resume")
    is_match: bool = Field(..., description="Does candidate meet requirement?")


class ExperienceHighlight(BaseModel):
    """A notable experience from the candidate's history"""
    company: str = Field(..., description="Company name")
    role: str = Field(..., description="Role/title")
    duration: str = Field(..., description="How long (e.g., '2.5 years')")
    key_achievement: str = Field(..., description="Most impressive accomplishment")
    relevance: str = Field(..., description="Why this matters for the role")


class ConcernItem(BaseModel):
    """An area of concern that needs probing"""
    concern: str = Field(..., description="Brief description of concern")
    evidence: str = Field(..., description="What in the resume triggered this")
    suggested_question: str = Field(..., description="Question to dig deeper")
    severity: str = Field(..., description="low/medium/high")


class StrengthItem(BaseModel):
    """A clear strength of the candidate"""
    strength: str = Field(..., description="Brief description of strength")
    evidence: str = Field(..., description="Evidence from resume")
    how_to_verify: str = Field(..., description="How to verify in interview")


class SuggestedQuestion(BaseModel):
    """A question to ask during the interview"""
    question: str = Field(..., description="The actual question to ask")
    category: str = Field(..., description="technical/behavioral/situational/cultural")
    purpose: str = Field(..., description="What you're trying to assess")
    follow_up: Optional[str] = Field(None, description="Follow-up if answer is vague")


class ScoreBreakdown(BaseModel):
    """Detailed scoring across different dimensions"""
    technical_skills: int = Field(..., ge=0, le=100, description="Technical skill match")
    experience_relevance: int = Field(..., ge=0, le=100, description="How relevant is their experience")
    leadership_potential: int = Field(..., ge=0, le=100, description="Leadership signals")
    communication_signals: int = Field(..., ge=0, le=100, description="Communication quality from resume")
    culture_fit_signals: int = Field(..., ge=0, le=100, description="Culture alignment signals")
    growth_trajectory: int = Field(..., ge=0, le=100, description="Career growth pattern")


class PreInterviewBrief(BaseModel):
    """Comprehensive pre-interview briefing for the interviewer"""
    
    # Candidate basics
    candidate_name: str = Field(..., description="Candidate's name from resume")
    current_role: str = Field(..., description="Current/most recent role")
    years_experience: float = Field(..., description="Total years of relevant experience")
    
    # Overall assessment
    overall_fit_score: int = Field(..., ge=0, le=100, description="Overall match score")
    fit_summary: str = Field(..., description="One-line summary of fit")
    score_breakdown: ScoreBreakdown = Field(..., description="Detailed scores by dimension")
    
    # Deep analysis
    skill_matches: list[SkillMatch] = Field(..., description="Skill-by-skill analysis")
    experience_highlights: list[ExperienceHighlight] = Field(..., description="Notable experiences")
    strengths: list[StrengthItem] = Field(..., description="Clear strengths")
    concerns: list[ConcernItem] = Field(..., description="Areas needing investigation")
    
    # Interview preparation
    suggested_questions: list[SuggestedQuestion] = Field(..., description="Questions to ask")
    topics_to_avoid: list[str] = Field(default_factory=list, description="Topics that might be sensitive")
    
    # Quick reference
    tldr: str = Field(..., description="2-3 sentence executive summary")
    key_things_to_remember: list[str] = Field(..., description="3-5 bullet points to keep in mind")

