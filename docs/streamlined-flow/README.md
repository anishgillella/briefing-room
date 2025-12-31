# Streamlined Interview Flow Architecture

## Overview

This documentation describes the unified, streamlined interview flow that connects job description extraction, candidate management, interviews, and analytics into a cohesive system. The core innovation is treating **Jobs** as the central organizing entity, with all other data (candidates, interviews, analytics) flowing through it.

## The Problem We're Solving

Previously, the system had a **decoupled flow**:
1. Voice interview agent only knew `job_title` (not full job description)
2. Copilot analysis retrieved job description from transient processing state
3. If user skipped CSV upload, no job description was available for analytics
4. Multiple hiring roles couldn't be managed in parallel

## The New Streamlined Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        STREAMLINED HIRING FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  STEP 1: CREATE JOB                                                              │
│  ─────────────────────                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐        │
│  │  1a. Paste Job Description (text input)                             │        │
│  │      └─→ AI extracts: title, requirements, skills, etc.            │        │
│  │                                                                     │        │
│  │  1b. Voice Agent Interview (talks to recruiter)                     │        │
│  │      └─→ Extracts additional context:                               │        │
│  │          • Company culture & values                                 │        │
│  │          • Team dynamics                                            │        │
│  │          • Ideal candidate traits                                   │        │
│  │          • Red flags to watch for                                   │        │
│  │          • Scoring criteria                                         │        │
│  │                                                                     │        │
│  │  1c. Job Created & Saved                                            │        │
│  │      └─→ Job record persists with all extracted data               │        │
│  └─────────────────────────────────────────────────────────────────────┘        │
│                                     │                                            │
│                                     ▼                                            │
│  STEP 2: UPLOAD CANDIDATES                                                       │
│  ─────────────────────────────                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐        │
│  │  • Select Job (from dropdown of existing jobs)                      │        │
│  │  • Upload CSV with candidate data                                   │        │
│  │  • Each candidate is linked to the selected Job                     │        │
│  │  • Same person can apply to multiple jobs (Person → Candidates)     │        │
│  └─────────────────────────────────────────────────────────────────────┘        │
│                                     │                                            │
│                                     ▼                                            │
│  STEP 3: CANDIDATE INTERVIEWS                                                    │
│  ──────────────────────────────                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐        │
│  │  • Voice agent plays candidate role (existing functionality)        │        │
│  │  • Agent now receives FULL job description from Job record          │        │
│  │  • Interview transcript saved to Interview record                   │        │
│  │  • Interview linked to both Candidate and Job                       │        │
│  └─────────────────────────────────────────────────────────────────────┘        │
│                                     │                                            │
│                                     ▼                                            │
│  STEP 4: ANALYTICS & SCORING                                                     │
│  ────────────────────────────                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐        │
│  │  • Analytics generated per Interview                                │        │
│  │  • Uses Job's scoring_criteria for evaluation                       │        │
│  │  • Uses Job's red_flags for concern detection                       │        │
│  │  • Role-specific competencies extracted from Job description        │        │
│  │  • Analytics saved and linked to Interview → Candidate → Job        │        │
│  └─────────────────────────────────────────────────────────────────────┘        │
│                                     │                                            │
│                                     ▼                                            │
│  STEP 5: RECRUITER DASHBOARD                                                     │
│  ────────────────────────────                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐        │
│  │  • View all Jobs with status                                        │        │
│  │  • Drill down into any Job to see its candidates                    │        │
│  │  • Compare candidates within a job                                  │        │
│  │  • View cross-job hiring metrics                                    │        │
│  │  • Track overall pipeline health                                    │        │
│  └─────────────────────────────────────────────────────────────────────┘        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Data Model Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DATA MODEL HIERARCHY                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   Person                          Job                                         │
│   ├── id                          ├── id                                      │
│   ├── name                        ├── title                                   │
│   ├── email (unique)              ├── raw_description                         │
│   ├── phone                       ├── extracted_requirements                  │
│   ├── resume_url                  ├── company_context                         │
│   └── created_at                  ├── scoring_criteria                        │
│         │                         ├── red_flags                               │
│         │                         ├── status (active/paused/closed)           │
│         │                         └── created_at                              │
│         │                               │                                     │
│         │         ┌─────────────────────┘                                     │
│         │         │                                                           │
│         ▼         ▼                                                           │
│      Candidate (junction)                                                     │
│      ├── id                                                                   │
│      ├── person_id (FK → Person)                                              │
│      ├── job_id (FK → Job)                                                    │
│      ├── bio_summary                                                          │
│      ├── skills                                                               │
│      ├── interview_status                                                     │
│      └── created_at                                                           │
│            │                                                                  │
│            ▼                                                                  │
│         Interview                                                             │
│         ├── id                                                                │
│         ├── candidate_id (FK → Candidate)                                     │
│         ├── transcript                                                        │
│         ├── started_at                                                        │
│         ├── ended_at                                                          │
│         └── status                                                            │
│               │                                                               │
│               ▼                                                               │
│            Analytics                                                          │
│            ├── id                                                             │
│            ├── interview_id (FK → Interview)                                  │
│            ├── overall_score                                                  │
│            ├── competency_scores                                              │
│            ├── strengths                                                      │
│            ├── concerns                                                       │
│            ├── red_flags_detected                                             │
│            ├── recommendation                                                 │
│            └── created_at                                                     │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Benefits

| Benefit | Description |
|---------|-------------|
| **Single Source of Truth** | Job description flows through entire pipeline |
| **Multi-Job Support** | Recruiters can manage multiple hiring roles in parallel |
| **Consistent Context** | Interview agent and analytics use the same job data |
| **Same Person, Multiple Jobs** | Track candidates across different roles |
| **Full Traceability** | Analytics → Interview → Candidate → Job → Person |
| **Role-Specific Scoring** | Each job has its own criteria and red flags |

## Two User Perspectives

### Recruiter View (Cross-Job)
- Dashboard showing all active jobs
- Aggregate metrics across all hiring
- Drill-down into any job

### Job-Specific View
- Candidates for this job only
- Compare candidates against job-specific criteria
- Track pipeline for this role

## Implementation Phases

| Phase | Document | Status | Scope |
|-------|----------|--------|-------|
| 1 | [phase1-data-models.md](./phase1-data-models.md) | **COMPLETE** | Define Person, Job, Candidate, Interview, Analytics models |
| 2 | [phase2-job-management.md](./phase2-job-management.md) | **COMPLETE** | Job CRUD API and job selection UI |
| 3 | [phase3-jd-voice-agent.md](./phase3-jd-voice-agent.md) | **COMPLETE** | Voice agent for JD extraction and enrichment (Vapi) |
| 4 | [phase4-candidate-upload.md](./phase4-candidate-upload.md) | **COMPLETE** | CSV upload linked to selected job |
| 5 | [phase5-interview-flow.md](./phase5-interview-flow.md) | **COMPLETE** | Interview agent with full job context (Vapi) |
| 6 | [phase6-analytics.md](./phase6-analytics.md) | **COMPLETE** | Analytics with job-specific scoring |
| 7 | [phase7-recruiter-dashboard.md](./phase7-recruiter-dashboard.md) | **COMPLETE** | Multi-job dashboard and reporting |

## Migration Strategy

Existing candidates and data will need to be migrated:
1. Create a "Default" job for orphaned candidates
2. Backfill `job_id` on existing candidate records
3. Existing analytics remain linked (job context may be limited)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Database | Supabase PostgreSQL (existing) |
| Backend | FastAPI (existing) |
| Frontend | Next.js + Tailwind (existing) |
| Voice Agent | Vapi (existing) |
| LLM | OpenRouter / Gemini 2.5 Flash (existing) |
