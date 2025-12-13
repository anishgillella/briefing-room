# API Endpoints Reference

## Base URL
- **Development**: `http://localhost:8000/api`
- **Production**: `https://api.superposition.ai/api`

---

## Pluto - Candidate Scoring

### Upload & Score
```
POST /pluto/upload
```
Upload CSV and start scoring pipeline.

**Request**: `multipart/form-data` with `file` field

**Response**:
```json
{
  "message": "Processing started",
  "total_candidates": 50
}
```

---

### Get Status
```
GET /pluto/status
```
Get current processing status with streamed results.

**Response**:
```json
{
  "status": "scoring",
  "phase": "ai_scoring",
  "progress": 75,
  "message": "Scoring candidate 38 of 50",
  "candidates_total": 50,
  "candidates_extracted": 50,
  "candidates_scored": 37,
  "extracted_preview": [...],
  "scored_candidates": [...],
  "algo_ranked": [...]
}
```

---

### Get Results
```
GET /pluto/results
```
Get all ranked candidates.

**Response**:
```json
{
  "candidates": [
    {
      "id": "uuid",
      "name": "John Doe",
      "algo_score": 85,
      "ai_score": 78,
      "final_score": 82,
      "...": "..."
    }
  ]
}
```

---

### Get Candidate Detail
```
GET /pluto/candidates/{candidate_id}
```
Get full candidate profile.

**Response**: Full `Candidate` object with all fields.

---

### Generate Interview Questions
```
GET /pluto/candidates/{candidate_id}/questions
```
Get AI-generated interview questions (lazy loaded).

**Response**:
```json
{
  "questions": [
    {
      "question": "Tell me about your experience with enterprise sales",
      "purpose": "Assess enterprise selling methodology"
    }
  ]
}
```

---

## Pre-Briefing

### Generate Pre-Brief
```
POST /prebrief/{room_name}
```
Generate comprehensive pre-interview briefing.

**Request**:
```json
{
  "job_description": "Full JD text...",
  "resume": "Candidate resume text...",
  "company_context": "Optional culture info"
}
```

**Response**: `PreInterviewBrief` object

---

### Get Cached Pre-Brief
```
GET /pluto/candidates/{candidate_id}/prebrief
```
Get or generate pre-brief for a candidate.

**Response**: `PreInterviewBrief` object

---

## Interview Room

### Create Room
```
POST /rooms
```
Create a new Daily.co interview room.

**Request**:
```json
{
  "interviewer_name": "string",
  "candidate_name": "optional"
}
```

**Response**:
```json
{
  "room_name": "interview-abc123",
  "room_url": "https://superposition.daily.co/interview-abc123",
  "interviewer_token": "jwt...",
  "expires_at": "2024-12-13T00:00:00Z"
}
```

---

### Join Room
```
POST /rooms/{room_name}/join
```
Get token to join existing room.

**Request**:
```json
{
  "participant_name": "string",
  "participant_type": "interviewer|candidate"
}
```

**Response**:
```json
{
  "token": "jwt...",
  "room_url": "https://..."
}
```

---

### Start Interview (with Candidate Context)
```
POST /pluto/candidates/{candidate_id}/interview
```
Create room with candidate context loaded.

**Request**:
```json
{
  "interviewer_name": "string",
  "use_prebrief": true
}
```

**Response**:
```json
{
  "room_name": "interview-abc123",
  "room_url": "...",
  "token": "...",
  "realtime_session": {
    "client_secret": "...",
    "session_id": "..."
  }
}
```

---

## OpenAI Realtime

### Create Session
```
POST /realtime/session
```
Create ephemeral OpenAI Realtime session.

**Request**:
```json
{
  "candidate_name": "John Doe",
  "role": "Account Executive",
  "resume": "Resume text...",
  "job_description": "JD text..."
}
```

**Response**:
```json
{
  "client_secret": "ephemeral_token",
  "session_id": "sess_abc123",
  "model": "gpt-4o-realtime-preview",
  "modalities": ["audio", "text"]
}
```

---

## Analytics

### Get Interview Analytics
```
POST /analytics/{room_name}
```
Analyze interview transcript.

**Request**:
```json
{
  "transcript": "Full interview transcript...",
  "job_description": "Optional JD",
  "resume": "Optional resume"
}
```

**Response**: `InterviewAnalytics` object

---

### Save Analytics (Internal)
```
POST /pluto/candidates/{candidate_id}/analytics
```
Save analytics and update candidate.

**Request**:
```json
{
  "interview_id": "uuid",
  "analytics": {...}
}
```

---

## Candidate Intake

### Generate Intake Link
```
POST /pluto/candidates/{candidate_id}/intake-link
```
Generate secure intake link for candidate.

**Response**:
```json
{
  "intake_url": "https://app.../intake/{id}?token={jwt}",
  "expires_at": "2024-12-15T00:00:00Z"
}
```

---

### Validate Intake Token
```
GET /intake/{candidate_id}/validate?token={jwt}
```
Validate intake token and get candidate info.

**Response**:
```json
{
  "valid": true,
  "candidate_name": "John Doe",
  "gaps": ["phone", "years_experience"]
}
```

---

### Get LiveKit Token (for Intake)
```
POST /livekit/token
```
Get LiveKit token for voice intake session.

**Request**:
```json
{
  "candidate_id": "uuid"
}
```

**Response**:
```json
{
  "token": "livekit_jwt",
  "room_name": "intake-abc123",
  "livekit_url": "wss://...",
  "questions": ["What is your phone number?", "..."]
}
```

---

## Chat Assistant

### Chat During Interview
```
POST /rooms/{room_name}/chat
```
Chat with AI assistant during interview.

**Request**:
```json
{
  "message": "What should I ask about their experience?",
  "context": "Optional briefing context",
  "history": [{"role": "user", "content": "..."}]
}
```

**Response**:
```json
{
  "response": "Based on their resume, you might ask..."
}
```

---

## Exports

### Download CSV
```
GET /pluto/results/csv
```
Download ranked candidates as CSV.

**Response**: CSV file download
