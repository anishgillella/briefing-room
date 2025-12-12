"""
LiveKit Session Management for Pluto.
Handles room creation and token generation for voice sessions.
"""

import json
import logging
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
import time

from livekit import api

from backend.config import (
    LIVEKIT_URL,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
)

logger = logging.getLogger(__name__)

# ============================================================================
# Session Storage
# ============================================================================

class LiveKitSession:
    """Represents a LiveKit voice session."""
    
    def __init__(
        self,
        candidate_id: str,
        room_name: str,
        token: str,
        questions: List[str],
    ):
        self.candidate_id = candidate_id
        self.room_name = room_name
        self.token = token
        self.questions = questions
        self.extracted_fields: Dict[str, Any] = {}
        self.status = "waiting"
        self.created_at = datetime.now()


# In-memory session store
sessions: Dict[str, LiveKitSession] = {}


# ============================================================================
# Room and Token Management
# ============================================================================

async def create_room_with_metadata(
    room_name: str,
    metadata: Dict[str, Any],
) -> None:
    """
    Create a LiveKit room with metadata using the Room Service API.
    The agent will read this metadata when it joins.
    """
    livekit_api = api.LiveKitAPI(
        LIVEKIT_URL,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET,
    )
    
    try:
        # Create room with metadata
        room = await livekit_api.room.create_room(
            api.CreateRoomRequest(
                name=room_name,
                metadata=json.dumps(metadata),
            )
        )
        logger.info(f"Created room {room_name} with metadata: {list(metadata.keys())}")
    except Exception as e:
        logger.error(f"Failed to create room: {e}")
        raise
    finally:
        await livekit_api.aclose()


def create_room_token(
    room_name: str,
    participant_identity: str,
    participant_name: str,
    metadata: Dict[str, Any] = None,
) -> str:
    """
    Generate a LiveKit access token for a participant.
    """
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    
    token.with_identity(participant_identity)
    token.with_name(participant_name)
    
    # Grant permissions
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
    ))
    
    # Add participant metadata (fallback for agent)
    if metadata:
        token.with_metadata(json.dumps(metadata))
    
    return token.to_jwt()


async def create_voice_session_async(
    candidate_id: str,
    candidate_name: str,
    questions: List[str],
    resume_context: str = "",
) -> LiveKitSession:
    """
    Create a new voice session for a candidate (async version).
    Creates the room with metadata FIRST, then generates participant token.
    """
    # Generate unique room name
    room_name = f"interview-{candidate_id}-{int(time.time())}"
    
    # Room metadata for the agent - THIS IS WHAT THE AGENT READS
    metadata = {
        "candidate_id": candidate_id,
        "candidate_name": candidate_name,
        "questions": questions,
        "resume_context": resume_context,
    }
    
    try:
        # Create room with metadata BEFORE the participant joins
        await create_room_with_metadata(room_name, metadata)
    except Exception as e:
        logger.error(f"Non-critical: Failed to create room with metadata: {e}")
    
    # Generate participant token WITH METADATA (Backup)
    token = create_room_token(
        room_name=room_name,
        participant_identity=f"candidate-{candidate_id}",
        participant_name=candidate_name,
        metadata=metadata,
    )
    
    # Create session
    session = LiveKitSession(
        candidate_id=candidate_id,
        room_name=room_name,
        token=token,
        questions=questions,
    )
    
    sessions[candidate_id] = session
    logger.info(f"Created session for {candidate_name} in room {room_name} with {len(questions)} questions")
    
    return session




def get_session(candidate_id: str) -> Optional[LiveKitSession]:
    """Get an existing session by candidate ID."""
    return sessions.get(candidate_id)


def update_session_field(candidate_id: str, field_name: str, field_value: Any):
    """Update a field in a session's extracted data."""
    session = sessions.get(candidate_id)
    if session:
        session.extracted_fields[field_name] = field_value
        logger.info(f"Updated {field_name} for {candidate_id}: {field_value}")


def get_livekit_url() -> str:
    """Get the LiveKit WebSocket URL."""
    return LIVEKIT_URL
