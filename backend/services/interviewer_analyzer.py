"""
Interviewer Analytics Analyzer.
Uses a single LLM call with Pydantic structured output to analyze interview quality.
"""
import json
import logging
import os
from typing import Optional
from openai import AsyncOpenAI
from models.interviewer_analytics import InterviewerAnalyticsResult

logger = logging.getLogger(__name__)

# Get API key and model from config
from config import OPENROUTER_API_KEY, LLM_MODEL


ANALYSIS_PROMPT = """You are a world-class interview analyst with deep expertise in hiring best practices, behavioral psychology, and organizational development. Analyze this interview transcript with the precision of a forensic examiner.

## Interview Transcript:
{transcript}

## Questions Asked by Interviewer:
{questions}

## Your Mission:
Provide an exhaustive analysis of the interviewer's performance. Be specific, cite examples from the transcript, and deliver actionable insights.

### CORE METRICS (0-100 scale, be precise):

1. **Question Quality Score**: Evaluate relevance to role, depth of probing, quality of follow-ups, ratio of open vs closed questions, clarity of phrasing

2. **Topic Coverage Score**: How comprehensively did they cover:
   - Technical competencies for the role
   - Behavioral/situational scenarios
   - Culture fit and values alignment
   - Problem-solving and critical thinking

3. **Consistency Score**: Structure, pacing, professional demeanor, fair treatment

4. **Bias Score** (0 = no bias, higher = more concerning): Look for leading questions, assumptions, stereotyping, unequal treatment, confirmation bias

5. **Candidate Experience Score**: Rapport building, making candidate comfortable, clear communication, appropriate pace, respectful interaction

6. **Overall Score**: Weighted composite reflecting interviewer effectiveness

### INTERVIEW DYNAMICS ANALYSIS:
- **Time Management**: Did they allocate time appropriately across topics?
- **Active Listening**: Did they build on candidate responses or stick to script?
- **Rapport Building**: How well did they create a comfortable environment?
- **Interruptions**: Count any instances of cutting off the candidate
- **Response Time**: Did they give adequate thinking time (rushed/appropriate/too_long)?

### QUESTION-BY-QUESTION EFFECTIVENESS:
For each major question, evaluate:
- How effective was it at eliciting useful information?
- What information did it reveal (high/medium/low/none)?
- Could it have been asked better?

### MISSED OPPORTUNITIES:
Identify 2-3 moments where the candidate said something that warranted deeper probing but the interviewer moved on. What follow-up questions should have been asked?

### COVERAGE GAPS:
What critical topics for this role were NOT adequately explored?

### INTERVIEWER STRENGTHS:
What did this interviewer do particularly well? (3-5 specific strengths with examples)

### DETAILED ASSESSMENT:
Write a 2-3 paragraph narrative assessment of the interviewer's performance, as if writing a formal performance review.

Return your analysis as valid JSON with this structure:
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
        "follow_up_quality": <int 0-100>,
        "open_ended_ratio": <int 0-100>,
        "clarity": <int 0-100>
    }},
    "topics_covered": {{
        "technical": <int 0-100>,
        "behavioral": <int 0-100>,
        "culture_fit": <int 0-100>,
        "problem_solving": <int 0-100>
    }},
    "bias_indicators": {{
        "flags": [<list of specific concerns with quotes from transcript, or empty>],
        "severity": "none" | "low" | "medium" | "high",
        "sentiment_balance": <int 0-100, 50 = balanced>
    }},
    "interview_dynamics": {{
        "time_management": <int 0-100>,
        "active_listening_score": <int 0-100>,
        "rapport_building": <int 0-100>,
        "interruption_count": <int>,
        "avg_response_wait_time": "rushed" | "appropriate" | "too_long"
    }},
    "question_effectiveness": [
        {{
            "question": "<the question asked>",
            "effectiveness_score": <int 0-100>,
            "information_elicited": "high" | "medium" | "low" | "none",
            "better_alternative": "<suggested improvement or null>"
        }}
    ],
    "missed_opportunities": [
        {{
            "topic": "<topic that needed deeper probing>",
            "candidate_statement": "<what they said that warranted follow-up>",
            "suggested_followup": "<question that should have been asked>"
        }}
    ],
    "coverage_gaps": ["<critical topic 1 not covered>", "<critical topic 2>"],
    "interviewer_strengths": ["<strength 1 with example>", "<strength 2>", "<strength 3>"],
    "improvement_suggestions": ["<specific actionable suggestion 1>", "<suggestion 2>", "<suggestion 3>", "<suggestion 4>", "<suggestion 5>"],
    "summary": "<one compelling sentence summarizing performance>",
    "detailed_assessment": "<2-3 paragraph narrative assessment>"
}}
"""


class InterviewerAnalyzer:
    """Analyzes interviewer performance using LLM with structured output."""

    def __init__(self, client: Optional[AsyncOpenAI] = None):
        self.client = client or AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY
        )
        self.model = LLM_MODEL

    async def analyze_interview(
        self,
        transcript: str,
        questions: list[str],
        interviewer_id: Optional[str] = None
    ) -> InterviewerAnalyticsResult:
        """
        Analyze an interview and return structured analytics.

        Args:
            transcript: Full interview transcript
            questions: List of questions asked by interviewer
            interviewer_id: Optional ID of the interviewer (for tracking)

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
                    {"role": "system", "content": "You are a world-class interview analyst. Return only valid JSON with comprehensive analysis."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=6000
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
        from models.interviewer_analytics import (
            QuestionQualityBreakdown, TopicCoverage, BiasIndicators, InterviewDynamics
        )

        return InterviewerAnalyticsResult(
            question_quality_score=50,
            topic_coverage_score=50,
            consistency_score=50,
            bias_score=0,
            candidate_experience_score=50,
            overall_score=50,
            question_quality_breakdown=QuestionQualityBreakdown(
                relevance=50, depth=50, follow_up_quality=50, open_ended_ratio=50, clarity=50
            ),
            topics_covered=TopicCoverage(
                technical=50, behavioral=50, culture_fit=50, problem_solving=50
            ),
            bias_indicators=BiasIndicators(
                flags=[f"Analysis failed: {error_msg}"],
                severity="none",
                sentiment_balance=50
            ),
            interview_dynamics=InterviewDynamics(
                time_management=50, active_listening_score=50, rapport_building=50,
                interruption_count=0, avg_response_wait_time="appropriate"
            ),
            missed_opportunities=[],
            question_effectiveness=[],
            coverage_gaps=[],
            interviewer_strengths=[],
            improvement_suggestions=["Unable to generate suggestions - analysis failed"],
            summary="Analysis incomplete",
            detailed_assessment=None
        )


# Singleton instance
_analyzer: InterviewerAnalyzer | None = None


def get_interviewer_analyzer() -> InterviewerAnalyzer:
    """Get singleton analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = InterviewerAnalyzer()
    return _analyzer
