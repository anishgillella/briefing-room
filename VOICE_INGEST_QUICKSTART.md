# Voice Ingest Feature - Local Development Quickstart

## Prerequisites
- Python 3.12+
- Node.js 18+
- npm

## 1. Backend Setup

### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Configure Environment
The `.env` file is already created with dummy Supabase values. You can start the backend immediately!

**Optional**: Add your API keys to `.env` for full functionality:
```bash
# Edit backend/.env and add:
OPENROUTER_API_KEY=your_key_here
DEEPGRAM_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
PARALLEL_API_KEY=your_key_here
```

### Start Backend
```bash
cd backend
uvicorn main:app --reload
```

Backend will run at: **http://localhost:8000**
API Docs: **http://localhost:8000/docs**

---

## 2. Frontend Setup

### Install Dependencies
```bash
cd frontend
npm install
npm install livekit-client
```

### Start Frontend
```bash
cd frontend
npm run dev
```

Frontend will run at: **http://localhost:3000**

---

## 3. Voice Agent (Optional)

The voice agent requires LiveKit. For local testing without LiveKit:
- Skip this step
- Use the JD paste flow instead of voice flow

### With LiveKit (Advanced)
```bash
cd backend
python -m agents.onboarding_agent dev
```

---

## Using the Voice Ingest Feature

### Option 1: Test with Voice Ingest API Only
```bash
# Start backend
cd backend
uvicorn main:app --reload

# Test the API
curl -X POST http://localhost:8000/api/voice-ingest/start \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "TestCorp",
    "company_website": "https://testcorp.com"
  }'
```

### Option 2: Full Stack with Frontend
```bash
# Terminal 1 - Backend
cd backend && uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend && npm run dev

# Open browser to http://localhost:3000/onboard
```

### Option 3: Run Tests
```bash
cd backend
python -m tests.test_voice_ingest
```

All 40 tests should pass!

---

## Data Storage

Voice ingest profiles are stored locally in:
```
backend/data/job_profiles.json
```

To use Supabase instead, set in `.env`:
```
USE_SUPABASE=true
```

---

## Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/voice-ingest/start` | POST | Start new session |
| `/api/voice-ingest/{session_id}` | GET | Get profile |
| `/api/voice-ingest/{session_id}/parse-jd` | POST | Parse job description |
| `/api/voice-ingest/{session_id}/voice-token` | POST | Get LiveKit token |
| `/api/voice-ingest/profiles` | GET | List all profiles |
| `/api/voice-ingest/ws/{session_id}` | WebSocket | Real-time updates |
| `/api/pluto/upload` | POST | Upload candidates (accepts `job_profile_id`) |

---

## Integration with Existing Candidate Upload

1. **Create Profile via Voice Ingest**:
   - Go to `/onboard`
   - Complete voice onboarding
   - Note the `profile_id`

2. **Upload Candidates with Profile**:
   - Go to main page `/`
   - Select the profile from dropdown
   - Upload CSV
   - Candidates scored with profile context!

---

## Troubleshooting

### Backend won't start
- Make sure `.env` exists in `backend/` directory
- Check Python version: `python --version` (should be 3.12+)

### Frontend errors
- Run `npm install` in frontend directory
- Make sure backend is running first

### Tests fail
- Set environment: `export USE_SUPABASE=false`
- Run from backend directory: `python -m tests.test_voice_ingest`

### Voice agent issues
- LiveKit is optional for initial testing
- Use JD paste flow to test without voice agent

---

## Quick Test Script

```bash
#!/bin/bash

# Test backend
cd backend
python -c "import main; print('✅ Backend OK')"

# Test imports
python -c "from repositories import job_profile_repo; print('✅ Repository OK')"

# Run tests
python -m tests.test_voice_ingest

# Start backend
echo "Starting backend on http://localhost:8000..."
uvicorn main:app --reload
```

---

## Architecture

```
Voice Ingest Flow:
├── Frontend (/onboard)
│   ├── IntakeForm → Collect name + company
│   ├── JDPastePanel → Optional JD paste
│   └── VoiceSession → LiveKit voice agent
│
├── Backend API
│   ├── /start → Create profile + trigger research
│   ├── /parse-jd → Extract from JD
│   ├── /voice-token → LiveKit token
│   └── WebSocket → Real-time updates
│
├── Storage (Local)
│   └── backend/data/job_profiles.json
│
└── Integration
    └── /api/pluto/upload (job_profile_id parameter)
```

---

## Next Steps

1. ✅ Backend running locally
2. ✅ Tests passing (40/40)
3. ✅ Local storage working
4. 📋 Add your API keys for full features
5. 📋 Set up LiveKit for voice agent
6. 📋 Test full voice → candidate upload flow
