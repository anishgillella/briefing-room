# Phase 1: Backend Merge

Mount Pluto's FastAPI routes into the main Briefing Room backend, sharing configuration and AI infrastructure.

---

## 🎯 Goals

1. Single FastAPI server running on port 8000
2. Pluto routes accessible at `/api/pluto/...`
3. Shared OpenRouter/AI configuration
4. Unified candidate data storage (`candidates.json`)

---

## 📁 Files to Modify/Create

### Backend Structure After Merge

```
backend/
├── main.py                      # MODIFY: Add Pluto router
├── config.py                    # MODIFY: Add any missing env vars
├── models/
│   ├── candidate.py             # CREATE: Unified Candidate model
│   └── ...existing models...
├── routers/
│   ├── pluto.py                 # CREATE: Pluto routes (extracted from Pluto/backend/server.py)
│   ├── rooms.py                 # KEEP
│   ├── prebrief.py              # KEEP
│   ├── analytics.py             # KEEP
│   ├── coach.py                 # KEEP
│   └── realtime.py              # KEEP
├── services/
│   ├── pluto_processor.py       # CREATE: Extract & score logic (from Pluto/backend/)
│   ├── candidate_store.py       # CREATE: JSON file operations
│   └── ...existing services...
├── data/
│   └── candidates.json          # CREATE: Candidate storage
└── requirements.txt             # MODIFY: Add any missing deps
```

---

## 🔧 Implementation Steps

### Step 1.1: Create Unified Candidate Model

**File:** `backend/models/candidate.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
import uuid

class Candidate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    
    # Resume data
    current_role: Optional[str] = None
    current_company: Optional[str] = None
    years_experience: Optional[int] = None
    industries: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    education: Optional[str] = None
    bio: Optional[str] = None
    
    # Pluto scoring
    algo_score: Optional[int] = None
    ai_score: Optional[int] = None
    combined_score: Optional[int] = None
    tier: Optional[str] = None
    
    # Data quality
    missing_required: Optional[List[str]] = None
    missing_preferred: Optional[List[str]] = None
    red_flags: Optional[List[str]] = None
    completeness: Optional[int] = None
    
    # Interview tracking
    interview_status: Literal["not_scheduled", "briefing", "in_progress", "completed"] = "not_scheduled"
    room_name: Optional[str] = None
    interview_score: Optional[int] = None
    recommendation: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    source: Literal["csv_upload", "manual", "voice_enriched"] = "csv_upload"
```

---

### Step 1.2: Create Candidate Store Service

**File:** `backend/services/candidate_store.py`

```python
import json
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from models.candidate import Candidate

DATA_FILE = Path(__file__).parent.parent / "data" / "candidates.json"

def _ensure_file():
    DATA_FILE.parent.mkdir(exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text('{"candidates": [], "last_updated": null}')

def save_candidates(candidates: List[Candidate]):
    _ensure_file()
    data = {
        "candidates": [c.model_dump() for c in candidates],
        "last_updated": datetime.utcnow().isoformat()
    }
    DATA_FILE.write_text(json.dumps(data, indent=2, default=str))

def get_all_candidates() -> List[Candidate]:
    _ensure_file()
    data = json.loads(DATA_FILE.read_text())
    return [Candidate(**c) for c in data.get("candidates", [])]

def get_candidate(candidate_id: str) -> Optional[Candidate]:
    candidates = get_all_candidates()
    return next((c for c in candidates if c.id == candidate_id), None)

def update_candidate(candidate_id: str, updates: dict) -> Optional[Candidate]:
    candidates = get_all_candidates()
    for i, c in enumerate(candidates):
        if c.id == candidate_id:
            updated = c.model_copy(update={**updates, "updated_at": datetime.utcnow()})
            candidates[i] = updated
            save_candidates(candidates)
            return updated
    return None

def add_candidates(new_candidates: List[Candidate]):
    existing = get_all_candidates()
    existing.extend(new_candidates)
    save_candidates(existing)
```

---

### Step 1.3: Create Pluto Router

**File:** `backend/routers/pluto.py`

Extract and adapt from `Pluto/backend/server.py`:

```python
from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from services.candidate_store import get_all_candidates, get_candidate, update_candidate
from services.pluto_processor import process_csv_upload
from models.candidate import Candidate

router = APIRouter(prefix="/pluto", tags=["pluto"])

# Processing state (in-memory for simplicity)
class ProcessingState:
    def __init__(self):
        self.status = "idle"
        self.progress = 0
        self.message = ""
        self.candidates_total = 0
        self.candidates_extracted = 0
        self.candidates_scored = 0

state = ProcessingState()

@router.post("/upload")
async def upload_csv(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload CSV and start processing pipeline."""
    # ... implementation from Pluto/backend/server.py
    pass

@router.get("/status")
async def get_status():
    """Get current processing status."""
    return {
        "status": state.status,
        "progress": state.progress,
        "message": state.message,
        "candidates_total": state.candidates_total,
        "candidates_extracted": state.candidates_extracted,
        "candidates_scored": state.candidates_scored,
    }

@router.get("/results")
async def get_results() -> List[Candidate]:
    """Get ranked candidates."""
    candidates = get_all_candidates()
    return sorted(candidates, key=lambda c: c.combined_score or 0, reverse=True)

@router.get("/candidates/{candidate_id}")
async def get_candidate_detail(candidate_id: str):
    """Get specific candidate."""
    candidate = get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate

@router.patch("/candidates/{candidate_id}")
async def update_candidate_detail(candidate_id: str, updates: dict):
    """Update candidate data."""
    candidate = update_candidate(candidate_id, updates)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate

@router.post("/candidates/{candidate_id}/interview")
async def start_interview(candidate_id: str):
    """Create interview room for candidate, pre-populated with their data."""
    candidate = get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Create room using existing rooms logic
    from services.daily import daily_service
    room = await daily_service.create_room()
    
    # Auto-populate briefing with candidate data
    # ... set briefing with candidate.name, candidate.bio, etc.
    
    # Update candidate status
    update_candidate(candidate_id, {
        "interview_status": "briefing",
        "room_name": room["name"]
    })
    
    return {
        "room_name": room["name"],
        "room_url": room["url"],
        "candidate": candidate
    }
```

---

### Step 1.4: Mount Router in main.py

**File:** `backend/main.py` (modify)

```python
# Add import
from routers import pluto

# Add router (after existing routers)
app.include_router(pluto.router, prefix="/api")
```

---

### Step 1.5: Copy Processing Logic

Copy and adapt these files from `Pluto/backend/`:

| Source | Destination | Changes |
|--------|-------------|---------|
| `extract_data.py` | `services/pluto_processor.py` | Refactor to use new Candidate model |
| `score_candidates.py` | `services/pluto_scorer.py` | Use shared OpenRouter config |

---

## ✅ Verification Plan

### 1. Unit Tests (None exist currently - propose manual)

### 2. Manual API Testing

After implementation, test these endpoints:

```bash
# 1. Health check
curl http://localhost:8000/health

# 2. Upload CSV (use sample from Pluto/backend/data/)
curl -X POST http://localhost:8000/api/pluto/upload \
  -F "file=@sample_candidates.csv"

# 3. Check status
curl http://localhost:8000/api/pluto/status

# 4. Get results (wait for processing)
curl http://localhost:8000/api/pluto/results

# 5. Get specific candidate
curl http://localhost:8000/api/pluto/candidates/{id}

# 6. Start interview for candidate
curl -X POST http://localhost:8000/api/pluto/candidates/{id}/interview
```

### 3. Verify Existing Endpoints Still Work

```bash
# Existing room creation should still work
curl -X POST http://localhost:8000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"interviewer_name": "Test"}'
```

---

## ⚠️ Potential Risks

| Risk | Mitigation |
|------|------------|
| Import conflicts between Pluto and Briefing Room dependencies | Check requirements.txt for version conflicts |
| Processing state collision | Keep Pluto state separate from room state |
| OpenRouter rate limits | Share client instance, add rate limiting |

---

## 📋 Checklist

- [ ] Create `backend/models/candidate.py`
- [ ] Create `backend/services/candidate_store.py`
- [ ] Create `backend/data/candidates.json` (empty initial)
- [ ] Create `backend/routers/pluto.py`
- [ ] Create `backend/services/pluto_processor.py` (from extract_data.py)
- [ ] Create `backend/services/pluto_scorer.py` (from score_candidates.py)
- [ ] Modify `backend/main.py` to mount Pluto router
- [ ] Update `backend/requirements.txt` if needed
- [ ] Test all endpoints manually
- [ ] Verify existing endpoints still work
