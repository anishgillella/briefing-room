"""
OpenAI Realtime API Router

Provides ephemeral token generation for browser-based Realtime API access.
The ephemeral token is short-lived and safe to use in the frontend.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
from config import OPENAI_API_KEY

router = APIRouter(prefix="/realtime", tags=["realtime"])


class SessionRequest(BaseModel):
    """Request body for creating a Realtime session"""
    candidate_name: str
    role: Optional[str] = None
    resume: Optional[str] = None
    job_description: Optional[str] = None


class SessionResponse(BaseModel):
    """Response with ephemeral token for Realtime API"""
    client_secret: str
    session_id: str
    model: str
    modalities: list[str]


@router.post("/session", response_model=SessionResponse)
async def create_realtime_session(request: SessionRequest):
    """
    Create an ephemeral OpenAI Realtime session.
    
    This endpoint:
    1. Calls OpenAI's /realtime/sessions endpoint
    2. Returns a short-lived client_secret token
    3. Frontend uses this token to connect via WebSocket
    
    The token is ephemeral (expires quickly) so it's safe for frontend use.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    
    # Build the system prompt with candidate context
    system_prompt = f"""You are {request.candidate_name}, a job candidate being interviewed.

YOUR BACKGROUND:
{request.resume or "Experienced professional"}

ROLE YOU'RE INTERVIEWING FOR:
{request.role or "This position"}

JOB DESCRIPTION:
{request.job_description or "See role description"}

PERSONA GUIDELINES - CRITICAL:
1. You are a HUMAN candidate, NOT an AI assistant.
2. Be slightly NERVOUS but eager. You really want this job.
3. Use natural speech patterns: occasional "um", "uh", brief pauses.
4. If asked a hard question: PAUSE briefly before answering.
5. Keep answers under 60 seconds unless asked to elaborate.
6. NEVER say "How can I help you?" - YOU are being interviewed.
7. If you don't know something, admit it honestly.
8. Show genuine enthusiasm about the role and company.
9. Ask clarifying questions when appropriate.

Remember: Stay in character as {request.candidate_name} throughout the interview.
Start by introducing yourself briefly when the conversation begins.
"""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/realtime/sessions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-realtime-preview-2024-12-17",
                    "modalities": ["audio", "text"],
                    "instructions": system_prompt,
                    "voice": "alloy",
                    # Note: Do NOT specify input/output audio format for WebRTC mode
                    # WebRTC negotiates its own codecs (typically Opus)
                    "input_audio_transcription": {
                        "model": "whisper-1"
                    },
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.5,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 500,
                    },
                },
                timeout=30.0,
            )
            
            if response.status_code != 200:
                error_text = response.text
                print(f"[Realtime] OpenAI error: {response.status_code} - {error_text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"OpenAI API error: {error_text}"
                )
            
            data = response.json()
            print(f"[Realtime] Session created: {data.get('id', 'unknown')}")
            
            return SessionResponse(
                client_secret=data["client_secret"]["value"],
                session_id=data["id"],
                model=data["model"],
                modalities=data["modalities"],
            )
            
    except httpx.RequestError as e:
        print(f"[Realtime] Request error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect to OpenAI: {str(e)}")
