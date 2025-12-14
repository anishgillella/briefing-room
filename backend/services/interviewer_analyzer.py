"""
Interviewer Analytics Analyzer.
Uses a single LLM call with Pydantic structured output to analyze interview quality.
"""
import json
import logging
from typing import Optional
from openai import AsyncOpenAI
from models.interviewer_analytics import InterviewerAnalyticsResult

logger = logging.getLogger(__name__)


ANALYSIS_PROMPT = """You are an expert interview analyst. Analyze this interview transcript and interviewer's questions to provide detailed feedback.

## Interview Transcript:
{transcript}

## Questions Asked by Interviewer:
{questions}

## Your Task:
Analyze the interviewer's performance and provide scores and feedback in these areas:

1. **Question Quality** (0-100): Rate the relevance, depth, and follow-up quality of questions
2. **Topic Coverage** (0-100): Rate how well they covered technical, behavioral, culture fit, and problem-solving areas
3. **Consistency** (0-100): Based on the interview structure and scoring, rate consistency (use 70 as baseline)
4. **Bias Score** (0-100): 0 = no bias detected, higher = more concerning patterns. Look for:
   - Leading questions
   - Unfair assumptions
   - Inconsistent treatment
5. **Candidate Experience** (0-100): Rate rapport, pace, clarity, and fairness
6. **Overall Score** (0-100): Weighted average considering all factors

Also provide:
- Detailed breakdowns for question quality and topic coverage
- Any bias indicators detected
- 2-4 specific improvement suggestions
- One-line summary

Return your analysis as valid JSON matching this schema exactly:
{{
    "question_quality_score": <int 0-100>,
    "topic_coverage_score": <int 0-100>,
    "consistency_score": <int 0-100>,
    "bias_score": <int 0-100>,
    "candidate_experience_score": <int 0-100>,
    "overall_score": <int 0-100>,
    "question_quality_breakdown": {{
        "relevance": <int 0-100>,
        "depth": <int 0-100>,
        "follow_up_quality": <int 0-100>
    }},
    "topics_covered": {{
        "technical": <int 0-100>,
        "behavioral": <int 0-100>,
        "culture_fit": <int 0-100>,
        "problem_solving": <int 0-100>
    }},
    "bias_indicators": {{
        "flags": [<list of specific concerns or empty>],
        "severity": "none" | "low" | "medium" | "high",
        "sentiment_balance": <int 0-100, 50 = balanced>
    }},
    "improvement_suggestions": [<2-4 specific suggestions>],
    "summary": "<one-line performance summary>"
}}
"""


class InterviewerAnalyzer:
    """Analyzes interviewer performance using LLM with structured output."""

    def __init__(self, client: Optional[AsyncOpenAI] = None):
        self.client = client or AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1"
        )
        self.model = "google/gemini-2.0-flash-001"

    async def analyze_interview(
        self,
        transcript: str,
        questions: list[str]
    ) -> InterviewerAnalyticsResult:
        """
        Analyze an interview and return structured analytics.
        
        Args:
            transcript: Full interview transcript
            questions: List of questions asked by interviewer
            
        Returns:
            InterviewerAnalyticsResult with all scores and breakdowns
        """
        
        # Format questions
        questions_text = "\n".join([f"- {q}" for q in questions]) if questions else "No specific questions extracted."
        
        # Truncate transcript if too long
        max_chars = 15000
        if len(transcript) > max_chars:
            transcript = transcript[:max_chars] + "\n... [truncated]"
        
        prompt = ANALYSIS_PROMPT.format(
            transcript=transcript,
            questions=questions_text
        )
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert interview analyst. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content
            
            # Parse JSON from response
            # Try to extract JSON if wrapped in markdown
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            data = json.loads(content.strip())
            
            # Validate with Pydantic
            result = InterviewerAnalyticsResult(**data)
            
            logger.info(f"Successfully analyzed interview. Overall score: {result.overall_score}")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            return self._get_default_result("Failed to parse analysis")
        except Exception as e:
            logger.error(f"Interview analysis failed: {e}")
            return self._get_default_result(str(e))

    def _get_default_result(self, error_msg: str) -> InterviewerAnalyticsResult:
        """Return default result when analysis fails."""
        from models.interviewer_analytics import QuestionQualityBreakdown, TopicCoverage, BiasIndicators
        
        return InterviewerAnalyticsResult(
            question_quality_score=50,
            topic_coverage_score=50,
            consistency_score=50,
            bias_score=0,
            candidate_experience_score=50,
            overall_score=50,
            question_quality_breakdown=QuestionQualityBreakdown(
                relevance=50, depth=50, follow_up_quality=50
            ),
            topics_covered=TopicCoverage(
                technical=50, behavioral=50, culture_fit=50, problem_solving=50
            ),
            bias_indicators=BiasIndicators(
                flags=[f"Analysis failed: {error_msg}"],
                severity="none",
                sentiment_balance=50
            ),
            improvement_suggestions=["Unable to generate suggestions - analysis failed"],
            summary="Analysis incomplete"
        )


# Singleton instance
_analyzer: InterviewerAnalyzer | None = None


def get_interviewer_analyzer() -> InterviewerAnalyzer:
    """Get singleton analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = InterviewerAnalyzer()
    return _analyzer
