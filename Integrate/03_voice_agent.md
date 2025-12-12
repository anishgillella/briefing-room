# Phase 3: Voice Agent Unification

Merge Pluto's gap-filling voice agent with Briefing Room's interviewer briefing agent into a single, mode-aware LiveKit agent.

> **Note:** This phase is optional and can be deferred. The core integration (Phases 1-2) works without this.

---

## 🎯 Goals

1. Single voice agent codebase with mode switching
2. **Gap-Filling Mode**: Call candidates to collect missing data
3. **Briefing Mode**: Prepare interviewers before interviews
4. Shared LiveKit infrastructure and token generation

---

## 📊 Current State

### Pluto Voice Agent (`Pluto/backend/livekit_agent.py`)
- Purpose: Call candidates to fill data gaps
- Prompts: "What was your quota attainment last year?"
- Updates: Writes to candidate's `extracted_data`
- Trigger: Recruiter clicks "Call Candidate" on candidates with missing fields

### Briefing Room Voice Agent (Vapi-based)
- Purpose: Brief interviewer before interview
- Prompts: "Here's what you should know about the candidate..."
- Mode: Read-only, delivers information
- Trigger: Interviewer clicks "Voice Briefing" in pre-brief screen

---

## 🏗️ Unified Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                   UNIFIED VOICE AGENT                          │
├────────────────────────────────────────────────────────────────┤
│  Entry Point: /api/voice/token                                 │
│                                                                │
│  ┌─────────────────────┐    ┌─────────────────────┐           │
│  │  GAP-FILLING MODE   │    │   BRIEFING MODE     │           │
│  │                     │    │                     │           │
│  │  User: Candidate    │    │  User: Interviewer  │           │
│  │  Goal: Collect data │    │  Goal: Deliver info │           │
│  │  Updates: JSON      │    │  Updates: None      │           │
│  └─────────────────────┘    └─────────────────────┘           │
│                                                                │
│  Shared: LiveKit SDK, OpenRouter LLM, Token generation         │
└────────────────────────────────────────────────────────────────┘
```

---

## 📁 Files to Create/Modify

```
backend/
├── routers/
│   └── voice.py                    # CREATE: Unified voice endpoints
├── services/
│   └── voice_agent.py              # CREATE: Unified agent logic
└── livekit_agent.py                # CREATE: LiveKit worker (from Pluto)
```

---

## 🔧 Implementation Steps

### Step 3.1: Create Voice Router

**File:** `backend/routers/voice.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal, Optional
from services.voice_agent import create_voice_session, VoiceMode

router = APIRouter(prefix="/voice", tags=["voice"])

class VoiceTokenRequest(BaseModel):
    mode: Literal["gap_filling", "briefing"]
    candidate_id: Optional[str] = None  # Required for gap_filling
    room_name: Optional[str] = None     # Required for briefing
    user_name: str                       # Name of the person joining

class VoiceTokenResponse(BaseModel):
    token: str
    room_name: str
    livekit_url: str
    mode: str

@router.post("/token")
async def get_voice_token(request: VoiceTokenRequest) -> VoiceTokenResponse:
    """
    Generate a LiveKit token for voice interaction.
    
    Modes:
    - gap_filling: Call candidate to collect missing data
    - briefing: Brief interviewer before interview
    """
    if request.mode == "gap_filling" and not request.candidate_id:
        raise HTTPException(status_code=400, detail="candidate_id required for gap_filling mode")
    
    if request.mode == "briefing" and not request.room_name:
        raise HTTPException(status_code=400, detail="room_name required for briefing mode")
    
    session = await create_voice_session(
        mode=VoiceMode(request.mode),
        candidate_id=request.candidate_id,
        room_name=request.room_name,
        user_name=request.user_name
    )
    
    return VoiceTokenResponse(
        token=session.token,
        room_name=session.room_name,
        livekit_url=session.livekit_url,
        mode=request.mode
    )

@router.get("/session/{room_name}/status")
async def get_session_status(room_name: str):
    """Get current status of a voice session (extracted data, etc.)"""
    # Return session state
    pass
```

---

### Step 3.2: Create Voice Agent Service

**File:** `backend/services/voice_agent.py`

```python
from enum import Enum
from dataclasses import dataclass
from typing import Optional
import os
from livekit import api

class VoiceMode(Enum):
    GAP_FILLING = "gap_filling"
    BRIEFING = "briefing"

@dataclass
class VoiceSession:
    token: str
    room_name: str
    livekit_url: str
    mode: VoiceMode

# LiveKit configuration
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://your-livekit-server.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

async def create_voice_session(
    mode: VoiceMode,
    user_name: str,
    candidate_id: Optional[str] = None,
    room_name: Optional[str] = None
) -> VoiceSession:
    """Create a LiveKit voice session with mode-specific configuration."""
    
    # Generate room name if not provided
    if not room_name:
        import uuid
        room_name = f"voice-{mode.value}-{uuid.uuid4().hex[:8]}"
    
    # Create room via LiveKit API
    room_service = api.RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    await room_service.create_room(api.CreateRoomRequest(name=room_name))
    
    # Generate token for user
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(user_name)
    token.with_name(user_name)
    token.with_grants(api.VideoGrants(
        room=room_name,
        room_join=True,
        can_publish=True,
        can_subscribe=True
    ))
    
    # Store session metadata for the agent worker
    await _store_session_metadata(room_name, {
        "mode": mode.value,
        "candidate_id": candidate_id,
        "user_name": user_name
    })
    
    return VoiceSession(
        token=token.to_jwt(),
        room_name=room_name,
        livekit_url=LIVEKIT_URL,
        mode=mode
    )

# Session metadata storage (in-memory for now)
_session_metadata = {}

async def _store_session_metadata(room_name: str, metadata: dict):
    _session_metadata[room_name] = metadata

async def get_session_metadata(room_name: str) -> Optional[dict]:
    return _session_metadata.get(room_name)
```

---

### Step 3.3: Create Unified LiveKit Agent Worker

**File:** `backend/livekit_agent.py`

```python
"""
Unified LiveKit Agent Worker

Runs as a separate process, connects to LiveKit rooms and handles voice interactions.

Modes:
- gap_filling: Interviews candidates to collect missing data
- briefing: Briefs interviewers on candidate information

Usage:
    python -m livekit_agent dev
"""

from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import openai, silero
from services.voice_agent import get_session_metadata, VoiceMode
from services.candidate_store import get_candidate, update_candidate

async def entrypoint(ctx: JobContext):
    """Entry point for the voice agent worker."""
    
    # Get session metadata to determine mode
    metadata = await get_session_metadata(ctx.room.name)
    if not metadata:
        print(f"No metadata found for room {ctx.room.name}")
        return
    
    mode = VoiceMode(metadata["mode"])
    candidate_id = metadata.get("candidate_id")
    
    # Build mode-specific system prompt
    if mode == VoiceMode.GAP_FILLING:
        candidate = get_candidate(candidate_id)
        system_prompt = build_gap_filling_prompt(candidate)
    else:  # BRIEFING
        from routers.rooms import _briefings_cache
        briefing = _briefings_cache.get(metadata.get("room_name", ""))
        system_prompt = build_briefing_prompt(briefing)
    
    # Initialize LLM
    llm_instance = openai.LLM(model="gpt-4o-mini")
    
    # Create voice assistant
    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=openai.STT(),
        llm=llm_instance,
        tts=openai.TTS(),
        chat_ctx=llm.ChatContext().append(
            role="system",
            text=system_prompt
        ),
    )
    
    # Set up function calling for gap-filling mode
    if mode == VoiceMode.GAP_FILLING:
        @assistant.llm.ai_callable()
        async def update_candidate_field(field_name: str, value: str):
            """Update a candidate field with collected data."""
            if candidate_id:
                update_candidate(candidate_id, {field_name: value})
                return f"Updated {field_name}"
            return "No candidate ID"
    
    # Connect to room
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    assistant.start(ctx.room)
    
    # Wait for session to end
    await assistant.say("Hello! " + get_greeting(mode), allow_interruptions=True)

def build_gap_filling_prompt(candidate: dict) -> str:
    """Build prompt for collecting missing candidate data."""
    missing = candidate.get("missing_required", [])
    name = candidate.get("name", "the candidate")
    
    return f"""You are a friendly recruiter assistant calling {name} to collect some missing information.

The following fields are missing from their profile:
{chr(10).join(f"- {field}" for field in missing)}

Your goal:
1. Politely introduce yourself
2. Ask about each missing field naturally
3. When you get an answer, use the update_candidate_field function to save it
4. Be conversational and professional

Keep the call brief (2-3 minutes max). Thank them when done."""

def build_briefing_prompt(briefing: dict) -> str:
    """Build prompt for briefing an interviewer."""
    if not briefing:
        return "You are helping an interviewer prepare, but no candidate information was provided."
    
    return f"""You are a briefing assistant helping an interviewer prepare for an interview.

Candidate: {briefing.get('candidate_name', 'Unknown')}
Role: {briefing.get('role', 'Not specified')}

Resume Summary:
{briefing.get('resume_summary', 'Not provided')}

Notes:
{briefing.get('notes', 'None')}

Your job:
1. Summarize the key points about this candidate
2. Highlight their strengths and potential concerns
3. Suggest 2-3 good opening questions
4. Answer any questions the interviewer has about the candidate

Be concise and helpful. The interviewer is about to start the interview."""

def get_greeting(mode: VoiceMode) -> str:
    if mode == VoiceMode.GAP_FILLING:
        return "This is a quick call to fill in some details on your profile."
    else:
        return "I'm here to brief you on your upcoming interview."

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

---

### Step 3.4: Mount Voice Router

**File:** `backend/main.py` (modify)

```python
from routers import voice

app.include_router(voice.router, prefix="/api")
```

---

### Step 3.5: Add Frontend Voice Components

**File:** `frontend/src/components/voice-call-button.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Loader2 } from "lucide-react";

interface VoiceCallButtonProps {
  mode: "gap_filling" | "briefing";
  candidateId?: string;
  roomName?: string;
  userName: string;
}

export function VoiceCallButton({ mode, candidateId, roomName, userName }: VoiceCallButtonProps) {
  const [calling, setCalling] = useState(false);
  const [inCall, setInCall] = useState(false);

  const startCall = async () => {
    setCalling(true);
    try {
      const response = await fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, candidate_id: candidateId, room_name: roomName, user_name: userName }),
      });
      const data = await response.json();
      
      // Connect to LiveKit room
      // ... LiveKit client connection logic
      
      setInCall(true);
    } catch (err) {
      console.error("Failed to start call", err);
    } finally {
      setCalling(false);
    }
  };

  const endCall = () => {
    // Disconnect from LiveKit
    setInCall(false);
  };

  return inCall ? (
    <Button variant="destructive" onClick={endCall}>
      <PhoneOff className="h-4 w-4 mr-2" /> End Call
    </Button>
  ) : (
    <Button onClick={startCall} disabled={calling}>
      {calling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Phone className="h-4 w-4 mr-2" />}
      {mode === "gap_filling" ? "Call Candidate" : "Voice Briefing"}
    </Button>
  );
}
```

---

## ✅ Verification Plan

### Manual Testing

1. **Gap-Filling Mode**
   - Select a candidate with missing fields
   - Click "Call Candidate"
   - Verify agent asks about missing fields
   - Check that candidate data is updated after call

2. **Briefing Mode**
   - Go to pre-interview briefing screen
   - Click "Voice Briefing"
   - Verify agent summarizes candidate information
   - Ask a follow-up question, verify coherent response

### Technical Checks

- [ ] LiveKit room created successfully
- [ ] Token grants are correct
- [ ] Agent worker connects and speaks
- [ ] Function calling updates candidate data (gap-filling)
- [ ] Session cleanup after disconnect

---

## 📋 Checklist

- [ ] Create `backend/routers/voice.py`
- [ ] Create `backend/services/voice_agent.py`
- [ ] Create `backend/livekit_agent.py`
- [ ] Mount voice router in `main.py`
- [ ] Create frontend `voice-call-button.tsx`
- [ ] Add "Call Candidate" button to candidate detail page
- [ ] Add "Voice Briefing" button to pre-briefing screen
- [ ] Test gap-filling mode end-to-end
- [ ] Test briefing mode end-to-end

---

## ⚠️ Dependencies

This phase requires:
- LiveKit Cloud or self-hosted server
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` environment variables
- `livekit-agents` Python package
- OpenAI API key for STT/TTS

If LiveKit is not configured, this phase can be skipped.
