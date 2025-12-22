"""
Pydantic models for Interview Analytics structured extraction
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal


class QuestionMetrics(BaseModel):
    """Metrics for a single Q&A pair"""
    relevance: int = Field(..., ge=0, le=10, description="Did the answer address the question directly?")
    clarity: int = Field(..., ge=0, le=10, description="Was the response well-structured and easy to follow?")
    depth: int = Field(..., ge=0, le=10, description="Thorough exploration vs surface-level?")
    type_specific_metric: int = Field(..., ge=0, le=10, description="STAR/Technical accuracy/Problem-solving based on type")
    type_specific_label: str = Field(..., description="Name of the 4th metric (e.g., 'STAR Adherence', 'Technical Accuracy')")


class QuestionAnswer(BaseModel):
    """A single question-answer pair with analysis"""
    question: str = Field(..., description="The question asked by the interviewer")
    answer: str = Field(..., description="The candidate's response (summarized if long)")
    question_type: Literal["technical", "behavioral", "situational", "other"] = Field(
        ..., description="Category of the question"
    )
    metrics: QuestionMetrics
    highlight: Optional[str] = Field(None, description="Notable quote or insight if answer was excellent")


class HighlightItem(BaseModel):
    """A single highlight with quote and context"""
    quote: Optional[str] = Field(None, description="Direct quote from the candidate")
    context: Optional[str] = Field(None, description="Why this is significant")
    
    def is_valid(self) -> bool:
        """Check if this highlight has actual content"""
        return bool(self.quote and self.context)


class StandoutMoment(BaseModel):
    """A standout moment extracted verbatim from the transcript"""
    question: Optional[str] = Field(None, description="Question that prompted the standout answer")
    quote: str = Field(..., min_length=1, description="Verbatim quote from the transcript")
    why: str = Field(..., min_length=1, description="Why this moment stands out")


class InterviewHighlights(BaseModel):
    """TL;DR of the interview - key moments"""
    best_answer: HighlightItem = Field(..., description="Strongest response from the candidate")
    red_flag: Optional[HighlightItem] = Field(None, description="Most concerning moment, if any")
    quotable_moment: str = Field("", description="Memorable quote that captures the candidate")
    areas_to_probe: list[str] = Field(default_factory=list, description="Topics needing follow-up in next round")
    standout_moments: list[StandoutMoment] = Field(
        default_factory=list,
        description="Top 2-3 standout moments with verbatim quotes and why they matter"
    )
    
    @property
    def has_red_flag(self) -> bool:
        """Check if there's a valid red flag"""
        return self.red_flag is not None and self.red_flag.is_valid()


class OverallMetrics(BaseModel):
    """Aggregate metrics for the entire interview"""
    overall_score: int = Field(..., ge=0, le=100, description="Overall interview performance score")
    communication_score: float = Field(..., ge=0, le=10, description="Average clarity across all answers")
    technical_score: float = Field(..., ge=0, le=10, description="Average technical accuracy (tech Q only)")
    cultural_fit_score: float = Field(..., ge=0, le=10, description="Inferred from behavioral responses")
    total_questions: int = Field(..., ge=0, description="Number of Q&A pairs identified")
    avg_response_length: int = Field(..., ge=0, description="Average words per answer")
    red_flags: list[str] = Field(default_factory=list, description="List of concerns with evidence")
    highlights: list[str] = Field(default_factory=list, description="Standout answers/qualities")
    recommendation: Literal["Strong Hire", "Hire", "Leaning Hire", "Leaning No Hire", "No Hire"] = Field(
        ..., description="Hiring recommendation"
    )
    recommendation_reasoning: str = Field(
        ..., description="1-2 sentence explanation of why this recommendation was given"
    )
    confidence: int = Field(..., ge=0, le=100, description="Confidence in recommendation (0-100%)")


class InterviewAnalytics(BaseModel):
    """Complete analytics response for an interview"""
    qa_pairs: list[QuestionAnswer] = Field(..., description="List of analyzed Q&A pairs")
    overall: OverallMetrics = Field(..., description="Aggregate interview metrics")
    highlights: InterviewHighlights = Field(..., description="TL;DR key moments from the interview")


class CoachSuggestion(BaseModel):
    """Real-time coaching suggestion after a Q&A exchange"""
    last_question_type: str = Field(..., description="Type of the question just asked")
    answer_quality: Literal["strong", "adequate", "weak", "unclear"] = Field(
        ..., description="Quick assessment of the candidate's last answer"
    )
    suggested_next_question: str = Field(..., description="Specific question to ask next")
    reasoning: str = Field(..., description="Why this question is recommended")
    should_change_topic: bool = Field(..., description="Whether to move to a different topic area")
    topic_suggestion: Optional[str] = Field(None, description="If changing topic, what area to explore")
