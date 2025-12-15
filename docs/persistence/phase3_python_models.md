# Phase 3: Python Models

This document defines the Pydantic models and repository patterns for database operations.

## Model Structure

```
backend/
├── models/
│   ├── __init__.py
│   ├── base.py           # Base model with common fields
│   ├── job_posting.py
│   ├── interview_stage.py
│   ├── candidate.py
│   ├── prebrief.py
│   ├── interview.py
│   ├── transcript.py
│   ├── analytics.py
│   └── questions_asked.py
└── repositories/
    ├── __init__.py
    ├── base.py           # Generic CRUD operations
    ├── job_repository.py
    ├── candidate_repository.py
    └── interview_repository.py
```

---

## Base Model

`backend/models/base.py`:

```python
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field

class DBModel(BaseModel):
    """Base model for all database entities."""
    id: UUID = Field(default_factory=uuid4)
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True  # Enable ORM mode
```

---

## Core Models

### Job Posting

`backend/models/job_posting.py`:

```python
from typing import Optional, List
from pydantic import Field
from .base import DBModel

class ScoringCriteria(BaseModel):
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    min_years_experience: Optional[int] = None
    target_industries: List[str] = []

class JobPosting(DBModel):
    """Job posting that candidates are evaluated against."""
    title: str
    description: str
    company_context: Optional[str] = None
    scoring_criteria: ScoringCriteria = Field(default_factory=ScoringCriteria)

class JobPostingCreate(BaseModel):
    """Create payload for job posting."""
    title: str
    description: str
    company_context: Optional[str] = None
```

### Interview Stage

`backend/models/interview_stage.py`:

```python
from typing import Optional, List
from uuid import UUID
from pydantic import Field
from .base import DBModel

class InterviewStage(DBModel):
    """A stage in the interview pipeline."""
    job_posting_id: UUID
    name: str  # "Phone Screen", "Technical", "Behavioral"
    sequence_order: int
    focus_areas: List[str] = []
    duration_min: int = 45
    interviewer_role: Optional[str] = None

class InterviewStageCreate(BaseModel):
    """Create payload for interview stage."""
    name: str
    sequence_order: int
    focus_areas: List[str] = []
    duration_min: int = 45
    interviewer_role: Optional[str] = None
```

### Candidate

`backend/models/candidate.py`:

```python
from typing import Optional, List
from uuid import UUID
from pydantic import Field
from .base import DBModel

class Candidate(DBModel):
    """A candidate being evaluated."""
    job_posting_id: Optional[UUID] = None
    name: str
    email: Optional[str] = None
    job_title: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    years_experience: Optional[float] = None
    bio_summary: Optional[str] = None
    skills: List[str] = []
    industries: List[str] = []
    
    # Scoring
    algo_score: Optional[int] = None
    ai_score: Optional[int] = None
    combined_score: Optional[int] = None
    tier: Optional[str] = None
    
    # AI Analysis
    one_line_summary: Optional[str] = None
    pros: List[str] = []
    cons: List[str] = []
    
    # Pipeline
    pipeline_status: str = "new"

class CandidateUpdate(BaseModel):
    """Update payload for candidate."""
    pipeline_status: Optional[str] = None
    tier: Optional[str] = None
    ai_score: Optional[int] = None
```

### Interview

`backend/models/interview.py`:

```python
from datetime import datetime
from typing import Optional
from uuid import UUID
from .base import DBModel

class Interview(DBModel):
    """An interview session for a candidate at a specific stage."""
    candidate_id: UUID
    stage_id: UUID
    interviewer_name: Optional[str] = None
    room_name: Optional[str] = None
    status: str = "scheduled"  # scheduled, active, completed, cancelled
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_sec: Optional[int] = None

class InterviewCreate(BaseModel):
    """Create payload for interview."""
    candidate_id: UUID
    stage_id: UUID
    interviewer_name: Optional[str] = None
```

### Transcript

`backend/models/transcript.py`:

```python
from typing import List
from uuid import UUID
from pydantic import BaseModel, Field
from .base import DBModel

class TranscriptTurn(BaseModel):
    """A single turn in the transcript."""
    speaker: str  # "agent" or "candidate"
    text: str
    timestamp: float

class Transcript(DBModel):
    """Full interview transcript."""
    interview_id: UUID
    turns: List[TranscriptTurn] = []
    full_text: str = ""
```

### Analytics

`backend/models/analytics.py`:

```python
from typing import Optional, List, Dict
from uuid import UUID
from pydantic import BaseModel, Field
from .base import DBModel

class QuestionAnalysis(BaseModel):
    """Analysis of a single Q&A exchange."""
    question: str
    answer_summary: str
    topic: str
    quality_score: int = Field(ge=0, le=100)
    relevance_score: int = Field(ge=0, le=10)
    clarity_score: int = Field(ge=0, le=10)
    depth_score: int = Field(ge=0, le=10)
    key_insight: str

class SkillEvidence(BaseModel):
    """Evidence for a skill from the interview."""
    skill: str
    quote: str
    confidence: str  # High, Medium, Low

class BehavioralProfile(BaseModel):
    """Radar chart data for soft skills."""
    leadership: int = Field(ge=0, le=10)
    resilience: int = Field(ge=0, le=10)
    communication: int = Field(ge=0, le=10)
    problem_solving: int = Field(ge=0, le=10)
    coachability: int = Field(ge=0, le=10)

class Analytics(DBModel):
    """Post-interview deep analytics."""
    interview_id: UUID
    overall_score: int = Field(ge=0, le=100)
    recommendation: str  # "Strong Hire", "Hire", "No Hire"
    synthesis: str
    question_analytics: List[QuestionAnalysis] = []
    skill_evidence: List[SkillEvidence] = []
    behavioral_profile: Optional[BehavioralProfile] = None
    topics_to_probe: List[str] = []
```

---

## Base Repository

`backend/repositories/base.py`:

```python
from typing import TypeVar, Generic, Optional, List
from uuid import UUID
from pydantic import BaseModel
from config_db import supabase

T = TypeVar('T', bound=BaseModel)

class BaseRepository(Generic[T]):
    """Generic repository with CRUD operations."""
    
    def __init__(self, table_name: str, model_class: type[T]):
        self.table_name = table_name
        self.model_class = model_class
    
    def get_by_id(self, id: UUID) -> Optional[T]:
        result = supabase.table(self.table_name)\
            .select("*")\
            .eq("id", str(id))\
            .single()\
            .execute()
        return self.model_class(**result.data) if result.data else None
    
    def get_all(self, limit: int = 50, offset: int = 0) -> List[T]:
        result = supabase.table(self.table_name)\
            .select("*")\
            .range(offset, offset + limit - 1)\
            .execute()
        return [self.model_class(**row) for row in result.data]
    
    def create(self, data: dict) -> T:
        result = supabase.table(self.table_name)\
            .insert(data)\
            .execute()
        return self.model_class(**result.data[0])
    
    def update(self, id: UUID, data: dict) -> Optional[T]:
        result = supabase.table(self.table_name)\
            .update(data)\
            .eq("id", str(id))\
            .execute()
        return self.model_class(**result.data[0]) if result.data else None
    
    def delete(self, id: UUID) -> bool:
        result = supabase.table(self.table_name)\
            .delete()\
            .eq("id", str(id))\
            .execute()
        return len(result.data) > 0
```

---

## Interview Repository (with Multi-Stage Queries)

`backend/repositories/interview_repository.py`:

```python
from typing import List, Optional
from uuid import UUID
from config_db import supabase
from models.interview import Interview
from models.analytics import Analytics
from models.transcript import Transcript

class InterviewRepository:
    """Repository for interview operations with multi-stage support."""
    
    def get_candidate_interviews(self, candidate_id: UUID) -> List[dict]:
        """Get all interviews for a candidate with stage info, transcripts, and analytics."""
        result = supabase.table("interviews")\
            .select("""
                *,
                interview_stages(name, sequence_order, focus_areas),
                transcripts(turns, full_text),
                analytics(overall_score, recommendation, synthesis, topics_to_probe)
            """)\
            .eq("candidate_id", str(candidate_id))\
            .order("interview_stages(sequence_order)")\
            .execute()
        return result.data
    
    def get_questions_asked(self, candidate_id: UUID) -> List[dict]:
        """Get all questions asked to a candidate across all stages."""
        result = supabase.rpc("get_candidate_questions", {
            "p_candidate_id": str(candidate_id)
        }).execute()
        return result.data
    
    def get_topics_to_probe(self, candidate_id: UUID, current_stage_order: int) -> List[str]:
        """Get accumulated topics to probe from all prior stages."""
        result = supabase.table("analytics")\
            .select("topics_to_probe, interviews!inner(stage_id)")\
            .eq("interviews.candidate_id", str(candidate_id))\
            .execute()
        
        all_topics = []
        for row in result.data:
            if row.get("topics_to_probe"):
                all_topics.extend(row["topics_to_probe"])
        return list(set(all_topics))  # Deduplicate
```

---

## Usage Example

```python
from repositories.interview_repository import InterviewRepository
from uuid import UUID

repo = InterviewRepository()

# Get full context for a candidate before an interview
candidate_id = UUID("abc-123...")
prior_interviews = repo.get_candidate_interviews(candidate_id)
questions_asked = repo.get_questions_asked(candidate_id)
topics_to_probe = repo.get_topics_to_probe(candidate_id, current_stage_order=3)

# Build pre-brief with accumulated context
prebrief = {
    "prior_stages": prior_interviews,
    "questions_to_avoid": [q["question_text"] for q in questions_asked],
    "topics_to_explore": topics_to_probe
}
```

---

## Next: [Phase 4 - Data Migration](./phase4_migration.md)
