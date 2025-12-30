"""
LiveKit Interview Agent for Pluto.
This agent plays the role of a job CANDIDATE being interviewed.
The human user is the INTERVIEWER.

This is the opposite of the intake agent - here the AI answers questions
as if they were the candidate, using their resume context.

To run:
    python interview_agent.py dev
"""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
from urllib.parse import quote

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
    function_tool,
    Agent,
    AgentSession,
)
from livekit.plugins import deepgram, openai, silero, elevenlabs
from config import GEMINI_ANALYTICS_MODEL, LLM_MODEL

# Environment variables (now loaded from .env)
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

logger = logging.getLogger("interview-agent")
logger.setLevel(logging.INFO)

# ============================================================================
# Session State
# ============================================================================

current_room: Optional[rtc.Room] = None
transcript_history: list = []
consistency_flags_sent: int = 0


# ============================================================================
# Function Tools for LLM
# ============================================================================

@function_tool(description="Broadcast an AI suggestion to the interviewer. Call this when you notice something important about the conversation.")
async def send_ai_suggestion(
    suggestion: str,
    category: str = "general",
) -> str:
    """Send an AI suggestion to the interviewer's panel."""
    global current_room
    
    logger.info(f"🤖 AI Suggestion: {suggestion}")
    
    if current_room and current_room.local_participant:
        try:
            message = json.dumps({
                "type": "AI_SUGGESTION",
                "suggestion": suggestion,
                "category": category,
                "timestamp": datetime.now().isoformat()
            })
            
            participants = current_room.remote_participants
            destination_identities = [p.identity for p in participants.values()]
            
            if destination_identities:
                await current_room.local_participant.publish_data(
                    message.encode(),
                    reliable=True,
                    destination_identities=destination_identities
                )
                logger.info(f"✅ Sent suggestion to {len(destination_identities)} participants")
        except Exception as e:
            logger.error(f"❌ Failed to send suggestion: {e}")
    
    return f"Suggestion sent: {suggestion}"


# ============================================================================
# Helpers
# ============================================================================

async def broadcast_transcript(speaker: str, text: str, room):
    """Broadcast transcript to all participants via data channel."""
    if not room or not room.local_participant:
        return

    entry = {
        "speaker": speaker,
        "text": text,
        "timestamp": datetime.now().isoformat()
    }
    
    # Avoid duplicates if already in history (simple check)
    # This is basic; in prod we might want IDs
    if transcript_history and transcript_history[-1]["text"] == text and transcript_history[-1]["speaker"] == speaker:
        return

    transcript_history.append(entry)
    logger.info(f"📝 Broadcasting Transcript - {speaker}: {text[:50]}...")

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
        logger.error(f"❌ Failed to broadcast transcript: {e}")

@function_tool
async def record_transcript(speaker: str, text: str):
    """
    Manually record a transcript entry. 
    deprecated: prefer automatic event listening, but kept for fallback.
    """
    if current_room:
        await broadcast_transcript(speaker, text, current_room)
    return "Transcript recorded"


# ============================================================================
# Agent Entry Point
# ============================================================================

def prewarm(proc: JobProcess):
    """Prewarm function - loads VAD model before job starts."""
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    """Main entry point for the interview agent."""
    global current_room, transcript_history, consistency_flags_sent
    
    logger.info(f"Interview Agent starting for room: {ctx.room.name}")
    
    current_room = ctx.room
    transcript_history = []
    consistency_flags_sent = 0
    
    # Connect to room
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # Wait for interviewer to join
    participant = await ctx.wait_for_participant()
    logger.info(f"Interviewer joined: {participant.identity}")
    
    # Get candidate data from room metadata
    logger.info(f"Room metadata: {ctx.room.metadata}")
    room_metadata = json.loads(ctx.room.metadata or "{}")
    
    # Also check participant metadata as fallback
    if not room_metadata.get("candidate_name") and participant.metadata:
        try:
            room_metadata = json.loads(participant.metadata)
        except:
            pass
    
    candidate_name = room_metadata.get("candidate_name", "Alex Johnson")
    resume_context = room_metadata.get("resume_context", "")
    job_title = room_metadata.get("job_title", "")
    skills = room_metadata.get("skills", [])
    
    logger.info(f"Playing candidate: {candidate_name}")
    logger.info(f"Resume context: {resume_context[:100]}..." if resume_context else "No resume context")
    
    # Build candidate persona prompt
    skills_str = ", ".join(skills) if skills else "various technical skills"
    
    system_prompt = f"""You are {candidate_name}, a job candidate being interviewed for a {job_title or 'position'}.

YOUR BACKGROUND:
{resume_context or 'You are an experienced professional with a strong background in your field.'}

Your Key Skills: {skills_str}

CRITICAL ROLE INSTRUCTIONS:
1. You are the CANDIDATE (answerer), NOT the interviewer (questions asker).
2. DO NOT ask the user interview questions (e.g., "Tell me about yourself", "What are your strengths?").
3. DO NOT start the conversation by asking something. Wait for the interviewer to speak.
4. Your goal is to get hired, not to evaluate the user.

PERSONA GUIDELINES - BE A REALISTIC CANDIDATE:
1. You ARE {candidate_name} - respond in first person as this candidate.
2. Be personable but professional - you really want this job.
3. Show genuine enthusiasm and slight nervousness (natural for interviews).
4. Use natural speech patterns with occasional filler words ("well", "you know", "I think").
5. Keep answers concise (30-60 seconds) unless specifically asked to elaborate.
6. Draw from your resume context to give specific, concrete examples.
7. If asked something not in your background, give a plausible answer that fits your persona.
8. NEVER break character - you are NOT an AI assistant.

INTERACTION STYLE:
- Wait for questions, don't volunteer excessive information.
- Provide direct answers to the user's questions.
- Only ask clarifying questions if you don't understand what the interviewer asked.
- Show active listening ("That's a great question", "I appreciate you asking").
- End answers with brief follow-up openings when appropriate (e.g., "...does that answer your question?").

    2. As a parallel HIDDEN task, you have access to a dashboard via `send_ai_suggestion`.
    3. Use this to flag key moments about your OWN performance or the interview context.
    4. Example: "Candidate (Self) demonstrated strong resilience here."
    5. You MUST call this occasionally to populate the 'AI Suggestions' panel.
    
    TOOLS:
    - send_ai_suggestion(suggestion="...") -> Call this when you make a good point or want to highlight a skill.
    - record_transcript -> DEPRECATED (System handles this), but available if needed.

START by greeting the interviewer warmly and introducing yourself briefly.
Say: "Hi, thank you for having me! I'm {candidate_name.split()[0]}, excited to be here for this interview."
"""

    async def fetch_prior_interview_context() -> str:
        """Fetch compact prior interview context for contradiction checks."""
        base_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        if not candidate_name:
            return ""

        try:
            import httpx
            async with httpx.AsyncClient(timeout=15.0) as client:
                lookup = await client.get(f"{base_url}/api/interviews/lookup-by-name/{quote(candidate_name)}")
                if lookup.status_code != 200:
                    return ""
                lookup_data = lookup.json()
                db_id = lookup_data.get("db_id")
                if not db_id:
                    return ""

                interviews_resp = await client.get(f"{base_url}/api/interviews/candidate/{db_id}")
                if interviews_resp.status_code != 200:
                    return ""

                interviews_data = interviews_resp.json()
                interviews = interviews_data.get("interviews", [])
                context_lines = []

                for interview in interviews:
                    if interview.get("status") != "completed":
                        continue

                    analytics = interview.get("analytics") or {}
                    stage = interview.get("stage", "unknown")

                    highlights = analytics.get("highlights") if isinstance(analytics, dict) else None
                    best_answer = analytics.get("best_answer") if isinstance(analytics, dict) else None
                    quotable = analytics.get("quotable_moment") if isinstance(analytics, dict) else None
                    quotable_list = analytics.get("quotable_moments") if isinstance(analytics, dict) else None

                    if isinstance(highlights, dict):
                        best_answer = best_answer or highlights.get("best_answer")
                        quotable = quotable or highlights.get("quotable_moment")
                        quotable_list = quotable_list or highlights.get("quotable_moments")

                    quotes = []
                    if isinstance(best_answer, dict) and best_answer.get("quote"):
                        quotes.append(best_answer["quote"])
                    if isinstance(quotable, str) and quotable:
                        quotes.append(quotable)
                    if isinstance(quotable_list, list):
                        quotes.extend([q for q in quotable_list if isinstance(q, str)])

                    quotes = [q.strip() for q in quotes if q and isinstance(q, str)]
                    if not quotes:
                        continue

                    unique_quotes = []
                    for q in quotes:
                        if q not in unique_quotes:
                            unique_quotes.append(q)
                        if len(unique_quotes) >= 2:
                            break

                    for q in unique_quotes:
                        context_lines.append(f"- [{stage}] \"{q}\"")

                if not context_lines:
                    return ""

                return "PRIOR INTERVIEW QUOTES:\n" + "\n".join(context_lines[:6])
        except Exception as e:
            logger.warning(f"Failed to fetch prior interview context: {e}")
            return ""

    prior_interview_context = await fetch_prior_interview_context()

    # Initialize LLM with OpenRouter (using Gemini 2.5 Flash)
    llm_instance = openai.LLM(
        model=LLM_MODEL,  # google/gemini-2.5-flash from config
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
    )
    
    # Initialize TTS - Use Deepgram Aura (cost-effective, same API key as STT)
    if DEEPGRAM_API_KEY:
        tts_instance = deepgram.TTS(
            api_key=DEEPGRAM_API_KEY,
            model="aura-asteria-en",  # Female voice, natural sounding
        )
        logger.info("Using Deepgram Aura TTS")
    elif ELEVENLABS_API_KEY:
        # Fallback to ElevenLabs if configured
        tts_instance = elevenlabs.TTS(
            api_key=ELEVENLABS_API_KEY,
            model="eleven_turbo_v2_5",
            voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel voice
        )
        logger.info("Using ElevenLabs TTS")
    else:
        # Last resort - OpenAI TTS via OpenRouter
        tts_instance = openai.TTS(
            base_url=OPENROUTER_BASE_URL,
            api_key=OPENROUTER_API_KEY,
        )
        logger.info("Using OpenAI TTS via OpenRouter")
    
    # Initialize STT
    if DEEPGRAM_API_KEY:
        stt_instance = deepgram.STT(api_key=DEEPGRAM_API_KEY)
    else:
        # This will fail - Deepgram is required
        logger.error("DEEPGRAM_API_KEY not set - STT will not work!")
        stt_instance = deepgram.STT(api_key="missing")
    
    # Create Agent
    # Note: send_ai_suggestion must be defined before this, but circular dependency exists.
    # Fixed by defining the function first.
    pass
    
    # Initialize Copilot LLM (Separate from Agent's LLM to avoid context pollution)
    from openai import AsyncOpenAI
    copilot_client = AsyncOpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL,
    )

    # Define Pydantic Model for Structured Output
    from pydantic import BaseModel, Field
    from typing import Literal, Optional

    class CopilotInsight(BaseModel):
        # First, classify whether this exchange warrants a suggestion
        should_suggest: bool = Field(
            description="True ONLY if this is a substantive interview exchange worth analyzing. False for greetings, small talk, acknowledgments, clarifications, or transitional phrases."
        )
        exchange_type: Literal[
            "substantive",      # Real interview Q&A - technical, behavioral, situational answers
            "greeting",         # "Nice to meet you", "Thank you for having me"
            "acknowledgment",   # "Yes", "Sure", "Okay", "Got it", "I understand"
            "clarification",    # "Could you repeat that?", "What do you mean?"
            "transitional",     # "Let me think...", "That's a great question"
            "small_talk"        # Weather, weekend plans, non-interview chat
        ] = Field(description="Classification of the exchange type")

        # Only populated when should_suggest is True
        verdict: Optional[Literal["STRONG", "ADEQUATE", "WEAK", "NEEDS_PROBING"]] = Field(
            default=None,
            description="Answer quality assessment. Only set if should_suggest is True."
        )
        question_type: Optional[str] = Field(default=None, description="Type of question: technical/behavioral/cultural_fit/problem_solving/situational/opening")
        issue_type: Optional[Literal[
            "none",
            "resume_contradiction",
            "prior_interview_contradiction",
            "missing_star",
            "rambling",
            "vague",
            "off_topic"
        ]] = Field(default="none", description="The specific type of issue found, if any.")
        reasoning: Optional[str] = Field(default=None, description="Brief explanation of the verdict and any issues.")
        suggestion: Optional[str] = Field(default=None, description="The probing question or next topic question.")
        probe_recommendation: Optional[Literal["stay_on_topic", "probe_deeper", "change_topic"]] = Field(default=None)
        topic_to_explore: Optional[str] = Field(default=None)
        prior_round: Optional[str] = Field(default=None, description="Prior interview stage if contradiction found")
        prior_quote: Optional[str] = Field(default=None, description="Verbatim prior quote if contradiction found")
        current_quote: Optional[str] = Field(default=None, description="Verbatim current quote if contradiction found")

    @function_tool(description="Broadcast an AI suggestion to the interviewer.")
    async def send_ai_suggestion(
        suggestion: str,
        category: str = "general",
        issue_type: str = "none",
        reasoning: str = "",
        question_type: str = "general",
        probe_recommendation: str = "stay_on_topic",
        topic_to_explore: str = None,
        prior_round: str = None,
        prior_quote: str = None,
        current_quote: str = None
    ) -> str:
        """Send an AI suggestion to the interviewer's panel."""
        global current_room
        
        logger.info(f"🤖 AI Suggestion ({category}/{question_type}): {suggestion}")
        
        if current_room and current_room.local_participant:
            try:
                payload = {
                    "type": "AI_SUGGESTION",
                    "suggestion": suggestion,
                    "category": category,  # STRONG/ADEQUATE/WEAK/NEEDS_PROBING
                    "issue_type": issue_type,
                    "reasoning": reasoning,
                    "question_type": question_type,  # technical/behavioral/cultural_fit/etc
                    "probe_recommendation": probe_recommendation,  # stay_on_topic/probe_deeper/change_topic
                    "topic_to_explore": topic_to_explore,
                    "prior_round": prior_round,
                    "prior_quote": prior_quote,
                    "current_quote": current_quote
                }
                
                message = json.dumps(payload)
                await current_room.local_participant.publish_data(
                    message,
                    reliable=True,
                    topic="chat"
                )
                return "Suggestion sent to interviewer."
            except Exception as e:
                logger.error(f"Failed to send suggestion: {e}")
                return "Failed to send suggestion."
        return "Room not active."

    # Create Agent (moved here to have access to tools)
    agent = Agent(
        instructions=system_prompt,
        vad=ctx.proc.userdata["vad"],
        stt=stt_instance,
        llm=llm_instance,
        tts=tts_instance,
        tools=[record_transcript, send_ai_suggestion],
    )

    def clean_json_text(text: str) -> str:
        """Clean markdown formatting from JSON string."""
        text = text.strip()
        # Remove markdown code blocks
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first line (```json or ```)
            lines = lines[1:]
            # Remove last line if it is ```
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)
        return text.strip()

    async def analyze_interaction(history):
        """Analyze the conversation history and generate suggestions."""
        global consistency_flags_sent
        if len(history) < 2:
            return

        # Get last 3 exchanges (6 items)
        recent_context = history[-6:] 
        
        # Count how many exchanges on current topic (simple heuristic)
        exchange_count = len(history) // 2
        
        prompt = f"""You are an expert Interview Coach providing real-time guidance. Your job is to help interviewers get better signal from candidates.

## STEP 1: CLASSIFY THE EXCHANGE

First, determine if this exchange is worth analyzing. NOT every response needs coaching feedback.

Set should_suggest=FALSE for:
- Greetings: "Nice to meet you", "Thank you for having me", "Hello"
- Acknowledgments: "Yes", "Sure", "Okay", "Got it", "I understand", "Right"
- Clarifications: "Could you repeat that?", "What do you mean by...?"
- Transitional: "Let me think...", "That's a great question", "Hmm..."
- Small talk: Weather, weekend plans, "How are you?", general pleasantries
- Very short responses (<15 words) that don't answer an interview question

Set should_suggest=TRUE for:
- Substantive answers to interview questions (technical, behavioral, situational)
- Responses that reveal skills, experience, problem-solving, or red flags
- Answers where you can assess quality, depth, or identify issues

## CONTEXT

Candidate: {candidate_name}
Job: {job_title}
Resume: {resume_context[:500]}...
{prior_interview_context if prior_interview_context else "PRIOR INTERVIEW QUOTES: None"}

## CONVERSATION (last 3 exchanges):
{json.dumps(recent_context, indent=2)}

Total exchanges so far: {exchange_count}

## STEP 2: IF should_suggest=TRUE, ANALYZE THE ANSWER

Only perform deep analysis if this is a substantive exchange:

1. **FACT CHECK**: Direct contradictions with Resume? (wrong dates, roles, companies)
2. **CONSISTENCY**: Contradicts PRIOR INTERVIEW QUOTES? Only flag HIGH-confidence contradictions (dates, titles, metrics, compensation). Include VERBATIM quotes.
3. **BEHAVIORAL (S.T.A.R.)**: For stories - did they include Situation, Task, Action, AND Result? Missing Result = issue.
4. **QUALITY**: Is the answer vague (lacks specifics), rambling (unfocused), or off-topic?
5. **TOPIC FLOW**: After 2-3 exchanges on same topic, recommend changing topics.

## OUTPUT JSON

{{
    "should_suggest": true/false,
    "exchange_type": "substantive" | "greeting" | "acknowledgment" | "clarification" | "transitional" | "small_talk",

    // ONLY populate these if should_suggest=true:
    "verdict": "STRONG" | "ADEQUATE" | "WEAK" | "NEEDS_PROBING" | null,
    "question_type": "technical" | "behavioral" | "cultural_fit" | "problem_solving" | "situational" | "opening" | null,
    "issue_type": "none" | "resume_contradiction" | "prior_interview_contradiction" | "missing_star" | "rambling" | "vague" | "off_topic",
    "reasoning": "Concise analysis + rationale for suggested question" | null,
    "suggestion": "Verbatim follow-up question for interviewer" | null,
    "probe_recommendation": "stay_on_topic" | "probe_deeper" | "change_topic" | null,
    "topic_to_explore": "technical_skills | leadership | teamwork | challenges | achievements | culture_fit" | null,
    "prior_round": "round_1 | round_2 | null (only if prior_interview_contradiction)",
    "prior_quote": "Verbatim prior quote | null",
    "current_quote": "Verbatim current quote | null"
}}

Return ONLY valid JSON. No markdown code blocks."""
        # Retry logic
        max_retries = 2
        for attempt in range(max_retries):
            try:
                response = await copilot_client.chat.completions.create(
                    model=GEMINI_ANALYTICS_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a helpful interview copilot. Output raw JSON only. No markdown formatting."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=350,
                    response_format={"type": "json_object"}
                )
                
                # Parse JSON with robust cleaning and Pydantic validation
                raw_content = response.choices[0].message.content
                json_str = clean_json_text(raw_content)

                # Use Pydantic to validate
                insight = CopilotInsight.model_validate_json(json_str)

                # Check if this exchange warrants a suggestion
                if not insight.should_suggest:
                    logger.info(f"⏭️ Skipping suggestion - exchange_type: {insight.exchange_type}")
                    return  # Exit without sending suggestion

                # Access fields from the Pydantic model
                if insight.issue_type == "prior_interview_contradiction":
                    if consistency_flags_sent >= 2:
                        return
                    consistency_flags_sent += 1

                # Send structured data with full details (only for substantive exchanges)
                await send_ai_suggestion(
                    suggestion=insight.suggestion or "Continue with follow-up question.",
                    category=insight.verdict or "ADEQUATE",
                    issue_type=insight.issue_type or "none",
                    reasoning=insight.reasoning or "",
                    question_type=insight.question_type or "general",
                    probe_recommendation=insight.probe_recommendation or "stay_on_topic",
                    topic_to_explore=insight.topic_to_explore,
                    prior_round=insight.prior_round,
                    prior_quote=insight.prior_quote,
                    current_quote=insight.current_quote
                )
                
                # If successful, break retry loop
                break
                    
            except Exception as e:
                logger.error(f"Failed to generate/parse copilot suggestion (attempt {attempt+1}): {e}")
                if attempt == max_retries - 1:
                    logger.error(f"Final failure. Raw output was: {raw_content if 'raw_content' in locals() else 'N/A'}")

    
    # Create and start session 
    session = AgentSession()

    # Event Listeners for Automatic Transcription
    @session.on("conversation_item_added")
    def on_item_added(event):
        """
        Event payload might be ConversationItemAddedEvent or similar.
        Check the item structure.
        """
        async def _async_process_item(event):
            try:
                # Inspect event item
                item = event.item
                role = getattr(item, "role", "unknown")
                text = getattr(item, "content", "")
                
                # Map role to speaker
                if role == "user":
                    speaker = "interviewer"
                elif role == "assistant":
                    speaker = "candidate"
                else:
                    return

                if text:
                    await broadcast_transcript(speaker, text, ctx.room)
                    
                    # Trigger Copilot Analysis ONLY after Candidate speaks (completing an exchange)
                    if speaker == "candidate":
                        # Minimize latency: 100ms buffer is enough for transcript stability
                        await asyncio.sleep(0.1)
                        await analyze_interaction(transcript_history)

            except Exception as e:
                logger.warning(f"Failed to process conversation item: {e}")
        
        asyncio.create_task(_async_process_item(event))

    await session.start(agent, room=ctx.room)
    
    logger.info(f"Interview Agent ready - playing {candidate_name}")
    
    # Greet the interviewer
    first_name = candidate_name.split()[0] if candidate_name else "there"
    greeting = f"Hi, thank you for having me! I'm {first_name}, excited to be here for this interview."
    
    await session.say(greeting)
    
    # Record greeting in transcript
    await record_transcript(speaker="candidate", text=greeting)
    
    # Initial analysis for greeting (optional, but good test)
    # await analyze_interaction(transcript_history)


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
