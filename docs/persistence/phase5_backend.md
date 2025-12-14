# Phase 5: Backend Integration

This document covers updating FastAPI routes to use the database instead of JSON files.

## Overview

Replace all file I/O operations with database queries using the repositories from Phase 3.

---

## Files to Update

| File | Current | New |
|------|---------|-----|
| `routers/pluto.py` | `candidates.json` | `CandidateRepository` |
| `routers/pluto.py` | `prebriefs/{id}.json` | `PrebriefRepository` |
| `interview_agent.py` | File-based transcript save | `TranscriptRepository` |
| `routers/pluto.py` | `analytics/{id}_{ts}.json` | `AnalyticsRepository` |

---

## Step 1: Create Repository Instances

Add to `backend/routers/__init__.py`:

```python
from repositories.candidate_repository import CandidateRepository
from repositories.interview_repository import InterviewRepository
from repositories.job_repository import JobRepository

# Singleton instances
candidate_repo = CandidateRepository()
interview_repo = InterviewRepository()
job_repo = JobRepository()
```

---

## Step 2: Update Candidate Endpoints

### Before (File-based):
```python
def get_candidates():
    with open("data/candidates.json") as f:
        data = json.load(f)
    return data["candidates"]
```

### After (Database):
```python
from repositories import candidate_repo

@router.get("/candidates")
def list_candidates(
    tier: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """List candidates with optional filtering."""
    return candidate_repo.list_candidates(
        tier=tier,
        status=status,
        limit=limit,
        offset=offset
    )

@router.get("/candidates/{candidate_id}")
def get_candidate_detail(candidate_id: str):
    """Get a specific candidate by ID."""
    candidate = candidate_repo.get_by_id(UUID(candidate_id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate

@router.patch("/candidates/{candidate_id}")
def update_candidate(candidate_id: str, updates: CandidateUpdate):
    """Update a candidate's data."""
    candidate = candidate_repo.update(UUID(candidate_id), updates.model_dump(exclude_unset=True))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate
```

---

## Step 3: Update Pre-Brief Endpoint

### Before:
```python
def get_prebrief(candidate_id: str):
    path = f"data/prebriefs/{candidate_id}.json"
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None
```

### After:
```python
from repositories import candidate_repo
from repositories.prebrief_repository import PrebriefRepository

prebrief_repo = PrebriefRepository()

@router.get("/candidates/{candidate_id}/prebrief")
async def get_candidate_prebrief(candidate_id: str):
    """Get or generate a pre-interview briefing."""
    
    # Check for existing prebrief
    existing = prebrief_repo.get_by_candidate_id(UUID(candidate_id))
    if existing:
        return existing.content
    
    # Generate new prebrief
    candidate = candidate_repo.get_by_id(UUID(candidate_id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Get prior interview context
    prior_context = interview_repo.get_candidate_interviews(UUID(candidate_id))
    questions_asked = interview_repo.get_questions_asked(UUID(candidate_id))
    
    prebrief_content = await generate_prebrief(
        candidate,
        prior_interviews=prior_context,
        questions_to_avoid=[q["question_text"] for q in questions_asked]
    )
    
    # Save to database
    prebrief_repo.create({
        "candidate_id": str(candidate_id),
        "content": prebrief_content
    })
    
    return prebrief_content
```

---

## Step 4: Update Interview Start Endpoint

```python
@router.post("/candidates/{candidate_id}/interview/start")
async def start_interview(candidate_id: str, stage_id: str):
    """Create an interview session for a specific stage."""
    
    candidate = candidate_repo.get_by_id(UUID(candidate_id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Check if interview already exists for this stage
    existing = interview_repo.get_by_candidate_and_stage(
        UUID(candidate_id), 
        UUID(stage_id)
    )
    if existing:
        raise HTTPException(status_code=400, detail="Interview already exists for this stage")
    
    # Create interview record
    room_name = f"interview_{candidate_id}_{stage_id}_{int(time.time())}"
    interview = interview_repo.create({
        "candidate_id": candidate_id,
        "stage_id": stage_id,
        "room_name": room_name,
        "status": "scheduled"
    })
    
    # Generate LiveKit token
    token = generate_livekit_token(room_name)
    
    return {
        "interview_id": interview.id,
        "room_name": room_name,
        "token": token,
        "livekit_url": LIVEKIT_URL
    }
```

---

## Step 5: Update Analytics Save

### Before:
```python
def save_analytics(candidate_id: str, analytics: dict):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = f"data/analytics/{candidate_id}_{timestamp}.json"
    with open(path, "w") as f:
        json.dump(analytics, f)
```

### After:
```python
from repositories.analytics_repository import AnalyticsRepository

analytics_repo = AnalyticsRepository()

@router.post("/interviews/{interview_id}/analytics")
async def save_interview_analytics(interview_id: str, transcript: str):
    """Generate and save deep analytics for an interview."""
    
    interview = interview_repo.get_by_id(UUID(interview_id))
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Get candidate for context
    candidate = candidate_repo.get_by_id(interview.candidate_id)
    
    # Generate analytics
    deep_analytics = await generate_deep_analytics(
        transcript=transcript,
        candidate_data=candidate.model_dump(),
        job_description=get_job_description(candidate.job_posting_id)
    )
    
    # Save to database
    analytics_repo.create({
        "interview_id": interview_id,
        "overall_score": deep_analytics.overall_score,
        "recommendation": deep_analytics.recommendation,
        "synthesis": deep_analytics.overall_synthesis,
        "question_analytics": [qa.model_dump() for qa in deep_analytics.question_analytics],
        "skill_evidence": [se.model_dump() for se in deep_analytics.skill_evidence],
        "behavioral_profile": deep_analytics.behavioral_profile.model_dump(),
        "topics_to_probe": deep_analytics.topics_to_probe
    })
    
    # Extract and save questions asked
    for qa in deep_analytics.question_analytics:
        questions_asked_repo.create({
            "interview_id": interview_id,
            "question_text": qa.question,
            "topic": qa.topic,
            "answer_quality": qa.quality_score // 10,  # Convert 0-100 to 0-10
            "follow_up_needed": qa.quality_score < 70
        })
    
    # Update interview status
    interview_repo.update(UUID(interview_id), {
        "status": "completed",
        "ended_at": datetime.now().isoformat()
    })
    
    return deep_analytics
```

---

## Step 6: Update Transcript Save (interview_agent.py)

```python
from repositories.transcript_repository import TranscriptRepository

transcript_repo = TranscriptRepository()

class InterviewAgent:
    async def save_transcript(self, interview_id: str, turns: list):
        """Save transcript to database."""
        full_text = "\n".join([
            f"{t['speaker']}: {t['text']}" for t in turns
        ])
        
        transcript_repo.create({
            "interview_id": interview_id,
            "turns": turns,
            "full_text": full_text
        })
```

---

## Step 7: Multi-Stage Context Endpoint

New endpoint to get full context for an interviewer:

```python
@router.get("/candidates/{candidate_id}/interview-context")
async def get_interview_context(candidate_id: str, current_stage_id: str):
    """Get accumulated context from all prior interview stages."""
    
    candidate = candidate_repo.get_by_id(UUID(candidate_id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Get current stage order
    current_stage = interview_repo.get_stage_by_id(UUID(current_stage_id))
    
    # Get all prior interviews
    prior_interviews = interview_repo.get_candidate_interviews(UUID(candidate_id))
    prior_interviews = [
        i for i in prior_interviews 
        if i["interview_stages"]["sequence_order"] < current_stage.sequence_order
    ]
    
    # Get questions already asked
    questions_asked = interview_repo.get_questions_asked(UUID(candidate_id))
    
    # Get accumulated topics to probe
    topics_to_probe = interview_repo.get_topics_to_probe(
        UUID(candidate_id), 
        current_stage.sequence_order
    )
    
    return {
        "candidate": candidate,
        "current_stage": current_stage,
        "prior_interviews": prior_interviews,
        "questions_to_avoid": [q["question_text"] for q in questions_asked],
        "topics_to_explore": topics_to_probe,
        "score_history": [
            {"stage": i["interview_stages"]["name"], "score": i.get("analytics", {}).get("overall_score")}
            for i in prior_interviews
        ]
    }
```

---

## Testing

```bash
# Test candidate endpoints
curl http://localhost:8000/api/pluto/candidates
curl http://localhost:8000/api/pluto/candidates/{id}

# Test interview context
curl http://localhost:8000/api/pluto/candidates/{id}/interview-context?current_stage_id={stage_id}
```

---

## Next: [Phase 6 - Frontend Updates](./phase6_frontend.md)
