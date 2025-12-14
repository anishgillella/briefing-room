# Phase 1: Database Schema Design

This document defines the complete database schema for the Pluto persistence layer.

## Design Philosophy: Fixed 3-Stage Pipeline

Instead of a flexible `interview_stages` table, we use a **fixed 3-stage enum**:
1. **Phone Screen** - Initial screening (Recruiter)
2. **Technical** - Skills assessment (Engineer)  
3. **Behavioral** - Culture fit (Hiring Manager)

After all 3 stages → **Accept/Reject** decision

This simplifies the UX: interviewers just click "Start Interview" and the system auto-increments to the next stage.

---

## Entity Relationship Diagram

```
┌─────────────────┐                    ┌─────────────────┐
│   job_postings  │                    │   candidates    │
├─────────────────┤                    ├─────────────────┤
│ id (PK)         │◄───────────────────│ job_posting_id  │
│ title           │                    │ id (PK)         │
│ description     │                    │ name            │
│ company_context │                    │ email           │
│ created_at      │                    │ pipeline_status │
└─────────────────┘                    │ final_decision  │ ⭐ NEW
                                       │ decision_notes  │ ⭐ NEW
                                       │ tier            │
                                       │ algo_score      │
                                       └────────┬────────┘
                                                │
                                                │ (one candidate → 3 interviews max)
                                                ▼
                                       ┌────────────────────┐
                                       │     interviews     │
                                       ├────────────────────┤
                                       │ id (PK)            │
                                       │ candidate_id (FK)  │
                                       │ stage (ENUM)       │ ⭐ Fixed: phone_screen, technical, behavioral
                                       │ interviewer_name   │
                                       │ room_name          │
                                       │ status             │
                                       │ started_at         │
                                       │ ended_at           │
                                       └─────────┬──────────┘
                                                 │
              ┌──────────────────────────────────┼──────────────────────────────────┐
              │                                  │                                  │
              ▼                                  ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────┐          ┌─────────────────────┐
│    transcripts      │          │     analytics       │          │   questions_asked   │
├─────────────────────┤          ├─────────────────────┤          ├─────────────────────┤
│ id (PK)             │          │ id (PK)             │          │ id (PK)             │
│ interview_id (FK)   │          │ interview_id (FK)   │          │ interview_id (FK)   │
│ turns (JSONB)       │          │ overall_score       │          │ question_text       │
│ full_text           │          │ recommendation      │          │ topic               │
└─────────────────────┘          │ synthesis           │          │ answer_quality      │
                                 │ question_analytics  │          │ follow_up_needed    │
                                 │ skill_evidence      │          └─────────────────────┘
                                 │ behavioral_profile  │
                                 │ topics_to_probe     │
                                 └─────────────────────┘
```

---

## Interview Stage Flow

```
Candidate Pipeline:
                                                           
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐
│  Phone   │───►│Technical │───►│Behavioral│───►│   Decision   │
│  Screen  │    │          │    │          │    │ Accept/Reject│
└──────────┘    └──────────┘    └──────────┘    └──────────────┘
     ○               ○               ○                 ○
   Score 72       Score 85       Score 80         ACCEPTED ✓
```

**Rules:**
- Can't start Stage 2 until Stage 1 has analytics
- Can't Accept/Reject until all 3 stages complete
- Auto-increment: "Start Interview" picks the next incomplete stage

---

## Table Definitions

### 1. `job_postings`

Stores job descriptions that candidates are being evaluated against.

```sql
CREATE TABLE job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    company_context TEXT,
    
    -- Scoring configuration
    scoring_criteria JSONB DEFAULT '{}',
    red_flag_indicators JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for listing jobs
CREATE INDEX idx_job_postings_created ON job_postings(created_at DESC);
```

**JSONB Structure - `scoring_criteria`:**
```json
{
  "required_skills": ["Python", "Sales"],
  "preferred_skills": ["Leadership"],
  "min_years_experience": 3,
  "target_industries": ["SaaS", "FinTech"]
}
```

---

### 2. `candidates`

Core candidate data extracted from CSV and enriched by AI.

```sql
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,
    
    -- Basic Info
    name TEXT NOT NULL,
    email TEXT,
    linkedin_url TEXT,
    job_title TEXT,
    current_company TEXT,
    location_city TEXT,
    location_state TEXT,
    
    -- Professional Background
    years_experience FLOAT,
    bio_summary TEXT,
    skills JSONB DEFAULT '[]',
    industries JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',
    
    -- Scoring
    algo_score INT CHECK (algo_score BETWEEN 0 AND 100),
    ai_score INT CHECK (ai_score BETWEEN 0 AND 100),
    combined_score INT CHECK (combined_score BETWEEN 0 AND 100),
    tier TEXT CHECK (tier IN ('Top Tier', 'Strong', 'Good', 'Evaluate', 'Poor')),
    
    -- AI Analysis
    one_line_summary TEXT,
    pros JSONB DEFAULT '[]',
    cons JSONB DEFAULT '[]',
    reasoning TEXT,
    interview_questions JSONB DEFAULT '[]',
    
    -- Pipeline Status (auto-updated based on completed interviews)
    pipeline_status TEXT DEFAULT 'new' CHECK (pipeline_status IN (
        'new', 'phone_screen', 'technical', 'behavioral', 'decision_pending', 'accepted', 'rejected'
    )),
    
    -- Final Decision (set after all 3 stages complete) ⭐ NEW
    final_decision TEXT CHECK (final_decision IN ('accepted', 'rejected')),
    decision_notes TEXT,
    decided_at TIMESTAMPTZ,
    
    -- Metadata
    source TEXT DEFAULT 'csv_upload',
    has_enrichment_data BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_candidates_job ON candidates(job_posting_id);
CREATE INDEX idx_candidates_tier ON candidates(tier);
CREATE INDEX idx_candidates_status ON candidates(pipeline_status);
CREATE INDEX idx_candidates_score ON candidates(combined_score DESC);
CREATE INDEX idx_candidates_decision ON candidates(final_decision);
```

---

### 4. `prebriefs`

Pre-interview briefing documents generated for each candidate.

```sql
CREATE TABLE prebriefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    
    content JSONB NOT NULL,  -- Full prebrief structure
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(candidate_id)  -- One prebrief per candidate
);
```

**JSONB Structure - `content`:**
```json
{
  "candidate_summary": "...",
  "key_strengths": ["..."],
  "potential_concerns": ["..."],
  "recommended_questions": ["..."],
  "topics_to_explore": ["..."],
  "resume_highlights": ["..."]
}
```

---

### 4. `interviews`

Individual interview sessions. One candidate has up to 3 interviews (one per stage).

```sql
-- Fixed 3-stage enum (no separate table needed)
CREATE TYPE interview_stage AS ENUM ('phone_screen', 'technical', 'behavioral');

CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    
    -- Stage (fixed enum, not FK) ⭐ SIMPLIFIED
    stage interview_stage NOT NULL,
    
    -- Session Info
    interviewer_name TEXT,
    room_name TEXT UNIQUE,  -- LiveKit room ID
    
    -- Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
    
    -- Timing
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_sec INT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one interview per stage per candidate
    UNIQUE(candidate_id, stage)
);

-- Indexes
CREATE INDEX idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX idx_interviews_room ON interviews(room_name);
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_interviews_stage ON interviews(stage);
```

**Auto-Increment Logic (Backend):**
```python
STAGE_ORDER = ['phone_screen', 'technical', 'behavioral']

def get_next_stage(candidate_id: UUID) -> Optional[str]:
    """Determine the next incomplete stage for a candidate."""
    completed = get_completed_stages(candidate_id)  # Query DB
    for stage in STAGE_ORDER:
        if stage not in completed:
            return stage
    return None  # All stages complete
```

---

### 6. `transcripts`

Full interview transcripts with speaker turns.

```sql
CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    
    -- Structured turns
    turns JSONB NOT NULL DEFAULT '[]',
    
    -- Full text for search
    full_text TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(interview_id)  -- One transcript per interview
);

-- Full-text search index
CREATE INDEX idx_transcripts_fulltext ON transcripts USING GIN(to_tsvector('english', full_text));
```

**JSONB Structure - `turns`:**
```json
[
  {"speaker": "agent", "text": "Tell me about yourself.", "timestamp": 0},
  {"speaker": "candidate", "text": "I have 5 years of experience...", "timestamp": 3.5},
  {"speaker": "agent", "text": "Can you give an example?", "timestamp": 45.2}
]
```

---

### 7. `analytics`

Post-interview deep analytics generated by AI.

```sql
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    
    -- Overall Assessment
    overall_score INT CHECK (overall_score BETWEEN 0 AND 100),
    recommendation TEXT CHECK (recommendation IN ('Strong Hire', 'Hire', 'No Hire')),
    synthesis TEXT,
    
    -- Detailed Analysis (JSONB)
    question_analytics JSONB DEFAULT '[]',
    skill_evidence JSONB DEFAULT '[]',
    behavioral_profile JSONB DEFAULT '{}',
    communication_metrics JSONB DEFAULT '{}',
    topics_to_probe JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(interview_id)  -- One analytics per interview
);

CREATE INDEX idx_analytics_interview ON analytics(interview_id);
CREATE INDEX idx_analytics_score ON analytics(overall_score DESC);
```

**JSONB Structure - `question_analytics`:**
```json
[
  {
    "question": "Tell me about a time you led a team.",
    "answer_summary": "Described leading a 5-person team...",
    "topic": "Leadership",
    "quality_score": 85,
    "relevance_score": 9,
    "clarity_score": 8,
    "depth_score": 7,
    "key_insight": "Strong delegation skills demonstrated"
  }
]
```

---

### 8. `questions_asked`

Tracks all questions asked to prevent redundancy across stages.

```sql
CREATE TABLE questions_asked (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    
    question_text TEXT NOT NULL,
    topic TEXT,
    answer_quality INT CHECK (answer_quality BETWEEN 0 AND 10),
    follow_up_needed BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding questions by candidate (via interview)
CREATE INDEX idx_questions_interview ON questions_asked(interview_id);
```

---

## Key Relationships Summary

```
job_postings (1) ──► (N) candidates
candidates   (1) ──► (0..1) prebriefs
candidates   (1) ──► (0..3) interviews        ◄── MAX 3 (one per stage)
interviews       ──► stage (ENUM)             ◄── phone_screen | technical | behavioral
interviews   (1) ──► (1) transcripts
interviews   (1) ──► (1) analytics
interviews   (1) ──► (N) questions_asked      ◄── REDUNDANCY TRACKING
```

**Candidate Lifecycle:**
```
new → phone_screen → technical → behavioral → decision_pending → accepted/rejected
```

---

## Storage Considerations

| Data Type | Size | Storage |
|-----------|------|---------|
| Candidate records | ~10KB each | PostgreSQL |
| Prebriefs | ~5KB each | PostgreSQL JSONB |
| Transcripts | ~50-200KB each | PostgreSQL JSONB |
| Analytics | ~20KB each | PostgreSQL JSONB |
| Audio recordings | ~10MB each | Supabase Storage (S3) |
| Resume PDFs | ~500KB each | Supabase Storage (S3) |

---

## Next: [Phase 2 - Supabase Setup](./phase2_supabase_setup.md)
