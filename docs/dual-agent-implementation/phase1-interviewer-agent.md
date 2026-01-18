# Phase 1: Interviewer Agent

## Goal

Create `interviewer_agent.py` - an AI agent that plays the role of an interviewer, asking questions to the human candidate.

## File Location

```
backend/
├── interview_agent.py      # Existing - AI as Candidate
├── interviewer_agent.py    # NEW - AI as Interviewer
└── config.py
```

## Implementation

### Step 1: Create Base File

Create `backend/interviewer_agent.py`:

```python
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

# Session State
current_room: Optional[rtc.Room] = None
transcript_history: list = []
transcript_hashes: set = set()
questions_asked: int = 0
MAX_QUESTIONS = 6  # Configurable interview length


async def broadcast_transcript(speaker: str, text: str, room):
    """Broadcast transcript to all participants via data channel."""
    global transcript_hashes

    if not room or not room.local_participant:
        return

    text_normalized = text.strip().lower()
    entry_hash = hash(f"{speaker}:{text_normalized}")

    if entry_hash in transcript_hashes:
        return

    transcript_hashes.add(entry_hash)

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

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    participant = await ctx.wait_for_participant()
    logger.info(f"Candidate joined: {participant.identity}")

    # Get interview context from room metadata
    room_metadata = json.loads(ctx.room.metadata or "{}")

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

    logger.info(f"Interviewing: {candidate_name} for {job_title}")

    # Build interviewer persona prompt
    skills_str = ", ".join(required_skills) if required_skills else "relevant skills"

    system_prompt = f"""You are Alex, a professional interviewer conducting an interview for the {job_title} position at {company_name}.

YOUR ROLE:
You are the INTERVIEWER. You ASK questions. The human is the CANDIDATE who answers.

JOB CONTEXT:
Title: {job_title}
Required Skills: {skills_str}
Description: {job_description[:1000] if job_description else 'Standard role requirements'}

INTERVIEW STRUCTURE (aim for {MAX_QUESTIONS} questions total):
1. Opening (1 question): Warm greeting, ask them to introduce themselves
2. Experience (2 questions): Role-specific questions about their background
3. Behavioral (2 questions): STAR-format situational questions
4. Closing (1 question): Ask if they have questions for you

INTERVIEWER GUIDELINES:
1. Be warm, professional, and encouraging
2. Listen actively - acknowledge their answers before moving on
3. Ask ONE question at a time - never multiple questions in one turn
4. Keep questions concise (1-2 sentences max)
5. Use natural transitions ("Great, thanks for sharing that. Let me ask you about...")
6. For behavioral questions, prompt for specifics if they give vague answers
7. Track which topics you've covered - don't repeat questions
8. After {MAX_QUESTIONS} questions, move to closing

QUESTION BANK (adapt based on job):

Opening:
- "Thanks for joining! To start, could you tell me a bit about yourself and what drew you to this role?"

Experience (pick 2 relevant to {job_title}):
- "Walk me through your experience with [relevant skill]."
- "What's been your most impactful project in the past couple years?"
- "How have you handled [specific job requirement] in previous roles?"
- "Tell me about your experience working with [technology/methodology from JD]."

Behavioral (pick 2):
- "Tell me about a time you faced a significant challenge at work. How did you handle it?"
- "Describe a situation where you had to work with a difficult team member."
- "Give me an example of when you had to learn something quickly to complete a project."
- "Tell me about a time you disagreed with a decision. What did you do?"
- "Describe your most successful collaboration experience."

Closing:
- "Those are all my questions. Is there anything you'd like to ask me about the role or {company_name}?"

RESPONSE TO CANDIDATE QUESTIONS:
If they ask about the role, give brief, positive answers about culture, growth opportunities, team dynamics.
After answering their questions: "Thanks for those great questions. It was really nice speaking with you today. We'll be in touch soon about next steps!"

DO NOT:
- Ask the candidate to interview you
- Give lengthy monologues
- Ask multiple questions at once
- Repeat the same question
- Break character as an AI

START by greeting them warmly and asking them to introduce themselves.
"""

    # Initialize LLM
    llm_instance = openai.LLM(
        model=LLM_MODEL,
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
    )

    # Initialize TTS - Deepgram Aura
    if DEEPGRAM_API_KEY:
        tts_instance = deepgram.TTS(
            api_key=DEEPGRAM_API_KEY,
            model="aura-orion-en",  # Male voice for interviewer
        )
    else:
        tts_instance = openai.TTS(
            base_url=OPENROUTER_BASE_URL,
            api_key=OPENROUTER_API_KEY,
        )

    # Initialize STT
    stt_instance = deepgram.STT(api_key=DEEPGRAM_API_KEY)

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
                text = getattr(item, "content", "")

                if role == "user":
                    speaker = "candidate"
                elif role == "assistant":
                    speaker = "interviewer"
                else:
                    return

                if text:
                    await broadcast_transcript(speaker, text, ctx.room)
            except Exception as e:
                logger.warning(f"Failed to process conversation item: {e}")

        asyncio.create_task(_process(event))

    await session.start(agent, room=ctx.room)

    logger.info(f"Interviewer Agent ready - interviewing {candidate_name}")

    # Opening greeting
    first_name = candidate_name.split()[0] if candidate_name else "there"
    greeting = f"Hi {first_name}, thanks for joining today! I'm Alex, and I'll be conducting your interview for the {job_title} position. Before we dive in, could you tell me a bit about yourself and what drew you to this role?"

    await session.say(greeting)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        ),
    )
```

### Step 2: Test in Isolation

```bash
# Terminal 1: Run the agent
cd backend
python interviewer_agent.py dev

# Terminal 2: Create a test room via API or LiveKit CLI
# The agent should connect and start interviewing
```

### Step 3: Verify Behavior

Checklist:
- [ ] Agent connects to room successfully
- [ ] Agent greets candidate and asks first question
- [ ] Agent listens to responses and asks follow-up questions
- [ ] Agent transitions between question types naturally
- [ ] Transcript is broadcast correctly
- [ ] Agent closes interview appropriately after ~6 questions

## Key Differences from interview_agent.py

| Aspect | interview_agent.py | interviewer_agent.py |
|--------|-------------------|---------------------|
| AI Role | Candidate (answers) | Interviewer (asks) |
| Human Role | Interviewer | Candidate |
| Opening | "Hi, I'm [name], excited to be here" | "Hi, I'm Alex, tell me about yourself" |
| Flow | Reactive (waits for questions) | Proactive (drives conversation) |
| Voice | aura-asteria-en (female) | aura-orion-en (male) |
| Copilot | Sends suggestions to interviewer | Optional: sends feedback to candidate |

## Optional Enhancements

### Real-time Candidate Feedback

Add a function tool to provide coaching hints:

```python
@function_tool(description="Send feedback to the candidate about their answer quality")
async def send_candidate_feedback(
    feedback: str,
    feedback_type: str = "tip",  # tip, strength, improvement
) -> str:
    """Send coaching feedback to candidate's panel."""
    # Similar to send_ai_suggestion in interview_agent.py
    # but tailored for candidate coaching
    pass
```

### Difficulty Levels

Add metadata for interview difficulty:

```python
difficulty = room_metadata.get("difficulty", "standard")  # easy, standard, hard

if difficulty == "easy":
    # More encouraging, simpler questions
    pass
elif difficulty == "hard":
    # More probing, technical deep-dives
    pass
```

## Next Phase

Once the agent works in isolation, proceed to [Phase 2: Backend Integration](./phase2-backend-integration.md) to connect it to the interview start flow.
