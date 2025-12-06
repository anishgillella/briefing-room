from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
from services.daily import daily_service
from services.supabase import get_supabase_client

router = APIRouter(prefix="/rooms", tags=["rooms"])


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
