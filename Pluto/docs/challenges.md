# Development Challenges & Solutions

This document captures the key challenges encountered during the development of TalentPluto's AI Voice Agent and how they were resolved.

---

## 1. VAPI Integration Issues

### Challenge
Initially attempted to use VAPI for voice agent functionality. Encountered persistent `"Meeting has ended due to ejection"` errors when starting voice calls.

### Root Cause
- VAPI's webhook-based function calling required ngrok for local development
- Complex configuration between VAPI dashboard and code
- Real-time updates weren't reflecting in the UI due to webhook latency

### Solution
**Migrated to LiveKit** - a more developer-friendly platform with:
- Direct Python agent execution (no webhooks required)
- Built-in data channels for real-time UI updates
- Local development without ngrok

---

## 2. OpenRouter API 401 "User Not Found" Error

### Challenge
Resume extraction failed with `Error code: 401 - {'error': {'message': 'User not found.', 'code': 401}}`

### Root Cause
Two separate issues:
1. **Old API key cached in memory** - The `--reload` flag only reloads Python files, not environment variables
2. **API key without credits** - The key worked for listing models but failed for chat completions

### Solution
1. Full server restart (not just reload) to pick up new `.env` values
2. Generated new API key with proper credits/permissions on OpenRouter

---

## 3. LiveKit Agents API Breaking Changes

### Challenge
Multiple `TypeError` and `ModuleNotFoundError` exceptions when implementing LiveKit agent:
- `No module named 'livekit.agents.pipeline'`
- `AgentSession.__init__() takes 1 positional argument but 2 were given`
- `AgentSession.start() got an unexpected keyword argument 'participant'`

### Root Cause
The `livekit-agents` library (v1.3.5) had different API signatures than documentation examples. The API had evolved significantly.

### Solution
Used Python introspection to discover correct API:
```python
import inspect
print(inspect.signature(AgentSession.__init__))
print(inspect.signature(AgentSession.start))
print(inspect.signature(Agent.__init__))
```

**Correct pattern discovered:**
```python
agent = Agent(
    instructions=system_prompt,
    vad=silero.VAD.load(),
    stt=deepgram.STT(api_key=...),
    llm=openai.LLM(...),
    tts=elevenlabs.TTS(...),
    tools=[my_function_tool],
)
session = AgentSession()
await session.start(agent, room=ctx.room)
```

---

## 4. OpenAI TTS Requires Direct API Key

### Challenge
`openai.OpenAIError: The api_key client option must be set either by passing api_key to the client or by setting the OPENAI_API_KEY environment variable`

### Root Cause
OpenRouter only supports **chat completions**, not **TTS (text-to-speech)**. The OpenAI TTS plugin requires a direct OpenAI API key.

### Solution
**Switched to Deepgram TTS** initially, then **upgraded to ElevenLabs TTS** for better voice quality:
```python
tts=elevenlabs.TTS(
    api_key=ELEVENLABS_API_KEY,
    model="eleven_turbo_v2_5",
    voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel voice
)
```

---

## 5. ElevenLabs TTS Parameter Names

### Challenge
`TypeError: TTS.__init__() got an unexpected keyword argument 'voice'`

### Root Cause
ElevenLabs plugin uses `voice_id` (not `voice`) and specific model names.

### Solution
Used introspection to find correct parameters:
```python
# Wrong
elevenlabs.TTS(voice="Rachel", model="eleven_flash_v2_5")

# Correct
elevenlabs.TTS(voice_id="21m00Tcm4TlvDq8ikWAM", model="eleven_turbo_v2_5")
```

---

## 6. Agent Not Speaking (Silent Connection)

### Challenge
Agent connected successfully to LiveKit room but user couldn't hear any audio.

### Root Cause
Two issues:
1. **Agent not greeting automatically** - The agent waited for user input instead of speaking first
2. **Frontend not subscribing to audio tracks** - The room connected but didn't attach the agent's audio output

### Solution

**Backend fix** - Explicit initial greeting:
```python
await session.say(
    f"Hi {first_name}! I'm Pluto, your AI interviewer..."
)
```

**Frontend fix** - Subscribe to agent's audio track:
```typescript
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind === Track.Kind.Audio) {
        const audioElement = track.attach();
        document.body.appendChild(audioElement);
    }
});

// Also enable microphone for two-way audio
await room.localParticipant.setMicrophoneEnabled(true);
```

---

## 7. Pydantic Validation Errors on Fallback

### Challenge
When resume extraction failed, the fallback `ResumeExtraction(name="Unknown")` threw:
`pydantic_core._pydantic_core.ValidationError: 1 validation error for ResumeExtraction - summary: Field required`

### Root Cause
The `ResumeExtraction` model requires the `summary` field, but the error fallback only provided `name`.

### Solution
Provided all required fields in the fallback:
```python
return ResumeExtraction(
    name="Unknown",
    summary="Resume extraction failed. Please try again.",
    email=None,
    phone=None,
    location=None,
    # ... all other fields with defaults
)
```

---

## 8. Port Conflicts and Zombie Processes

### Challenge
- `Port 3000 is in use by process`
- `Unable to acquire lock at .next/dev/lock, is another instance of next dev running?`

### Solution
Kill processes and remove lock files:
```bash
lsof -ti:3000,3001,8000 | xargs kill -9
rm -f frontend/.next/dev/lock
pkill -f "livekit_agent"
```

---

## Key Learnings

1. **Always use introspection** for unfamiliar APIs - `inspect.signature()` is invaluable
2. **Restart servers fully** when changing environment variables (not just reload)
3. **LiveKit requires explicit audio subscription** on the frontend to hear remote participants
4. **OpenRouter is LLM-only** - use dedicated services for TTS (ElevenLabs) and STT (Deepgram)
5. **Pydantic models need complete fallbacks** - don't assume optional fields
6. **Kill zombie processes** before debugging "port in use" errors

---

## Tech Stack Final Configuration

| Component | Service | Model/Config |
|-----------|---------|--------------|
| LLM | OpenRouter | `openai/gpt-4o-mini` |
| Resume Extraction | OpenRouter | `google/gemini-2.5-flash` |
| STT (Speech-to-Text) | Deepgram | Default model |
| TTS (Text-to-Speech) | ElevenLabs | `eleven_turbo_v2_5` (Rachel voice) |
| VAD (Voice Activity) | Silero | Default model |
| Voice Infrastructure | LiveKit Cloud | Agent v1.3.5 |
