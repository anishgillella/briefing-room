"""
Coaching Summary Generator service.
Generates actionable offer scripts and summaries from coaching session transcripts.
Uses LLM via OpenRouter for generation.
"""
import httpx
import json
import logging
from typing import Dict, Any, List, Optional

from config import OPENROUTER_API_KEY, LLM_MODEL
from models.coaching_summary import (
    CoachingSummary,
    OfferScript,
    ObjectionResponse
)

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class CoachingSummaryGenerator:
    """Generate structured summaries from coaching transcripts."""

    def __init__(self):
        self.api_key = OPENROUTER_API_KEY
        self.model = LLM_MODEL
        self.timeout = 60.0

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers for OpenRouter."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://briefingroom.ai",
            "X-Title": "Briefing Room Coaching Summary",
        }

    async def generate(
        self,
        candidate_id: str,
        candidate_name: str,
        transcript_turns: List[Dict],
        session_duration_seconds: Optional[int] = None,
        offer_base: Optional[int] = None,
        offer_equity: Optional[float] = None
    ) -> CoachingSummary:
        """
        Generate a coaching summary from the session transcript.

        Args:
            candidate_id: Candidate ID
            candidate_name: Candidate's name
            transcript_turns: List of {role: str, text: str} turns
            session_duration_seconds: Duration of coaching session
            offer_base: Base salary being offered
            offer_equity: Equity percentage being offered

        Returns:
            Structured CoachingSummary
        """
        if not self.api_key:
            logger.warning("OpenRouter API key not configured")
            return self._fallback_summary(
                candidate_id, candidate_name, transcript_turns, session_duration_seconds
            )

        # Build transcript text
        transcript_text = self._format_transcript(transcript_turns)

        # Build context for the prompt
        offer_context = ""
        if offer_base:
            offer_context += f"Base salary offer: ${offer_base:,}. "
        if offer_equity:
            offer_context += f"Equity offer: {offer_equity}%. "

        prompt = self._build_generation_prompt(
            candidate_name=candidate_name,
            transcript_text=transcript_text,
            offer_context=offer_context
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    OPENROUTER_URL,
                    headers=self._get_headers(),
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.4,
                    }
                )
                response.raise_for_status()
                result = response.json()

            # Parse the response
            content = result["choices"][0]["message"]["content"]
            data = json.loads(content)

            # Build and return CoachingSummary
            return self._build_summary(
                data=data,
                candidate_id=candidate_id,
                candidate_name=candidate_name,
                transcript_turns=transcript_turns,
                transcript_text=transcript_text,
                session_duration_seconds=session_duration_seconds
            )

        except httpx.TimeoutException:
            logger.error("Timeout generating coaching summary")
            return self._fallback_summary(
                candidate_id, candidate_name, transcript_turns, session_duration_seconds
            )

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in summary generation: {e}")
            return self._fallback_summary(
                candidate_id, candidate_name, transcript_turns, session_duration_seconds
            )

        except Exception as e:
            logger.error(f"Error generating coaching summary: {e}")
            return self._fallback_summary(
                candidate_id, candidate_name, transcript_turns, session_duration_seconds
            )

    def _format_transcript(self, turns: List[Dict]) -> str:
        """Format transcript turns into readable text."""
        lines = []
        for turn in turns:
            role = "Coach" if turn.get("role") == "agent" else "You"
            text = turn.get("text", "")
            lines.append(f"{role}: {text}")
        return "\n\n".join(lines)

    def _build_generation_prompt(
        self,
        candidate_name: str,
        transcript_text: str,
        offer_context: str
    ) -> str:
        """Build the prompt for summary generation."""
        return f"""
You are analyzing a coaching session transcript to generate an actionable offer preparation summary.

The coaching session was about preparing to make an offer to: {candidate_name}
{offer_context}

COACHING SESSION TRANSCRIPT:
{transcript_text}

Based on this coaching session, generate a structured summary that the employer can use when making the offer call.

Return a JSON object with this exact structure:
{{
    "offer_script": {{
        "opening": "How to open the offer conversation (2-3 sentences, personalized to the candidate)",
        "equity_explanation": "How to explain the equity package clearly (2-3 sentences)",
        "competitor_handling": "How to address any competing offers mentioned (1-2 sentences, or null if none)",
        "closing": "How to close the conversation positively (1-2 sentences)"
    }},
    "key_reminders": [
        "Most important thing to remember #1",
        "Most important thing to remember #2",
        "Most important thing to remember #3"
    ],
    "objection_responses": [
        {{
            "objection": "What the candidate might say",
            "response": "Suggested response",
            "notes": "Any context from the coaching session"
        }}
    ],
    "lead_with": "What to emphasize first based on candidate priorities",
    "avoid": ["Thing to avoid saying #1", "Thing to avoid saying #2"],
    "competitor_strategy": "Strategy for handling competitor offers if any were mentioned",
    "negotiation_boundaries": "Summary of how much room there is to negotiate"
}}

Important:
- Make the script conversational and natural, not robotic
- Reference specific things from the coaching session
- Keep reminders actionable and specific
- Include 2-4 objection responses based on what was discussed
- Be concise - this will be used as a quick reference
"""

    def _build_summary(
        self,
        data: Dict[str, Any],
        candidate_id: str,
        candidate_name: str,
        transcript_turns: List[Dict],
        transcript_text: str,
        session_duration_seconds: Optional[int]
    ) -> CoachingSummary:
        """Build CoachingSummary from extracted data."""

        # Parse offer script
        offer_script_data = data.get("offer_script", {})
        offer_script = None
        if offer_script_data:
            offer_script = OfferScript(
                opening=offer_script_data.get("opening", ""),
                equity_explanation=offer_script_data.get("equity_explanation", ""),
                competitor_handling=offer_script_data.get("competitor_handling"),
                closing=offer_script_data.get("closing", "")
            )

        # Parse objection responses
        objection_responses = []
        for obj in data.get("objection_responses", []):
            if isinstance(obj, dict):
                objection_responses.append(ObjectionResponse(
                    objection=obj.get("objection", ""),
                    response=obj.get("response", ""),
                    notes=obj.get("notes")
                ))

        return CoachingSummary(
            candidate_id=candidate_id,
            candidate_name=candidate_name,
            session_duration_seconds=session_duration_seconds,
            offer_script=offer_script,
            key_reminders=data.get("key_reminders", []),
            objection_responses=objection_responses,
            lead_with=data.get("lead_with"),
            avoid=data.get("avoid", []),
            competitor_strategy=data.get("competitor_strategy"),
            negotiation_boundaries=data.get("negotiation_boundaries"),
            coaching_transcript=transcript_text,
            transcript_turns=transcript_turns
        )

    def _fallback_summary(
        self,
        candidate_id: str,
        candidate_name: str,
        transcript_turns: List[Dict],
        session_duration_seconds: Optional[int]
    ) -> CoachingSummary:
        """Return a basic summary when generation fails."""
        return CoachingSummary(
            candidate_id=candidate_id,
            candidate_name=candidate_name,
            session_duration_seconds=session_duration_seconds,
            key_reminders=[
                "Review the coaching transcript for specific advice",
                "Lead with what matters most to the candidate",
                "Be prepared for negotiation questions"
            ],
            coaching_transcript=self._format_transcript(transcript_turns),
            transcript_turns=transcript_turns
        )


# Global instance
coaching_summary_generator = CoachingSummaryGenerator()
