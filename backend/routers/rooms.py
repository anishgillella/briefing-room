from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import httpx
from services.daily import daily_service
from services.vapi import vapi_service
from services.supabase import get_supabase_client
from config import OPENROUTER_API_KEY, OPENROUTER_MODEL

router = APIRouter(prefix="/rooms", tags=["rooms"])

# In-memory cache for briefings (replace with Supabase table in production)
_briefings_cache: dict[str, dict] = {}


class CreateRoomRequest(BaseModel):
    """Request body for creating a room"""
    interviewer_name: str
    candidate_name: Optional[str] = None


class CreateRoomResponse(BaseModel):
    """Response after creating a room"""
    room_name: str
    room_url: str
    interviewer_token: str
    expires_at: str


class JoinRoomRequest(BaseModel):
    """Request body for joining a room"""
    participant_name: str
    participant_type: str  # 'interviewer' or 'candidate'


class JoinRoomResponse(BaseModel):
    """Response with join token"""
    token: str
    room_url: str


class BriefingRequest(BaseModel):
    """Request body for storing briefing data"""
    candidate_name: str
    role: Optional[str] = None
    resume_summary: Optional[str] = None
    notes: Optional[str] = None
    focus_areas: Optional[list[str]] = None


class BriefingResponse(BaseModel):
    """Response with briefing context"""
    candidate_name: str
    role: Optional[str]
    resume_summary: Optional[str]
    notes: Optional[str]
    focus_areas: Optional[list[str]]
    briefing_prompt: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None
    history: Optional[list[ChatMessage]] = None


class ChatResponse(BaseModel):
    response: str


@router.post("", response_model=CreateRoomResponse)
async def create_room(request: CreateRoomRequest):
    """
    Create a new interview room
    
    - Creates a Daily.co room
    - Stores room info in Supabase
    - Returns room URL and interviewer token
    """
    try:
        # Create Daily room
        room_data = await daily_service.create_room(expires_in_hours=2)
        room_name = room_data["name"]
        room_url = room_data["url"]
        
        # Generate interviewer token
        interviewer_token = await daily_service.create_meeting_token(
            room_name=room_name,
            participant_name=request.interviewer_name,
            participant_type="interviewer",
            expires_in_hours=2
        )
        
        # Store in Supabase
        expires_at = datetime.utcnow() + timedelta(hours=2)
        supabase = get_supabase_client()
        await supabase.insert("rooms", {
            "name": room_name,
            "daily_room_url": room_url,
            "created_by": request.interviewer_name,
            "expires_at": expires_at.isoformat()
        })
        
        return CreateRoomResponse(
            room_name=room_name,
            room_url=room_url,
            interviewer_token=interviewer_token,
            expires_at=expires_at.isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create room: {str(e)}")


@router.get("/{room_name}")
async def get_room(room_name: str):
    """Get room details by name"""
    try:
        # Check Supabase first
        supabase = get_supabase_client()
        room = await supabase.select_one("rooms", filters={"name": room_name})
        
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        
        # Also get Daily room info
        daily_room = await daily_service.get_room(room_name)
        
        return {
            "room_name": room["name"],
            "room_url": room["daily_room_url"],
            "created_by": room["created_by"],
            "created_at": room["created_at"],
            "expires_at": room["expires_at"],
            "daily_config": daily_room.get("config", {})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get room: {str(e)}")


@router.post("/{room_name}/join", response_model=JoinRoomResponse)
async def join_room(room_name: str, request: JoinRoomRequest):
    """
    Get a token to join an existing room
    
    - Validates room exists
    - Generates meeting token for participant
    """
    try:
        # Verify room exists in Supabase
        supabase = get_supabase_client()
        room = await supabase.select_one("rooms", filters={"name": room_name})
        
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        
        # Check if room has expired
        expires_at = datetime.fromisoformat(room["expires_at"].replace("Z", "+00:00"))
        if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
            raise HTTPException(status_code=410, detail="Room has expired")
        
        # Generate token for participant
        token = await daily_service.create_meeting_token(
            room_name=room_name,
            participant_name=request.participant_name,
            participant_type=request.participant_type,
            expires_in_hours=2
        )
        
        return JoinRoomResponse(
            token=token,
            room_url=room["daily_room_url"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to join room: {str(e)}")


@router.post("/{room_name}/briefing")
async def set_briefing(room_name: str, request: BriefingRequest):
    """
    Store briefing data for a room
    
    - Stores candidate info for the AI agent to use
    """
    try:
        # Store briefing data in memory cache
        briefing_data = {
            "room_name": room_name,
            "candidate_name": request.candidate_name,
            "role": request.role,
            "resume_summary": request.resume_summary,
            "notes": request.notes,
            "focus_areas": request.focus_areas,
        }
        
        # Store in cache
        _briefings_cache[room_name] = briefing_data
        
        # Generate briefing prompt
        briefing_prompt = _generate_briefing_prompt(briefing_data)
        
        return {
            "success": True,
            "briefing_prompt": briefing_prompt,
            **briefing_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set briefing: {str(e)}")


@router.get("/{room_name}/briefing", response_model=BriefingResponse)
async def get_briefing(room_name: str):
    """
    Get briefing data for a room
    
    - Returns candidate info and generated prompt for the AI agent
    """
    try:
        # Check cache first
        if room_name in _briefings_cache:
            briefing_data = _briefings_cache[room_name]
            briefing_prompt = _generate_briefing_prompt(briefing_data)
            return BriefingResponse(
                candidate_name=briefing_data.get("candidate_name", "the candidate"),
                role=briefing_data.get("role"),
                resume_summary=briefing_data.get("resume_summary"),
                notes=briefing_data.get("notes"),
                focus_areas=briefing_data.get("focus_areas"),
                briefing_prompt=briefing_prompt
            )
        
        # Return default if no briefing stored
        default_data = {
            "candidate_name": "the candidate",
            "role": None,
            "resume_summary": None,
            "notes": None,
            "focus_areas": None,
        }
        
        briefing_prompt = _generate_briefing_prompt(default_data)
        
        return BriefingResponse(
            **default_data,
            briefing_prompt=briefing_prompt
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get briefing: {str(e)}")


def _generate_briefing_prompt(data: dict) -> str:
    """Generate a comprehensive briefing prompt for the AI agent based on candidate data"""
    parts = []
    
    # Job description / role context (no markdown - voice friendly)
    if data.get("notes"):
        parts.append(f"Here's the job description: {data['notes']}")
    
    if data.get("role") and data.get("role") != "See job description":
        parts.append(f"The position title is: {data['role']}")
    
    # Resume / candidate info
    if data.get("resume_summary"):
        parts.append(f"About the candidate: {data['resume_summary']}")
    
    if data.get("candidate_name") and data.get("candidate_name") != "the candidate":
        parts.append(f"The candidate's name is {data['candidate_name']}.")
    
    if data.get("focus_areas"):
        areas = ", ".join(data["focus_areas"])
        parts.append(f"Key areas to focus on during the interview: {areas}")
    
    if not parts:
        return """No specific candidate or job information was provided. 
You can offer general interview tips and ask the interviewer about what role they're hiring for, 
what skills they're looking for, and if they have any specific concerns about the candidate."""
    
    return " ".join(parts).strip()


@router.post("/{room_name}/chat", response_model=ChatResponse)
async def chat(room_name: str, request: ChatRequest):
    """
    Chat with the AI assistant during an interview
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured")
    
    try:
        # Build system prompt with context
        system_prompt = """You are a warm, helpful AI interview assistant. You're helping an interviewer DURING an active interview.

Your responses should be:
- **FORMATTED CLEANLY**: Use bullet points with blank lines between them for readability.
- **CONCISE**: Keep it short and punchy.
- **ACTIONABLE**: Suggestions must be specific to the candidate's background if provided.
- **FRIENDLY**: helpful and supportive tone.

IMPORTANT: If you have context about the job or candidate below, USE IT. Do not ask for information that is already provided."""

        if request.context:
            system_prompt += f"\n\n### INTERVIEW CONTEXT (Candidate & Job Info):\n{request.context}\n\nUse this context to tailor your answers."

        # Build messages array
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add history if provided
        if request.history:
            for msg in request.history:
                messages.append({"role": msg.role, "content": msg.content})
        
        # Add current message
        messages.append({"role": "user", "content": request.message})

        # Call OpenRouter
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://briefing-room.app",
                    "X-Title": "Briefing Room"
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": messages,
                    "max_tokens": 300,
                    "temperature": 0.7
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                print(f"OpenRouter error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail=f"AI service error")
            
            data = response.json()
            assistant_message = data["choices"][0]["message"]["content"]
            
            return ChatResponse(response=assistant_message)
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Chat error: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


class DebriefRequest(BaseModel):
    chat_history: list[ChatMessage]
    notes: Optional[str] = None
    transcript: Optional[str] = None  # New captured transcript


class DebriefResponse(BaseModel):
    summary: str
    strengths: list[str]
    improvements: list[str]  # Renamed from weaknesses to be constructive
    follow_up_questions: list[str]
    recommendation: str  # "Strong Hire", "Hire", "Leaning Hire", "Leaning No Hire", "No Hire"
    original_briefing: Optional[BriefingResponse] = None


@router.post("/{room_name}/debrief", response_model=DebriefResponse)
async def generate_debrief(room_name: str, request: DebriefRequest):
    """
    Generate an interview debrief based on the session
    
    - Analyzes transcript (preferred) or chat history + notes
    - Uses original briefing context (JD/Resume)
    - Generates summary, pros/cons, and recommendation
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured")
    
    try:
        # Get original briefing context
        briefing_data = _briefings_cache.get(room_name, {})
        briefing_prompt = _generate_briefing_prompt(briefing_data)
        
        # Check if we have enough data
        has_transcript = bool(request.transcript and len(request.transcript) > 50)
        has_chat = bool(request.chat_history)
        
        if not has_transcript and not has_chat and not request.notes:
            return DebriefResponse(
                summary="No interview activity recorded.",
                strengths=[],
                improvements=[],
                follow_up_questions=[],
                recommendation="N/A",
                original_briefing=None
            )

        chat_transcript = "\n".join([f"{msg.role.upper()}: {msg.content}" for msg in request.chat_history])
        
        # Select prompt strategy based on data quality
        if has_transcript:
            system_prompt = """You are an expert technical recruiter and hiring manager. 
Your task is to generate a structured interview debrief based on the VERBATIM TRANSCRIPT of the interview.

Analyze the candidate's actual answers to evaluate their skills, communication style, and depth of knowledge.
Look for specific evidence in their responses to support your recommendation.

Output strictly valid JSON with the following structure:
{
  "summary": "2-3 sentence executive summary of the candidate's fit",
  "strengths": ["list", "of", "strong", "points", "with", "evidence"],
  "improvements": ["list", "of", "missing", "skills", "or", "weak", "answers"],
  "follow_up_questions": ["3 specific questions to dig deeper into weak areas"],
  "recommendation": "One of: Strong Hire, Hire, Leaning Hire, Leaning No Hire, No Hire"
}"""
            user_prompt = f"""
### INTERVIEW CONTEXT
{briefing_prompt}

### INTERVIEWER NOTES
{request.notes or "None provided"}

### INTERVIEW TRANSCRIPT
{request.transcript}
"""
        else:
            # Fallback to inference mode
            system_prompt = """You are an expert technical recruiter. 
Your task is to generate a structured debrief based on IMPERFECT signals (we only have the interviewer's side-chat with AI, not the full audio transcript).

Rely on:
1. The Job Description (Context)
2. The questions the interviewer asked the AI (which reveal what they were probing)
3. Any notes provided

Output strictly valid JSON (same structure as above)."""
            
            user_prompt = f"""
### INTERVIEW CONTEXT
{briefing_prompt}

### INTERVIEWER NOTES
{request.notes or "None provided"}

### CHAT HISTORY (Questions interviewer asked AI helper)
{chat_transcript}

Based on what the interviewer was asking you (the AI) during the call, infer what topics were covered and where the concerns might be.
"""

        # Call OpenRouter
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://briefing-room.app",
                    "X-Title": "Briefing Room"
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "response_format": {"type": "json_object"},
                    "max_tokens": 1000,
                    "temperature": 0.5
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                print(f"OpenRouter error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="Failed to generate debrief")
            
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            import json
            result = json.loads(content)
            
            # Construct original briefing response object for UI reference
            original_briefing = None
            if briefing_data:
                original_briefing = BriefingResponse(
                    candidate_name=briefing_data.get("candidate_name", "Candidate"),
                    role=briefing_data.get("role"),
                    resume_summary=briefing_data.get("resume_summary"),
                    notes=briefing_data.get("notes"),
                    focus_areas=briefing_data.get("focus_areas"),
                    briefing_prompt=briefing_prompt
                )

            return DebriefResponse(
                summary=result.get("summary", "Analysis failed"),
                strengths=result.get("strengths", []),
                improvements=result.get("improvements", []),
                follow_up_questions=result.get("follow_up_questions", []),
                recommendation=result.get("recommendation", "Leaning Hire"),
                original_briefing=original_briefing
            )
            
    except Exception as e:
        print(f"Debrief error: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Debrief generation failed: {str(e)}")


@router.post("/{room_name}/candidate")
async def spawn_candidate(room_name: str):
    """
    Spawn the Immersive AI Candidate into the room
    """
    try:
        # Get room details for URL
        supabase = get_supabase_client()
        room = await supabase.select_one("rooms", filters={"name": room_name})
        
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
            
        daily_url = room["daily_room_url"]
        
        # Get briefing context
        briefing_data = _briefings_cache.get(room_name, {})
        
        # Spawn Vapi agent
        result = await vapi_service.create_candidate_agent(daily_url, briefing_data)
        
        return {"success": True, "call_id": result.get("id"), "details": result}
        
    except Exception as e:
        print(f"Spawn candidate error: {type(e).__name__}: {str(e)}")
        # Don't crash the UI if Vapi fails, but return valid error
        raise HTTPException(status_code=500, detail=f"Failed to spawn candidate: {str(e)}")
