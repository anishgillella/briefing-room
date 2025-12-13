"""
LiveKit Router for Voice Agent Integration.
Handles token generation and room creation for LiveKit voice sessions.
"""

import os
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
import jwt
import time

from config import LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET

router = APIRouter(prefix="/livekit", tags=["livekit"])


class TokenRequest(BaseModel):
    """Request for generating a LiveKit token."""
    room_name: str
    participant_name: str
    participant_identity: str
    metadata: Optional[dict] = None


class TokenResponse(BaseModel):
    """Response containing LiveKit token and connection info."""
    token: str
    livekit_url: str
    room_name: str


class RoomRequest(BaseModel):
    """Request for creating a LiveKit room."""
    room_name: str
    candidate_id: str
    candidate_name: str
    mode: str = "interview"  # "interview" or "intake"
    metadata: Optional[dict] = None


class RoomResponse(BaseModel):
    """Response for room creation."""
    room_name: str
    token: str
    livekit_url: str


def generate_livekit_token(
    room_name: str,
    participant_identity: str,
    participant_name: str,
    metadata: str = "",
    ttl_seconds: int = 3600
) -> str:
    """
    Generate a LiveKit access token.
    
    Uses JWT with LiveKit's expected claims structure.
    """
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(
            status_code=500,
            detail="LiveKit credentials not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET."
        )
    
    now = int(time.time())
    
    # LiveKit token claims
    claims = {
        "iss": LIVEKIT_API_KEY,
        "exp": now + ttl_seconds,
        "nbf": now,
        "sub": participant_identity,
        "name": participant_name,
        "video": {
            "room": room_name,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        },
        "metadata": metadata,
    }
    
    token = jwt.encode(claims, LIVEKIT_API_SECRET, algorithm="HS256")
    return token


@router.post("/token", response_model=TokenResponse)
async def get_livekit_token(request: TokenRequest) -> TokenResponse:
    """
    Generate a LiveKit access token for a participant.
    
    This token allows the participant to join the specified room
    with audio/video/data publishing capabilities.
    """
    if not LIVEKIT_URL:
        raise HTTPException(
            status_code=500,
            detail="LiveKit URL not configured. Set LIVEKIT_URL environment variable."
        )
    
    metadata_str = ""
    if request.metadata:
        import json
        metadata_str = json.dumps(request.metadata)
    
    token = generate_livekit_token(
        room_name=request.room_name,
        participant_identity=request.participant_identity,
        participant_name=request.participant_name,
        metadata=metadata_str,
    )
    
    return TokenResponse(
        token=token,
        livekit_url=LIVEKIT_URL,
        room_name=request.room_name,
    )


@router.post("/room", response_model=RoomResponse)
async def create_livekit_room(request: RoomRequest) -> RoomResponse:
    """
    Create a LiveKit room for an interview session.
    
    The room is created with metadata containing candidate context.
    The LiveKit agent will read this metadata when it joins.
    
    Returns a token for the interviewer to join.
    """
    if not LIVEKIT_URL or not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(
            status_code=500,
            detail="LiveKit not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET."
        )
    
    import json
    
    # Build room metadata for the agent
    room_metadata = {
        "candidate_id": request.candidate_id,
        "candidate_name": request.candidate_name,
        "mode": request.mode,
        "created_at": datetime.now().isoformat(),
    }
    
    if request.metadata:
        room_metadata.update(request.metadata)
    
    # Generate interviewer token with room metadata
    token = generate_livekit_token(
        room_name=request.room_name,
        participant_identity="interviewer",
        participant_name="Interviewer",
        metadata=json.dumps(room_metadata),
    )
    
    print(f"[LiveKit] Created room '{request.room_name}' for candidate '{request.candidate_name}'")
    
    return RoomResponse(
        room_name=request.room_name,
        token=token,
        livekit_url=LIVEKIT_URL,
    )


@router.get("/health")
async def livekit_health():
    """Check if LiveKit is configured."""
    configured = bool(LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET)
    return {
        "configured": configured,
        "livekit_url": LIVEKIT_URL if configured else None,
    }
