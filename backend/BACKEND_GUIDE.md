# Backend API Guide

## Overview
FastAPI backend providing REST APIs for room management, briefings, debriefs, and AI agent services.

## Structure

```
backend/
├── main.py           # FastAPI app entry point, CORS config
├── config.py         # Environment variables loader
├── requirements.txt  # Python dependencies
├── routers/          # API route handlers
│   └── rooms.py      # All room-related endpoints
└── services/         # Business logic & external integrations
    ├── daily.py      # Daily.co video room management
    ├── llm.py        # OpenRouter/LLM integration
    └── vapi.py       # Vapi voice agent (deprecated for candidate)
```

## Key Files

### `main.py`
- Creates FastAPI app
- Configures CORS (allow frontend at localhost:3000)
- Includes routers

### `routers/rooms.py`
Most important file. Contains all endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rooms` | POST | Create new room (Daily.co) |
| `/api/rooms/{name}` | GET | Check if room exists |
| `/api/rooms/{name}/join` | POST | Get join token |
| `/api/rooms/{name}/briefing` | POST | Save briefing data |
| `/api/rooms/{name}/briefing` | GET | Retrieve briefing |
| `/api/rooms/{name}/debrief` | POST | Generate AI debrief |
| `/api/rooms/{name}/chat` | POST | Chat with AI sidebar |

### `services/daily.py`
Handles Daily.co API integration:
- `create_room()` - Creates video room
- `get_room()` - Checks room existence
- `create_meeting_token()` - Generates participant token

### `services/llm.py`
OpenRouter integration for LLM calls:
- `generate_briefing_prompt()` - Creates interviewer prep
- `chat_with_context()` - AI sidebar responses
- `generate_debrief()` - Post-interview analysis

---

## Environment Variables

```env
DAILY_API_KEY=         # Daily.co API key
OPENROUTER_API_KEY=    # OpenRouter for LLM
OPENROUTER_MODEL=      # e.g., openai/gpt-4o-mini
OPENAI_API_KEY=        # For Realtime API (candidate agent)
```

---

## Challenges Faced

### 1. Vapi Server-Side SIP Limitation
**Problem**: Initially tried using Vapi's server-side API to dial into Daily rooms.
**Error**: Vapi's `call` endpoint only supports phone numbers, not SIP/WebRTC.
**Resolution**: Moved to frontend Vapi SDK, then switched to OpenAI Realtime.

### 2. CORS Configuration
**Problem**: Frontend couldn't reach backend due to CORS.
**Solution**: Added explicit CORS middleware with allowed origins.

### 3. Briefing Data Structure
**Problem**: Needed to store/retrieve candidate context between screens.
**Solution**: In-memory dictionary keyed by room name. Works for demo, but production should use database.

### 4. Transcript Handling
**Problem**: Debrief quality depended on having interview transcript.
**Solution**: Accept optional `transcript` in debrief request, passed from frontend.

---

## Running the Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## Future Improvements
- [ ] Add persistent database (Supabase/PostgreSQL)
- [ ] Add authentication middleware
- [ ] Add rate limiting
- [ ] Add OpenAI Realtime token endpoint
