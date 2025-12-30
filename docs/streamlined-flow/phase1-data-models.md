# Phase 1: Data Models

## Overview

This phase defines the core data models that power the streamlined interview flow. The key insight is separating **Person** (the human being) from **Candidate** (their application to a specific job).

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐
│   Person    │       │     Job     │
│  (contact)  │       │  (position) │
└──────┬──────┘       └──────┬──────┘
       │                     │
       │    ┌────────────────┘
       │    │
       ▼    ▼
┌─────────────────┐
│    Candidate    │
│  (application)  │
└────────┬────────┘
         │
         ▼
   ┌───────────┐
   │ Interview │
   └─────┬─────┘
         │
         ▼
   ┌───────────┐
   │ Analytics │
   └───────────┘
```

## Model Definitions

### 1. Person

Represents a unique individual who can apply to multiple jobs.

```python
# backend/models/streamlined/person.py

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID, uuid4

class PersonBase(BaseModel):
    """Base person fields for create/update operations."""
    name: str
    email: EmailStr
    phone: Optional[str] = None
    resume_url: Optional[str] = None
    linkedin_url: Optional[str] = None

class PersonCreate(PersonBase):
    """Fields required to create a new person."""
    pass

class PersonUpdate(BaseModel):
    """Fields that can be updated on a person."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    resume_url: Optional[str] = None
    linkedin_url: Optional[str] = None

class Person(PersonBase):
    """Full person model with all fields."""
    id: UUID = uuid4()
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Key Points:**
- `email` is unique - used to identify if someone already exists
- `resume_url` stores link to resume file (S3, Supabase Storage, etc.)
- Same person can have multiple `Candidate` records (one per job applied)

---

### 2. Job

Represents a job opening/position that candidates apply to.

```python
# backend/models/streamlined/job.py

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum

class JobStatus(str, Enum):
    DRAFT = "draft"           # Job being set up, not ready for candidates
    ACTIVE = "active"         # Actively hiring
    PAUSED = "paused"         # Temporarily not reviewing candidates
    CLOSED = "closed"         # Position filled or cancelled

class ExtractedRequirements(BaseModel):
    """Structured requirements extracted from job description."""
    years_experience: Optional[str] = None
    education: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    certifications: List[str] = []
    location: Optional[str] = None
    work_type: Optional[str] = None  # remote, hybrid, onsite
    salary_range: Optional[str] = None

class CompanyContext(BaseModel):
    """Company information enriched via voice agent."""
    company_name: Optional[str] = None
    company_description: Optional[str] = None
    team_size: Optional[str] = None
    team_culture: Optional[str] = None
    reporting_to: Optional[str] = None
    growth_stage: Optional[str] = None
    key_projects: List[str] = []

class ScoringCriteria(BaseModel):
    """Criteria for evaluating candidates, extracted via voice agent."""
    must_haves: List[str] = []          # Non-negotiable requirements
    nice_to_haves: List[str] = []       # Bonus points
    cultural_fit_traits: List[str] = [] # Personality/work style
    technical_competencies: List[str] = []
    weight_technical: float = 0.5       # 0-1, how much to weight technical vs soft
    weight_experience: float = 0.3
    weight_cultural: float = 0.2

class JobBase(BaseModel):
    """Base job fields for create/update operations."""
    title: str
    raw_description: str
    status: JobStatus = JobStatus.DRAFT

class JobCreate(JobBase):
    """Fields required to create a new job."""
    pass

class JobUpdate(BaseModel):
    """Fields that can be updated on a job."""
    title: Optional[str] = None
    raw_description: Optional[str] = None
    status: Optional[JobStatus] = None
    extracted_requirements: Optional[ExtractedRequirements] = None
    company_context: Optional[CompanyContext] = None
    scoring_criteria: Optional[ScoringCriteria] = None
    red_flags: Optional[List[str]] = None

class Job(JobBase):
    """Full job model with all fields."""
    id: UUID = uuid4()

    # Extracted/enriched data (populated by AI)
    extracted_requirements: Optional[ExtractedRequirements] = None
    company_context: Optional[CompanyContext] = None
    scoring_criteria: Optional[ScoringCriteria] = None
    red_flags: List[str] = []  # Things to watch out for

    # Metadata
    created_at: datetime
    updated_at: datetime

    # Computed fields (populated by queries)
    candidate_count: int = 0
    interviewed_count: int = 0

    class Config:
        from_attributes = True
```

**Key Points:**
- `raw_description` stores the original pasted JD text
- `extracted_requirements` is populated by AI extraction from JD
- `company_context` is populated by voice agent conversation
- `scoring_criteria` defines how to evaluate candidates for THIS job
- `red_flags` are specific concerns for this role
- `status` allows pausing/closing jobs

---

### 3. Candidate

Represents a person's application to a specific job (junction table).

```python
# backend/models/streamlined/candidate.py

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum

class InterviewStatus(str, Enum):
    PENDING = "pending"           # Not yet interviewed
    SCHEDULED = "scheduled"       # Interview scheduled
    IN_PROGRESS = "in_progress"   # Currently interviewing
    COMPLETED = "completed"       # Interview finished
    WITHDRAWN = "withdrawn"       # Candidate withdrew
    REJECTED = "rejected"         # Rejected after review

class CandidateBase(BaseModel):
    """Base candidate fields."""
    person_id: UUID
    job_id: UUID
    bio_summary: Optional[str] = None  # AI-generated summary from resume
    skills: List[str] = []
    years_experience: Optional[int] = None
    current_company: Optional[str] = None
    current_title: Optional[str] = None

class CandidateCreate(CandidateBase):
    """Fields required to create a new candidate."""
    pass

class CandidateUpdate(BaseModel):
    """Fields that can be updated on a candidate."""
    bio_summary: Optional[str] = None
    skills: Optional[List[str]] = None
    years_experience: Optional[int] = None
    current_company: Optional[str] = None
    current_title: Optional[str] = None
    interview_status: Optional[InterviewStatus] = None
    notes: Optional[str] = None

class Candidate(CandidateBase):
    """Full candidate model with all fields."""
    id: UUID = uuid4()
    interview_status: InterviewStatus = InterviewStatus.PENDING
    notes: Optional[str] = None  # Recruiter notes

    # Metadata
    created_at: datetime
    updated_at: datetime

    # Joined data (populated by queries with relationships)
    person_name: Optional[str] = None
    person_email: Optional[str] = None
    job_title: Optional[str] = None

    class Config:
        from_attributes = True
```

**Key Points:**
- Links `Person` to `Job` - a person can have multiple candidate records
- `interview_status` tracks progress through the pipeline
- `bio_summary` and `skills` are extracted from resume for this specific application
- `notes` allows recruiter to add manual observations

---

### 4. Interview

Represents a single interview session with a candidate.

```python
# backend/models/streamlined/interview.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum

class InterviewType(str, Enum):
    AI_CANDIDATE = "ai_candidate"   # AI plays the candidate (practice)
    LIVE = "live"                    # Real candidate interview
    PHONE_SCREEN = "phone_screen"    # Initial screening

class InterviewSessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"  # Technical issues

class InterviewBase(BaseModel):
    """Base interview fields."""
    candidate_id: UUID
    interview_type: InterviewType = InterviewType.AI_CANDIDATE

class InterviewCreate(InterviewBase):
    """Fields required to create a new interview."""
    scheduled_at: Optional[datetime] = None

class InterviewUpdate(BaseModel):
    """Fields that can be updated on an interview."""
    status: Optional[InterviewSessionStatus] = None
    transcript: Optional[str] = None
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    notes: Optional[str] = None

class Interview(InterviewBase):
    """Full interview model with all fields."""
    id: UUID = uuid4()
    status: InterviewSessionStatus = InterviewSessionStatus.SCHEDULED

    # Session data
    transcript: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None

    # Room info (for LiveKit/Daily)
    room_name: Optional[str] = None
    room_url: Optional[str] = None

    # Notes
    notes: Optional[str] = None

    # Metadata
    created_at: datetime
    updated_at: datetime

    # Denormalized for easy queries (populated by joins)
    candidate_name: Optional[str] = None
    job_id: Optional[UUID] = None
    job_title: Optional[str] = None

    class Config:
        from_attributes = True
```

**Key Points:**
- Each interview is linked to a `Candidate` (which links to Job)
- `transcript` stores the full conversation
- `interview_type` distinguishes AI practice from real interviews
- `room_name` connects to LiveKit/Daily for the actual call
- Denormalized fields (`job_id`, `job_title`) for easier queries

---

### 5. Analytics

Represents the AI-generated analysis of an interview.

```python
# backend/models/streamlined/analytics.py

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4

class CompetencyScore(BaseModel):
    """Score for a single competency."""
    name: str
    score: float  # 0-100
    evidence: List[str] = []  # Quotes from transcript
    notes: Optional[str] = None

class AnalyticsBase(BaseModel):
    """Base analytics fields."""
    interview_id: UUID

class AnalyticsCreate(AnalyticsBase):
    """Fields for creating analytics (usually done by AI)."""
    overall_score: float
    competency_scores: List[CompetencyScore]
    strengths: List[str]
    concerns: List[str]
    red_flags_detected: List[str]
    recommendation: str  # "strong_hire", "hire", "maybe", "no_hire"
    summary: str

class Analytics(AnalyticsBase):
    """Full analytics model with all fields."""
    id: UUID = uuid4()

    # Scores
    overall_score: float  # 0-100
    competency_scores: List[CompetencyScore] = []

    # Qualitative assessment
    strengths: List[str] = []
    concerns: List[str] = []
    red_flags_detected: List[str] = []

    # Recommendation
    recommendation: str  # "strong_hire", "hire", "maybe", "no_hire"
    recommendation_reasoning: Optional[str] = None

    # Summary
    summary: str

    # Raw AI response (for debugging)
    raw_ai_response: Optional[Dict[str, Any]] = None

    # Metadata
    created_at: datetime
    model_used: Optional[str] = None  # Which LLM generated this

    # Denormalized for easy queries
    candidate_id: Optional[UUID] = None
    candidate_name: Optional[str] = None
    job_id: Optional[UUID] = None
    job_title: Optional[str] = None

    class Config:
        from_attributes = True
```

**Key Points:**
- One `Analytics` per `Interview`
- `competency_scores` uses the job's `scoring_criteria` competencies
- `red_flags_detected` checked against job's `red_flags`
- `recommendation` is a clear hire/no-hire signal
- Denormalized fields for dashboard queries

---

## Database Schema (Supabase/PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Person table
CREATE TABLE persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    resume_url TEXT,
    linkedin_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    raw_description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    extracted_requirements JSONB,
    company_context JSONB,
    scoring_criteria JSONB,
    red_flags JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidate table (junction between Person and Job)
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    bio_summary TEXT,
    skills JSONB DEFAULT '[]',
    years_experience INTEGER,
    current_company VARCHAR(255),
    current_title VARCHAR(255),
    interview_status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(person_id, job_id)  -- Same person can't apply to same job twice
);

-- Interview table
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    interview_type VARCHAR(20) DEFAULT 'ai_candidate',
    status VARCHAR(20) DEFAULT 'scheduled',
    transcript TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    room_name VARCHAR(255),
    room_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics table
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    overall_score DECIMAL(5,2),
    competency_scores JSONB DEFAULT '[]',
    strengths JSONB DEFAULT '[]',
    concerns JSONB DEFAULT '[]',
    red_flags_detected JSONB DEFAULT '[]',
    recommendation VARCHAR(20),
    recommendation_reasoning TEXT,
    summary TEXT,
    raw_ai_response JSONB,
    model_used VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_candidates_job_id ON candidates(job_id);
CREATE INDEX idx_candidates_person_id ON candidates(person_id);
CREATE INDEX idx_candidates_status ON candidates(interview_status);
CREATE INDEX idx_interviews_candidate_id ON interviews(candidate_id);
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_analytics_interview_id ON analytics(interview_id);
CREATE INDEX idx_jobs_status ON jobs(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_persons_updated_at BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Useful Views

```sql
-- View: Candidates with full context
CREATE VIEW candidate_full_view AS
SELECT
    c.id,
    c.person_id,
    c.job_id,
    p.name AS person_name,
    p.email AS person_email,
    j.title AS job_title,
    c.bio_summary,
    c.skills,
    c.interview_status,
    c.created_at,
    (SELECT COUNT(*) FROM interviews i WHERE i.candidate_id = c.id) AS interview_count,
    (SELECT overall_score FROM analytics a
     JOIN interviews i ON a.interview_id = i.id
     WHERE i.candidate_id = c.id
     ORDER BY a.created_at DESC LIMIT 1) AS latest_score
FROM candidates c
JOIN persons p ON c.person_id = p.id
JOIN jobs j ON c.job_id = j.id;

-- View: Job dashboard summary
CREATE VIEW job_dashboard_view AS
SELECT
    j.id,
    j.title,
    j.status,
    j.created_at,
    COUNT(DISTINCT c.id) AS candidate_count,
    COUNT(DISTINCT CASE WHEN c.interview_status = 'completed' THEN c.id END) AS interviewed_count,
    COUNT(DISTINCT CASE WHEN c.interview_status = 'pending' THEN c.id END) AS pending_count,
    AVG(a.overall_score) AS avg_score
FROM jobs j
LEFT JOIN candidates c ON j.id = c.job_id
LEFT JOIN interviews i ON c.id = i.candidate_id
LEFT JOIN analytics a ON i.id = a.interview_id
GROUP BY j.id, j.title, j.status, j.created_at;
```

---

## Implementation Steps

1. **Create model files** in `backend/models/streamlined/`
2. **Run SQL migrations** in Supabase
3. **Create repository layer** for database operations
4. **Update existing code** to use new models (see Phase 4-6)

## Files to Create

```
backend/
├── models/
│   └── streamlined/
│       ├── __init__.py
│       ├── person.py
│       ├── job.py
│       ├── candidate.py
│       ├── interview.py
│       └── analytics.py
├── repositories/
│   └── streamlined/
│       ├── __init__.py
│       ├── person_repo.py
│       ├── job_repo.py
│       ├── candidate_repo.py
│       ├── interview_repo.py
│       └── analytics_repo.py
```

## Next Phase

Once models are defined, proceed to [Phase 2: Job Management](./phase2-job-management.md) to implement the Job CRUD API and UI.
