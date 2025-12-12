"""
LiveKit Voice Agent for Pluto.
Implements real-time candidate profiling with function calling.
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    function_tool,
    Agent,
    AgentSession,
)
from livekit.plugins import deepgram, openai, silero, elevenlabs

from backend.config import (
    LIVEKIT_URL,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    DEEPGRAM_API_KEY,
    ELEVENLABS_API_KEY,
)

logger = logging.getLogger("voice-agent")
logger.setLevel(logging.INFO)

# ============================================================================
# In-Memory Candidate State
# ============================================================================

class CandidateSession:
    """Stores candidate data for a voice session."""
    
    def __init__(self, candidate_id: str, name: str, questions: list):
        self.candidate_id = candidate_id
        self.name = name
        self.questions = questions
        self.extracted_fields: Dict[str, Any] = {}
    
    def update_field(self, field_name: str, field_value: Any):
        self.extracted_fields[field_name] = field_value
        logger.info(f"Updated {field_name}: {field_value}")


# Global session storage
sessions: Dict[str, CandidateSession] = {}
current_session: Optional[CandidateSession] = None
current_room: Optional[rtc.Room] = None


# ============================================================================
# Function Tools for LLM
# ============================================================================

@function_tool(description="Update the candidate's profile with information they provide. Call this IMMEDIATELY when the candidate answers a question.")
async def update_candidate_profile(
    field_name: str,
    field_value: str,
) -> str:
    """Update candidate profile with extracted information."""
    global current_session, current_room
    
    logger.info(f"🔧 Tool called - update_candidate_profile({field_name}={field_value})")
    
    if current_session:
        current_session.update_field(field_name, field_value)
        
        if current_room and current_room.local_participant:
            try:
                message = json.dumps({
                    "type": "FIELD_UPDATE",
                    "fields": current_session.extracted_fields,
                    "timestamp": datetime.now().isoformat()
                })
                
                # Get recipients (all remote participants)
                participants = current_room.remote_participants
                destination_sids = [p.sid for p in participants.values()]
                
                logger.info(f"📤 Publishing data to {len(destination_sids)} participants: {destination_sids}")
                
                if destination_sids:
                    await current_room.local_participant.publish_data(
                        message.encode(),
                        reliable=True,
                        destination_sids=destination_sids
                    )
                    logger.info(f"✅ Broadcasted update to {destination_sids}")
                else:
                    logger.warning("⚠️ No participants to receive data!")
                    
            except Exception as e:
                logger.error(f"❌ Failed to publish data: {e}")
        else:
            logger.warning(f"⚠️ Cannot broadcast: current_room={current_room is not None}, local_participant={current_room.local_participant if current_room else None}")
    else:
        logger.warning("⚠️ No current_session available!")
    
    return f"Updated {field_name} successfully"


# ============================================================================
# Agent Entry Point
# ============================================================================

def prewarm(proc: JobProcess):
    """Prewarm function - loads models before job starts."""
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    """Main entry point for the voice agent."""
    global current_session, current_room
    
    logger.info(f"Agent starting for room: {ctx.room.name}")
    
    current_room = ctx.room
    
    # Connect to room first
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # Wait for participant
    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}")
    
    # Get session data - TRY ROOM METADATA FIRST
    logger.info(f"Room metadata raw: {ctx.room.metadata}")
    metadata_source = "room"
    room_metadata = json.loads(ctx.room.metadata or "{}")
    
    # IF EMPTY, TRY PARTICIPANT METADATA (Fallback)
    if not room_metadata.get("questions") and participant.metadata:
        logger.info(f"Room metadata empty. Trying participant metadata: {participant.metadata}")
        try:
            room_metadata = json.loads(participant.metadata)
            metadata_source = "participant"
        except Exception as e:
            logger.error(f"Failed to parse participant metadata: {e}")

    candidate_id = room_metadata.get("candidate_id", "unknown")
    candidate_name = room_metadata.get("candidate_name", "Candidate")
    questions = room_metadata.get("questions", [])
    resume_context = room_metadata.get("resume_context", "")
    
    # --- LOGGING CONTEXT INJECTION ---
    logger.info("="*50)
    logger.info(f"CONTEXT INJECTION VERIFICATION ({metadata_source} metadata)")
    
    if resume_context:
        logger.info(f"✅ RESUME CONTEXT RECEIVED ({len(resume_context)} chars):")
        logger.info(f"{resume_context[:150]}...")
    else:
        logger.error("❌ NO RESUME CONTEXT RECEIVED")
        
    if questions:
        logger.info(f"✅ GAP QUESTIONS RECEIVED ({len(questions)}):")
        for i, q in enumerate(questions):
            logger.info(f"  {i+1}. {q}")
    else:
        logger.error("❌ NO GAP QUESTIONS RECEIVED - Using defaults")
        questions = [
            "Where are you currently based?",
            "How many years of experience do you have?",
            "What are you looking for in your next role?"
        ]
    logger.info("="*50)

    logger.info(f"Participant joined: {participant.identity}")
    
    # Build system prompt - STRICTLY focused on gap questions only
    questions_str = "\n".join([f"  {i+1}. \"{q}\"" for i, q in enumerate(questions)])
    num_questions = len(questions)
    first_name = candidate_name.split()[0] if candidate_name else "there"
    
    system_prompt = f"""You are Pluto, a focused AI interviewer for Pluto conducting a brief gap-filling interview.

CANDIDATE: {candidate_name}

RESUME CONTEXT:
{resume_context}

YOUR MISSION: Ask ONLY these {num_questions} specific questions to fill gaps in the candidate's profile. Do NOT ask any other questions.

GAP QUESTIONS (ask in this exact order):
{questions_str}

STRICT RULES:
1. Ask ONLY the questions listed above - no improvisation, no additional questions
2. Ask ONE question at a time, wait for answer, then move to the next
3. When you receive an answer, IMMEDIATELY call update_candidate_profile() with the extracted info
4. Keep acknowledgments very brief (3-5 words max): "Got it.", "Thanks.", "Perfect."
5. Do NOT ask follow-up questions or dig deeper - just collect the answer and move on
6. If the candidate goes off-topic, gently redirect: "I appreciate that! Let me ask you about [next question]"
7. After asking ALL {num_questions} questions, end with: "That's everything I needed. Your profile is now complete. Thank you for your time, {first_name}!"

FIELD MAPPING for update_candidate_profile():
- Location questions → field_name="location"
- Experience questions → field_name="years_experience" 
- Skills/technology questions → field_name="skills"
- Motivation/goals questions → field_name="motivation"
- Project questions → field_name="project_details"
- Work history questions → field_name="work_experience"
- Achievement questions → field_name="achievement"

EXAMPLE FLOW:
You: "Where are you currently based?"
Candidate: "I'm in Austin, Texas"
→ Call update_candidate_profile(field_name="location", field_value="Austin, Texas")
You: "Got it. How many years of experience do you have in software development?"
[Continue to next question]

DO NOT:
- Ask about anything not in the gap questions list
- Have extended conversations
- Ask clarifying questions (accept whatever they say)
- Repeat questions already asked

START by greeting {first_name} briefly, then ask question #1."""

    # Initialize LLM with OpenRouter (GPT-4o-mini)
    llm_instance = openai.LLM(
        model="openai/gpt-4o-mini",
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
    )
    
    # Initialize ElevenLabs TTS with eleven_turbo_v2_5
    # Voice IDs: Rachel="21m00Tcm4TlvDq8ikWAM", Bella="EXAVITQu4vr4xnSDxMaL"
    tts_instance = elevenlabs.TTS(
        api_key=ELEVENLABS_API_KEY,
        model="eleven_turbo_v2_5",
        voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel - professional female voice
    )
    
    # Create Agent with all components
    agent = Agent(
        instructions=system_prompt,
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(api_key=DEEPGRAM_API_KEY),
        llm=llm_instance,
        tts=tts_instance,
        tools=[update_candidate_profile],
    )
    
    # Create AgentSession and start with the agent
    session = AgentSession()
    await session.start(agent, room=ctx.room)
    
    logger.info("Agent started successfully - voice session active with ElevenLabs TTS")
    
    # Explicitly greet the user with a focused, brief intro
    first_question = questions[0] if questions else "Could you tell me a bit about yourself?"
    num_q = len(questions)
    greeting = f"Hi {first_name}! I'm Pluto from Pluto. I just have {num_q} quick questions to complete your profile. Let's start: {first_question}"
    
    await session.say(greeting)
    logger.info(f"Sent initial greeting to {first_name} with {num_q} gap questions")


# ============================================================================
# CLI Entry
# ============================================================================

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        ),
    )
