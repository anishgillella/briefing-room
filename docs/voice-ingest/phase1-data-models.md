# Phase 1: Data Models

## Overview

Define all Pydantic models for structured extraction from JD paste, voice conversation, and Parallel.ai research. These models ensure consistent data throughout the pipeline.

---

## Core Models

### Company Intelligence (from Parallel.ai)

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from enum import Enum


class FundingStage(str, Enum):
    PRE_SEED = "pre_seed"
    SEED = "seed"
    SERIES_A = "series_a"
    SERIES_B = "series_b"
    SERIES_C = "series_c"
    SERIES_D_PLUS = "series_d_plus"
    PUBLIC = "public"
    BOOTSTRAPPED = "bootstrapped"
    UNKNOWN = "unknown"


class CompanyIntelligence(BaseModel):
    """Structured extraction from Parallel.ai web search"""

    # Basic Info
    name: str
    website: str
    tagline: Optional[str] = Field(None, description="One-liner from website")

    # Funding & Stage
    funding_stage: Optional[FundingStage] = None
    total_raised: Optional[str] = Field(None, description="e.g., '$25M'")
    last_round_date: Optional[str] = None
    investors: List[str] = Field(default_factory=list)

    # Product & Market
    product_description: Optional[str] = Field(None, description="What they build")
    problem_solved: Optional[str] = Field(None, description="Why it matters")
    target_customers: Optional[str] = Field(None, description="Who buys it")
    industry: Optional[str] = Field(None, description="e.g., 'Dev tools', 'Fintech'")

    # Team & Culture
    founders: List[str] = Field(default_factory=list)
    founder_backgrounds: Optional[str] = Field(None, description="e.g., 'Ex-Google, Ex-Stripe'")
    team_size: Optional[str] = Field(None, description="e.g., '50-100'")
    headquarters: Optional[str] = None
    office_locations: List[str] = Field(default_factory=list)

    # Competitive Landscape
    competitors: List[str] = Field(default_factory=list)
    differentiators: Optional[str] = Field(None, description="What makes them unique")

    # Recent News & Signals
    recent_news: List[str] = Field(default_factory=list, description="Headlines, max 3")
    hiring_signals: Optional[str] = Field(None, description="e.g., 'Hiring aggressively'")
    tech_stack_hints: List[str] = Field(default_factory=list, description="From job posts, engineering blog")

    # Culture Signals
    culture_keywords: List[str] = Field(default_factory=list, description="e.g., 'Remote-first', 'Move fast'")
    glassdoor_sentiment: Optional[str] = Field(None, description="e.g., 'Positive', 'Mixed'")

    # Conversation Hooks (for agent)
    interesting_facts: List[str] = Field(default_factory=list, description="Things agent can reference")
    potential_selling_points: List[str] = Field(default_factory=list, description="Why candidates would want this")
```

---

### Hard Requirements

```python
class LocationType(str, Enum):
    ONSITE = "onsite"
    HYBRID = "hybrid"
    REMOTE = "remote"


class HardRequirements(BaseModel):
    """Non-negotiable job requirements"""

    # Role basics
    job_title: str

    # Location
    location_type: Optional[LocationType] = None
    location_city: Optional[str] = None
    onsite_days_per_week: Optional[int] = Field(None, ge=0, le=5)
    timezone_requirements: Optional[str] = None

    # Work authorization
    visa_sponsorship: Optional[bool] = None
    work_authorization_notes: Optional[str] = None

    # Experience
    experience_min_years: Optional[int] = Field(None, ge=0)
    experience_max_years: Optional[int] = Field(None, ge=0)

    # Compensation
    salary_min: Optional[int] = Field(None, description="USD annual")
    salary_max: Optional[int] = Field(None, description="USD annual")
    salary_currency: str = "USD"
    equity_offered: Optional[bool] = None
    equity_range: Optional[str] = Field(None, description="e.g., '0.1-0.25%'")
    bonus_structure: Optional[str] = None
```

---

### Candidate Traits

```python
class TraitPriority(str, Enum):
    MUST_HAVE = "must_have"
    NICE_TO_HAVE = "nice_to_have"


class CandidateTrait(BaseModel):
    """A skill, competency, or characteristic to evaluate"""

    id: Optional[str] = Field(None, description="UUID, set on creation")
    name: str = Field(..., description="e.g., 'Distributed Systems'")
    description: str = Field(..., description="1-2 sentences explaining the trait")
    priority: TraitPriority = TraitPriority.MUST_HAVE
    signals: List[str] = Field(
        default_factory=list,
        description="What to look for in candidates"
    )
    anti_signals: List[str] = Field(
        default_factory=list,
        description="Red flags to watch for"
    )

    class Config:
        # Traits should be grouped conceptually, not individual technologies
        # GOOD: "Frontend Architecture" with React, Vue, Angular as signals
        # BAD: "React", "Vue", "Angular" as separate traits
        pass
```

---

### Interview Stages

```python
class InterviewStage(BaseModel):
    """A stage in the interview process"""

    id: Optional[str] = Field(None, description="UUID, set on creation")
    name: str = Field(..., description="e.g., 'Phone Screen'")
    description: str = Field(..., description="What this stage evaluates")
    order: int = Field(..., ge=1)
    duration_minutes: Optional[int] = None
    interviewer_role: Optional[str] = Field(None, description="e.g., 'Recruiter', 'Hiring Manager'")
    actions: List[str] = Field(
        default_factory=list,
        description="Recruiter instructions: 'Send calendar invite', 'Notify manager'"
    )
```

---

### Nuance Capture

```python
class NuanceCategory(str, Enum):
    CULTURE_FIT = "culture_fit"          # "They want someone scrappy, not corporate"
    HIDDEN_PREF = "hidden_pref"          # "Prefers candidates who've built from scratch"
    RED_FLAG = "red_flag"                # "Avoid people who need a lot of direction"
    SELLING_POINT = "selling_point"      # "The CTO mentors everyone directly"
    TEAM_DYNAMIC = "team_dynamic"        # "Small team, everyone wears multiple hats"
    GROWTH_PATH = "growth_path"          # "This could become a VP role in 2 years"
    URGENCY = "urgency"                  # "Need someone in 2 weeks, backfill"
    OTHER = "other"


class NuanceCapture(BaseModel):
    """Qualitative insights that don't fit structured fields"""

    id: Optional[str] = Field(None, description="UUID, set on creation")
    category: NuanceCategory
    insight: str = Field(..., description="The insight in plain language")
    verbatim_quote: Optional[str] = Field(None, description="Exact words if useful")
    timestamp: Optional[str] = None
```

---

### Outreach Configuration

```python
class OutreachTone(str, Enum):
    FORMAL = "formal"
    CASUAL = "casual"
    DIRECT = "direct"
    ENTHUSIASTIC = "enthusiastic"


class OutreachConfig(BaseModel):
    """Email outreach preferences"""

    tone: Optional[OutreachTone] = None
    key_hook: Optional[str] = Field(None, description="What makes this role compelling")
    selling_points: List[str] = Field(default_factory=list)
    avoid_phrases: List[str] = Field(default_factory=list)

    # Generated content
    subject_line: Optional[str] = None
    email_body: Optional[str] = None
```

---

### Complete Job Profile

```python
class ExtractionSource(str, Enum):
    JD_PASTE = "jd_paste"
    CONVERSATION = "conversation"
    MIXED = "mixed"
    PARALLEL_AI = "parallel_ai"


class FieldConfidence(BaseModel):
    """Confidence score for an extracted field"""
    field_name: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    source: ExtractionSource
    needs_confirmation: bool = False


class JobProfile(BaseModel):
    """Complete job profile - the output of voice ingest"""

    id: Optional[str] = Field(None, description="UUID, set on creation")
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    # User info
    recruiter_first_name: str
    recruiter_last_name: str

    # Company (enriched by Parallel.ai)
    company: CompanyIntelligence

    # Structured requirements
    requirements: HardRequirements

    # Candidate profile
    traits: List[CandidateTrait] = Field(default_factory=list)

    # Interview process
    interview_stages: List[InterviewStage] = Field(default_factory=list)

    # Qualitative insights
    nuances: List[NuanceCapture] = Field(default_factory=list)

    # Outreach
    outreach: OutreachConfig = Field(default_factory=OutreachConfig)

    # Metadata
    extraction_source: ExtractionSource = ExtractionSource.CONVERSATION
    field_confidence: List[FieldConfidence] = Field(default_factory=list)

    # Status
    is_complete: bool = False
    missing_required_fields: List[str] = Field(default_factory=list)

    def get_missing_fields(self) -> List[str]:
        """Calculate which required fields are still missing"""
        missing = []

        # Required hard requirements
        if not self.requirements.job_title:
            missing.append("job_title")
        if self.requirements.location_type is None:
            missing.append("location_type")
        if self.requirements.experience_min_years is None:
            missing.append("experience_min_years")
        if self.requirements.salary_min is None:
            missing.append("compensation")
        if self.requirements.visa_sponsorship is None:
            missing.append("visa_sponsorship")
        if self.requirements.equity_offered is None:
            missing.append("equity")

        # Must have at least one trait
        if len(self.traits) == 0:
            missing.append("traits")

        # Must have at least one interview stage
        if len(self.interview_stages) == 0:
            missing.append("interview_stages")

        return missing

    def calculate_completion_percentage(self) -> float:
        """Calculate overall profile completion"""
        total_fields = 10  # Adjust based on required fields
        missing = len(self.get_missing_fields())
        return ((total_fields - missing) / total_fields) * 100
```

---

### Conversation Context (for Voice Agent)

```python
class SmartQuestion(BaseModel):
    """A contextual question for the agent to ask"""
    field: str
    question: str
    why: str = Field(..., description="Why this question matters")
    asked: bool = False


class ConversationContext(BaseModel):
    """Complete context passed to the voice agent"""

    # Session
    session_id: str

    # User info
    user_first_name: str
    user_last_name: str

    # Company intelligence (from Parallel.ai)
    company_intel: Optional[CompanyIntelligence] = None

    # What we've extracted so far
    current_profile: JobProfile

    # Gap analysis
    confirmed_fields: List[str] = Field(default_factory=list)
    inferred_fields: dict = Field(default_factory=dict)  # field -> reason
    missing_fields: List[str] = Field(default_factory=list)

    # Agent guidance
    opening_hook: str = ""
    smart_questions: List[SmartQuestion] = Field(default_factory=list)

    # Conversation state
    current_topic: Optional[str] = None
    topics_covered: List[str] = Field(default_factory=list)
```

---

## Database Schema

```sql
-- Job profiles table
CREATE TABLE job_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Recruiter
    recruiter_first_name TEXT NOT NULL,
    recruiter_last_name TEXT NOT NULL,

    -- Company (JSONB for flexibility)
    company JSONB NOT NULL,

    -- Requirements (JSONB)
    requirements JSONB NOT NULL,

    -- Traits (JSONB array)
    traits JSONB DEFAULT '[]'::jsonb,

    -- Interview stages (JSONB array)
    interview_stages JSONB DEFAULT '[]'::jsonb,

    -- Nuances (JSONB array)
    nuances JSONB DEFAULT '[]'::jsonb,

    -- Outreach config (JSONB)
    outreach JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    extraction_source TEXT DEFAULT 'conversation',
    field_confidence JSONB DEFAULT '[]'::jsonb,
    is_complete BOOLEAN DEFAULT FALSE,
    missing_required_fields TEXT[] DEFAULT '{}'
);

-- Index for querying incomplete profiles
CREATE INDEX idx_job_profiles_incomplete ON job_profiles (is_complete) WHERE is_complete = FALSE;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_profiles_updated_at
    BEFORE UPDATE ON job_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

---

## File Structure

```
backend/
├── models/
│   └── voice_ingest/
│       ├── __init__.py
│       ├── company.py          # CompanyIntelligence
│       ├── requirements.py     # HardRequirements
│       ├── traits.py           # CandidateTrait
│       ├── interview.py        # InterviewStage
│       ├── nuance.py           # NuanceCapture
│       ├── outreach.py         # OutreachConfig
│       ├── profile.py          # JobProfile
│       └── context.py          # ConversationContext
```

---

## Validation Rules

1. **Traits must be conceptual**, not individual technologies
   - Good: "Frontend Architecture" with React, Vue as signals
   - Bad: "React", "Vue" as separate traits

2. **Every trait must have a description** (1-2 sentences)

3. **Compensation must include equity question** - always ask explicitly

4. **Interview stages must have actions** - what does recruiter do at each stage

5. **At least 1 trait and 1 interview stage** required for completion

---

## Next Phase

[Phase 2: Parallel.ai Integration](./phase2-parallel-integration.md) - Company research and context enrichment
