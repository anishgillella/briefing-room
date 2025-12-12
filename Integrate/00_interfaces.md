# Phase 0: Shared Interfaces & Data Models

This document defines the shared data models and API contracts between Pluto and Briefing Room.

---

## 📦 Candidate Data Model

The unified candidate model combines Pluto's scoring fields with Briefing Room's interview fields.

### Core Candidate Interface

```typescript
// Shared between frontend and backend
interface Candidate {
  // Identity
  id: string;                    // UUID
  name: string;
  email?: string;
  linkedin_url?: string;
  
  // Extracted from resume (Pluto)
  current_role?: string;
  current_company?: string;
  years_experience?: number;
  industries?: string[];
  skills?: string[];
  education?: string;
  bio?: string;
  
  // Pluto Scoring
  algo_score?: number;           // 0-100, algorithmic
  ai_score?: number;             // 0-100, LLM evaluation
  combined_score?: number;       // Average of both
  tier?: "Top Tier" | "Strong" | "Good" | "Evaluate" | "Poor";
  
  // Data Quality (Pluto)
  missing_required?: string[];   // Fields that need filling
  missing_preferred?: string[];
  red_flags?: string[];
  completeness?: number;         // 0-100%
  
  // Interview Status (Briefing Room)
  interview_status?: "not_scheduled" | "briefing" | "in_progress" | "completed";
  room_name?: string;            // Associated interview room
  interview_score?: number;      // From debrief
  recommendation?: "Strong Hire" | "Hire" | "Leaning Hire" | "Leaning No Hire" | "No Hire";
  
  // Metadata
  created_at: string;            // ISO timestamp
  updated_at: string;
  source: "csv_upload" | "manual" | "voice_enriched";
}
```

### Backend Python Model (Pydantic)

```python
# backend/models/candidate.py
from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime

class Candidate(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    
    # Extracted data
    current_role: Optional[str] = None
    current_company: Optional[str] = None
    years_experience: Optional[int] = None
    industries: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    education: Optional[str] = None
    bio: Optional[str] = None
    
    # Scoring
    algo_score: Optional[int] = None
    ai_score: Optional[int] = None
    combined_score: Optional[int] = None
    tier: Optional[str] = None
    
    # Data Quality
    missing_required: Optional[List[str]] = None
    missing_preferred: Optional[List[str]] = None
    red_flags: Optional[List[str]] = None
    completeness: Optional[int] = None
    
    # Interview
    interview_status: Literal["not_scheduled", "briefing", "in_progress", "completed"] = "not_scheduled"
    room_name: Optional[str] = None
    interview_score: Optional[int] = None
    recommendation: Optional[str] = None
    
    # Metadata
    created_at: datetime
    updated_at: datetime
    source: Literal["csv_upload", "manual", "voice_enriched"] = "csv_upload"
```

---

## 🔌 API Contracts

### Pluto Endpoints (to be mounted at `/api/pluto/...`)

| Method | Endpoint | Request | Response | Description |
|--------|----------|---------|----------|-------------|
| POST | `/upload` | `multipart/form-data` (CSV file) | `{status, message}` | Upload candidate CSV |
| GET | `/status` | - | `{status, progress, phase, ...}` | Get processing status |
| GET | `/results` | - | `Candidate[]` | Get ranked candidates |
| GET | `/candidates/{id}` | - | `Candidate` | Get specific candidate |
| PATCH | `/candidates/{id}` | `Partial<Candidate>` | `Candidate` | Update candidate |
| POST | `/candidates/{id}/interview` | - | `{room_name, token}` | Create interview for candidate |

### Existing Briefing Room Endpoints (unchanged)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/rooms` | Create interview room |
| POST | `/rooms/{name}/join` | Join room |
| GET/POST | `/rooms/{name}/briefing` | Get/set briefing |
| POST | `/rooms/{name}/debrief` | Generate debrief |
| POST | `/prebrief/{name}` | Generate pre-interview brief |
| POST | `/analytics/{name}` | Get interview analytics |
| POST | `/coach/suggest` | Get coaching suggestion |

### New Integration Endpoint

| Method | Endpoint | Request | Response | Description |
|--------|----------|---------|----------|-------------|
| POST | `/pluto/candidates/{id}/interview` | - | `{room_name, token, room_url}` | Create interview room pre-populated with candidate data |

---

## 🗂️ Data Storage (JSON)

### File: `backend/data/candidates.json`

```json
{
  "candidates": [
    {
      "id": "uuid-1",
      "name": "Sarah Chen",
      "current_role": "Senior AE",
      "algo_score": 85,
      "ai_score": 78,
      "combined_score": 82,
      "tier": "Top Tier",
      "interview_status": "not_scheduled",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "source": "csv_upload"
    }
  ],
  "last_updated": "2024-01-15T10:30:00Z"
}
```

---

## 🔗 Data Flow

```
CSV Upload → Pluto Extract → Pluto Score → candidates.json
                                               ↓
                                    [Select for Interview]
                                               ↓
                              Create Room + Set Briefing (auto-populate)
                                               ↓
                                    Pre-Interview Brief
                                               ↓
                                      Video Interview
                                               ↓
                              Debrief → Update candidate in JSON
```

---

## 🛠️ Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/models/candidate.py` | CREATE | Unified Candidate model |
| `backend/data/candidates.json` | CREATE | JSON storage |
| `frontend/src/lib/types.ts` | MODIFY | Add Candidate TypeScript interface |
| `frontend/src/lib/api.ts` | MODIFY | Add Pluto API functions |
