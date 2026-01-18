# Phase 2: Backend Integration

## Goal

Modify the backend to:
1. Accept a `role` parameter when starting interviews
2. Dispatch the correct agent based on role
3. Store role in interview records

## Prerequisites

- Phase 1 complete (`interviewer_agent.py` working in isolation)

## Files to Modify

```
backend/
├── main.py           # API endpoints
├── models.py         # Pydantic models
└── database.py       # Interview record storage
```

## Implementation

### Step 1: Update Models

Add role to the interview start request model in `backend/models.py`:

```python
from enum import Enum

class InterviewRole(str, Enum):
    INTERVIEWER = "interviewer"  # Human is interviewer, AI is candidate
    CANDIDATE = "candidate"      # Human is candidate, AI is interviewer


class InterviewStartRequest(BaseModel):
    candidate_id: str
    job_id: Optional[str] = None
    stage: str = "screening"
    role: InterviewRole = InterviewRole.INTERVIEWER  # Default to current behavior
```

### Step 2: Update Interview Start Endpoint

Modify the interview start endpoint in `backend/main.py`:

```python
@app.post("/api/interviews/start")
async def start_interview(request: InterviewStartRequest):
    """Start an interview session with role-based agent dispatch."""

    # ... existing candidate/job lookup code ...

    # Generate room name
    room_name = f"interview-{request.candidate_id[:8]}-{int(datetime.now().timestamp())}"

    # Build metadata based on role
    room_metadata = {
        "candidate_id": request.candidate_id,
        "candidate_name": candidate.name,
        "job_id": request.job_id,
        "job_title": job.title if job else "",
        "job_description": job.description if job else "",
        "skills": job.skills if job else [],
        "resume_context": candidate.resume_text or "",
        "stage": request.stage,
        "role": request.role.value,  # Store which role the human is playing
    }

    # Create LiveKit room
    room = await livekit_api.room.create_room(
        api.CreateRoomRequest(
            name=room_name,
            metadata=json.dumps(room_metadata),
        )
    )

    # Determine which agent to dispatch based on role
    if request.role == InterviewRole.INTERVIEWER:
        # Human is interviewer -> spawn AI candidate
        agent_name = "interview-agent"
    else:
        # Human is candidate -> spawn AI interviewer
        agent_name = "interviewer-agent"

    # Dispatch the agent (agents auto-join rooms matching their name pattern)
    # The agent selection happens via LiveKit's job dispatch mechanism
    # Agents register with specific job types/names

    # Generate token for the human participant
    human_identity = f"human-{request.role.value}"
    token = generate_livekit_token(
        room_name=room_name,
        participant_identity=human_identity,
        metadata=json.dumps({
            "role": request.role.value,
            "candidate_name": candidate.name,
        })
    )

    # Store interview record
    interview_id = str(uuid.uuid4())
    interview_record = {
        "id": interview_id,
        "room_name": room_name,
        "candidate_id": request.candidate_id,
        "job_id": request.job_id,
        "stage": request.stage,
        "role": request.role.value,  # NEW: Track role
        "status": "active",
        "started_at": datetime.now().isoformat(),
    }

    # Save to database
    await save_interview(interview_record)

    return {
        "interview_id": interview_id,
        "room_name": room_name,
        "room_url": f"wss://{LIVEKIT_URL}",
        "token": token,
        "role": request.role.value,
        "agent_type": agent_name,
    }
```

### Step 3: Configure Agent Dispatch

LiveKit agents use job dispatch to determine which rooms to join. Update agent registration to handle role-based dispatch.

**Option A: Name-based routing (simpler)**

Each agent listens for rooms with specific prefixes:

```python
# In interview_agent.py - add room name filter
if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            # Only join rooms that need a candidate agent
            job_request_fnc=lambda req: req.room.name.startswith("interview-")
                and req.room.metadata.get("role") == "interviewer"
        ),
    )
```

```python
# In interviewer_agent.py - add room name filter
if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            # Only join rooms that need an interviewer agent
            job_request_fnc=lambda req: req.room.name.startswith("interview-")
                and req.room.metadata.get("role") == "candidate"
        ),
    )
```

**Option B: Agent type in room name (more explicit)**

Encode agent type in room name:

```python
# Backend generates room name based on role
if request.role == InterviewRole.INTERVIEWER:
    room_name = f"candidate-interview-{...}"  # Needs candidate agent
else:
    room_name = f"interviewer-interview-{...}"  # Needs interviewer agent
```

```python
# interview_agent.py
job_request_fnc=lambda req: req.room.name.startswith("candidate-interview-")

# interviewer_agent.py
job_request_fnc=lambda req: req.room.name.startswith("interviewer-interview-")
```

### Step 4: Update Interview Database Schema

If using Supabase, add the role column:

```sql
-- Migration: Add role column to interviews table
ALTER TABLE interviews
ADD COLUMN role TEXT DEFAULT 'interviewer'
CHECK (role IN ('interviewer', 'candidate'));

-- Update existing records
UPDATE interviews SET role = 'interviewer' WHERE role IS NULL;
```

### Step 5: Update Analytics Endpoint

Ensure analytics endpoint handles both roles:

```python
@app.post("/api/interviews/{interview_id}/analytics")
async def generate_analytics(interview_id: str, request: AnalyticsRequest):
    """Generate post-interview analytics."""

    interview = await get_interview(interview_id)
    role = interview.get("role", "interviewer")

    # Analytics prompt may differ based on role
    if role == "interviewer":
        # Evaluate the AI candidate's performance
        analysis_prompt = CANDIDATE_EVALUATION_PROMPT
    else:
        # Evaluate the human candidate's performance
        analysis_prompt = CANDIDATE_EVALUATION_PROMPT  # Same prompt works
        # Or use a different prompt for coaching feedback

    # ... rest of analytics generation ...
```

## API Changes Summary

### Request

```http
POST /api/interviews/start
Content-Type: application/json

{
    "candidate_id": "uuid-here",
    "job_id": "uuid-here",
    "stage": "screening",
    "role": "interviewer"  // NEW: "interviewer" or "candidate"
}
```

### Response

```json
{
    "interview_id": "uuid",
    "room_name": "interview-abc123-1234567890",
    "room_url": "wss://livekit.example.com",
    "token": "jwt-token-here",
    "role": "interviewer",
    "agent_type": "interview-agent"
}
```

## Testing

### Test Interviewer Mode (Current Behavior)

```bash
curl -X POST http://localhost:8000/api/interviews/start \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "test-candidate-id",
    "job_id": "test-job-id",
    "role": "interviewer"
  }'

# Should return agent_type: "interview-agent"
# interview_agent.py should join the room
```

### Test Candidate Mode (New Behavior)

```bash
curl -X POST http://localhost:8000/api/interviews/start \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "test-candidate-id",
    "job_id": "test-job-id",
    "role": "candidate"
  }'

# Should return agent_type: "interviewer-agent"
# interviewer_agent.py should join the room
```

## Verification Checklist

- [ ] `/api/interviews/start` accepts `role` parameter
- [ ] Default role is `interviewer` (backward compatible)
- [ ] Room metadata includes role
- [ ] Correct agent joins based on role
- [ ] Interview record stores role
- [ ] Analytics work for both roles

## Next Phase

Once backend integration is complete, proceed to [Phase 3: Frontend Integration](./phase3-frontend-integration.md) to add the role selection UI.
