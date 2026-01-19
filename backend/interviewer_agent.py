"""
LiveKit Interviewer Agent for Manila.
This agent plays the role of an INTERVIEWER conducting an interview.
The human user is the CANDIDATE being interviewed.

This is the opposite of interview_agent.py - here the AI asks questions
and evaluates the human's responses.

To run:
    python interviewer_agent.py dev
"""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Optional
from datetime import datetime

# Load .env from parent directory
from dotenv import load_dotenv
load_dotenv()
parent_env = Path(__file__).parent.parent / ".env"
if parent_env.exists():
    load_dotenv(parent_env)

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    Agent,
    AgentSession,
)
from livekit.plugins import deepgram, openai, silero
from config import LLM_MODEL

# Environment variables
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

logger = logging.getLogger("interviewer-agent")
logger.setLevel(logging.INFO)

# ============================================================================
# Session State
# ============================================================================

current_room: Optional[rtc.Room] = None
transcript_history: list = []
transcript_hashes: set = set()
questions_asked: int = 0
MAX_QUESTIONS = 6  # Configurable interview length


# ============================================================================
# Helpers
# ============================================================================

async def broadcast_transcript(speaker: str, text: str, room):
    """Broadcast transcript to all participants via data channel."""
    global transcript_hashes

    if not room or not room.local_participant:
        return

    # Robust deduplication using hash of speaker + normalized text
    text_normalized = text.strip().lower()
    entry_hash = hash(f"{speaker}:{text_normalized}")

    if entry_hash in transcript_hashes:
        logger.debug(f"Skipping duplicate transcript: {speaker}: {text[:30]}...")
        return

    transcript_hashes.add(entry_hash)

    # Keep hash set from growing unbounded
    if len(transcript_hashes) > 100:
        transcript_hashes = set(list(transcript_hashes)[-50:])

    entry = {
        "speaker": speaker,
        "text": text,
        "timestamp": datetime.now().isoformat()
    }

    transcript_history.append(entry)
    logger.info(f"Transcript - {speaker}: {text[:50]}...")

    try:
        message = json.dumps({
            "type": "TRANSCRIPT_UPDATE",
            "entry": entry,
            "full_transcript": transcript_history
        })

        participants = room.remote_participants
        destination_identities = [p.identity for p in participants.values()]

        if destination_identities:
            await room.local_participant.publish_data(
                message.encode(),
                reliable=True,
                destination_identities=destination_identities
            )
    except Exception as e:
        logger.error(f"Failed to broadcast transcript: {e}")


# ============================================================================
# Agent Entry Point
# ============================================================================

def prewarm(proc: JobProcess):
    """Prewarm function - loads VAD model before job starts."""
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    """Main entry point for the interviewer agent."""
    global current_room, transcript_history, transcript_hashes, questions_asked

    logger.info(f"Interviewer Agent starting for room: {ctx.room.name}")

    current_room = ctx.room
    transcript_history = []
    transcript_hashes = set()
    questions_asked = 0

    # Connect to room
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Wait for candidate to join
    participant = await ctx.wait_for_participant()
    logger.info(f"Candidate joined: {participant.identity}")

    # Get interview context from room metadata
    logger.info(f"Room metadata: {ctx.room.metadata}")
    room_metadata = json.loads(ctx.room.metadata or "{}")

    # Also check participant metadata as fallback
    if not room_metadata and participant.metadata:
        try:
            room_metadata = json.loads(participant.metadata)
        except:
            pass

    candidate_name = room_metadata.get("candidate_name", "there")
    job_title = room_metadata.get("job_title", "this position")
    job_description = room_metadata.get("job_description", "")
    required_skills = room_metadata.get("skills", [])
    company_name = room_metadata.get("company_name", "our company")
    resume_context = room_metadata.get("resume_context", "")

    logger.info(f"Interviewing: {candidate_name} for {job_title}")

    # Build interviewer persona prompt
    skills_str = ", ".join(required_skills) if required_skills else "relevant skills"

    system_prompt = f"""You are Alex, a friendly and professional interviewer conducting an interview for the {job_title} position at {company_name}.

YOUR ROLE:
You are the INTERVIEWER. You ASK questions. The human is the CANDIDATE who answers.
Your job is to have a natural conversation that helps assess the candidate's fit for the role.

JOB CONTEXT:
Title: {job_title}
Required Skills: {skills_str}
Description: {job_description[:1500] if job_description else 'Standard role requirements apply.'}

CANDIDATE CONTEXT (if available):
{resume_context[:1000] if resume_context else 'No resume provided - ask about their background.'}

INTERVIEW STRUCTURE (aim for {MAX_QUESTIONS} main questions):
1. Opening (1 question): Warm greeting, ask them to tell you about themselves
2. Experience (2 questions): Role-specific questions about their background
3. Behavioral (2 questions): Situational questions using STAR format prompts
4. Closing (1 question): Ask if they have any questions for you

INTERVIEWER GUIDELINES:
1. Be warm, professional, and encouraging - put the candidate at ease
2. Listen actively - acknowledge their answers naturally before moving on
3. Ask ONE question at a time - never stack multiple questions
4. Keep your questions concise (1-2 sentences max)
5. Use natural transitions like "Great, thanks for sharing that..." or "That's interesting..."
6. If they give a vague answer, ask a brief follow-up to get specifics
7. Don't repeat questions or topics you've already covered
8. Keep track of the conversation flow - after about {MAX_QUESTIONS} questions, wrap up

QUESTION EXAMPLES (adapt based on job and candidate):

Opening:
- "Thanks for joining today! To kick things off, could you tell me a bit about yourself and what interests you about this role?"

Experience (pick relevant ones):
- "I see you have experience with [skill from JD]. Can you walk me through a project where you used that?"
- "What's been your most impactful project in the past year or two?"
- "How have you approached [specific requirement from JD] in your previous roles?"
- "Tell me about your experience with [technology/methodology from job description]."

Behavioral (pick 2):
- "Tell me about a time you faced a significant challenge at work. How did you handle it?"
- "Can you describe a situation where you had to work with someone difficult? What was your approach?"
- "Give me an example of when you had to learn something new quickly. How did you go about it?"
- "Tell me about a time you disagreed with a decision at work. What did you do?"
- "Describe a project where you had to collaborate closely with others. What made it successful?"

Closing:
- "Those are all the questions I had. Do you have any questions for me about the role or the team?"

RESPONDING TO CANDIDATE QUESTIONS:
If they ask about the role or company, give brief, positive responses about:
- Team culture and collaboration
- Growth opportunities
- The interesting challenges of the role
Keep answers to 2-3 sentences, then ask if they have other questions.

ENDING THE INTERVIEW:
After they've asked their questions (or said they don't have any):
"Thanks so much for taking the time to chat with me today. It was great learning about your experience. We'll be in touch soon about next steps. Take care!"

DO NOT:
- Ask the candidate to interview you
- Give long monologues or lectures
- Ask multiple questions at once
- Repeat the same question twice
- Break character or mention that you're an AI
- Be overly formal or stiff - be conversational

START by greeting them warmly and asking them to introduce themselves.
"""

    # Initialize LLM with OpenRouter
    llm_instance = openai.LLM(
        model=LLM_MODEL,
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
    )

    # Initialize TTS - Deepgram Aura with male voice for interviewer
    if DEEPGRAM_API_KEY:
        tts_instance = deepgram.TTS(
            api_key=DEEPGRAM_API_KEY,
            model="aura-orion-en",  # Male voice for interviewer (vs female for candidate)
        )
        logger.info("Using Deepgram Aura TTS (orion voice)")
    else:
        tts_instance = openai.TTS(
            base_url=OPENROUTER_BASE_URL,
            api_key=OPENROUTER_API_KEY,
        )
        logger.info("Using OpenAI TTS via OpenRouter")

    # Initialize STT
    if DEEPGRAM_API_KEY:
        stt_instance = deepgram.STT(api_key=DEEPGRAM_API_KEY)
    else:
        logger.error("DEEPGRAM_API_KEY not set - STT will not work!")
        stt_instance = deepgram.STT(api_key="missing")

    # Create Agent
    agent = Agent(
        instructions=system_prompt,
        vad=ctx.proc.userdata["vad"],
        stt=stt_instance,
        llm=llm_instance,
        tts=tts_instance,
    )

    # Create and start session
    session = AgentSession()

    @session.on("conversation_item_added")
    def on_item_added(event):
        """Capture transcript from conversation events."""
        async def _process(event):
            try:
                item = event.item
                role = getattr(item, "role", "unknown")
                raw_content = getattr(item, "content", "")

                # Handle content being a list of content objects (LiveKit SDK format)
                # Content can be: string, list of strings, list of objects with "text" field
                text = ""
                if isinstance(raw_content, str):
                    text = raw_content
                elif isinstance(raw_content, list):
                    # Extract text from list of content parts
                    text_parts = []
                    for part in raw_content:
                        if isinstance(part, str):
                            text_parts.append(part)
                        elif hasattr(part, "text"):
                            text_parts.append(part.text)
                        elif isinstance(part, dict) and "text" in part:
                            text_parts.append(part["text"])
                    text = " ".join(text_parts)
                elif hasattr(raw_content, "text"):
                    text = raw_content.text

                # In interviewer agent: assistant=interviewer, user=candidate
                if role == "user":
                    speaker = "candidate"
                elif role == "assistant":
                    speaker = "interviewer"
                else:
                    return

                if text and isinstance(text, str) and text.strip():
                    await broadcast_transcript(speaker, text, ctx.room)
            except Exception as e:
                logger.warning(f"Failed to process conversation item: {e}")

        asyncio.create_task(_process(event))

    await session.start(agent, room=ctx.room)

    logger.info(f"Interviewer Agent ready - interviewing {candidate_name} for {job_title}")

    # Opening greeting
    first_name = candidate_name.split()[0] if candidate_name and candidate_name != "there" else "there"
    greeting = f"Hi {first_name}, thanks for joining today! I'm Alex, and I'll be chatting with you about the {job_title} position. To kick things off, could you tell me a bit about yourself and what drew you to this role?"

    await session.say(greeting)


# ============================================================================
# CLI Entry
# ============================================================================

async def request_fnc(ctx):
    """
    Filter which rooms this agent should join.

    interviewer_agent.py handles rooms where the AI plays the INTERVIEWER.
    These rooms have the prefix "interviewer-interview-".
    """
    room_name = ctx.room.name
    # Only join rooms with "interviewer-interview-" prefix
    if room_name.startswith("interviewer-interview-"):
        logger.info(f"[interviewer_agent] Accepting room: {room_name}")
        await ctx.accept()
    else:
        logger.info(f"[interviewer_agent] Skipping room (not for AI interviewer): {room_name}")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            request_fnc=request_fnc,
        ),
    )
