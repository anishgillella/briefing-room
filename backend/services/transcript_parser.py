"""
Smart Transcript Parser using Gemini 2.5 Flash via OpenRouter.
Intelligently parses raw transcript text into structured conversation turns.
"""

import json
import logging
from typing import Optional
from openai import AsyncOpenAI
from pydantic import BaseModel
from config import OPENROUTER_API_KEY, LLM_MODEL

logger = logging.getLogger(__name__)


class ParsedTurn(BaseModel):
    """A single parsed conversation turn."""
    speaker: str  # "interviewer" or "candidate"
    speaker_name: Optional[str] = None  # Original name from transcript if available
    text: str
    is_question: bool = False  # Whether this turn contains a question
    cleaned_text: Optional[str] = None  # Cleaned/normalized version


class ParsedTranscript(BaseModel):
    """Result of smart transcript parsing."""
    turns: list[ParsedTurn]
    interviewer_name: Optional[str] = None  # Detected interviewer name
    candidate_name: Optional[str] = None  # Detected candidate name
    total_turns: int
    interviewer_turns: int
    candidate_turns: int
    questions_count: int
    parsing_notes: Optional[str] = None  # Any notes about parsing issues


PARSE_SYSTEM_PROMPT = """You are an expert transcript parser. Your task is to take raw interview transcript text and convert it into a clean, structured conversation format.

You must:
1. Identify who is speaking in each turn (interviewer vs candidate)
2. Clean up transcription artifacts (filler words like "um", "uh" can be kept for authenticity but fix obvious transcription errors)
3. Properly segment the conversation into logical turns
4. Identify which turns contain questions from the interviewer
5. Detect the names of the interviewer and candidate if mentioned

Handle various transcript formats:
- Speaker labels like "John:", "Interviewer:", "Candidate:", etc.
- Timestamp formats like "[00:01:23]" or "00:01:23"
- Zoom/Otter.ai/Google Meet export formats
- Plain text with paragraph breaks between speakers
- Mixed formats

When uncertain about speaker identity:
- Questions and prompts are typically from the interviewer
- Long explanations and stories are typically from the candidate
- Use context clues from the conversation flow
"""

PARSE_USER_PROMPT = """Parse this interview transcript into structured turns:

## Raw Transcript:
{transcript}

{context}

Respond with a JSON object matching this exact structure:
{{
  "turns": [
    {{
      "speaker": "interviewer" or "candidate",
      "speaker_name": "Original name if detected, or null",
      "text": "The spoken text for this turn",
      "is_question": true/false,
      "cleaned_text": "Cleaned version with typos fixed, or null if no cleaning needed"
    }}
  ],
  "interviewer_name": "Name if detected, or null",
  "candidate_name": "Name if detected, or null",
  "parsing_notes": "Any notes about ambiguous parts or issues, or null"
}}

Rules:
- Each turn should be a logical unit of speech from one person
- Don't over-segment - combine related sentences from the same speaker
- Keep the conversation flow natural
- If a speaker asks multiple questions in one turn, keep them together
- Mark is_question=true only for interviewer turns that ask questions

Return ONLY valid JSON, no markdown code blocks."""


class TranscriptParser:
    """Smart transcript parser using LLM."""

    def __init__(self):
        if not OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not configured")

        self.client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )
        # Use Gemini 2.5 Flash for fast parsing
        self.model = LLM_MODEL.replace("2.0", "2.5") if "gemini" in LLM_MODEL.lower() else LLM_MODEL

    async def parse_transcript(
        self,
        raw_transcript: str,
        candidate_name: Optional[str] = None,
        interviewer_name: Optional[str] = None,
    ) -> ParsedTranscript:
        """
        Parse raw transcript text into structured conversation turns.

        Args:
            raw_transcript: The raw transcript text to parse
            candidate_name: Known candidate name (helps with identification)
            interviewer_name: Known interviewer name (helps with identification)

        Returns:
            ParsedTranscript with structured turns
        """
        # Build context hints
        context_parts = []
        if candidate_name:
            context_parts.append(f"The candidate's name is: {candidate_name}")
        if interviewer_name:
            context_parts.append(f"The interviewer's name is: {interviewer_name}")
        context = "\n".join(context_parts) if context_parts else ""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": PARSE_SYSTEM_PROMPT},
                    {"role": "user", "content": PARSE_USER_PROMPT.format(
                        transcript=raw_transcript,
                        context=f"## Context:\n{context}" if context else ""
                    )}
                ],
                temperature=0.2,  # Low temperature for consistent parsing
                max_tokens=8000,  # Allow for long transcripts
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content

            # Handle markdown-wrapped JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            data = json.loads(content.strip())

            # Convert to ParsedTurn objects
            turns = []
            for turn_data in data.get("turns", []):
                turns.append(ParsedTurn(
                    speaker=turn_data.get("speaker", "unknown"),
                    speaker_name=turn_data.get("speaker_name"),
                    text=turn_data.get("text", ""),
                    is_question=turn_data.get("is_question", False),
                    cleaned_text=turn_data.get("cleaned_text")
                ))

            # Calculate counts
            interviewer_turns = sum(1 for t in turns if t.speaker == "interviewer")
            candidate_turns = sum(1 for t in turns if t.speaker == "candidate")
            questions_count = sum(1 for t in turns if t.is_question)

            return ParsedTranscript(
                turns=turns,
                interviewer_name=data.get("interviewer_name") or interviewer_name,
                candidate_name=data.get("candidate_name") or candidate_name,
                total_turns=len(turns),
                interviewer_turns=interviewer_turns,
                candidate_turns=candidate_turns,
                questions_count=questions_count,
                parsing_notes=data.get("parsing_notes")
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            raise ValueError(f"Failed to parse transcript: Invalid JSON response")
        except Exception as e:
            logger.error(f"Error parsing transcript: {e}")
            raise ValueError(f"Failed to parse transcript: {str(e)}")


# Singleton instance
_parser_instance: Optional[TranscriptParser] = None


def get_transcript_parser() -> TranscriptParser:
    """Get or create the transcript parser singleton."""
    global _parser_instance
    if _parser_instance is None:
        _parser_instance = TranscriptParser()
    return _parser_instance
