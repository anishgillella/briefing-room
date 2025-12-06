from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import httpx
from services.daily import daily_service
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
- CONCISE (1-3 sentences max)
- ACTIONABLE (give specific questions or things to look for)
- FRIENDLY and supportive

The interviewer is in a video call with the candidate and needs quick, helpful assistance."""

        if request.context:
            system_prompt += f"\n\nHere's the context about this interview:\n{request.context}"

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
