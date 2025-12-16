# Voice Ingest: AI-Powered Job Profile Onboarding

## Overview

Voice Ingest is a new onboarding flow that uses a voice agent to help recruiters build complete, structured job profiles before processing candidates. It replaces the manual JD paste with an intelligent, conversational experience.

## How It Fits Into Briefing Room

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BRIEFING ROOM FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  VOICE INGEST (NEW)                                                 │    │
│  │  ────────────────────                                               │    │
│  │  1. Intake form (name, company, website)                            │    │
│  │  2. Parallel.ai company research (async)                            │    │
│  │  3. JD input (paste or voice)                                       │    │
│  │  4. Voice agent gap-fill conversation                               │    │
│  │  5. Review & finalize job profile                                   │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌────────────────────────┐                               │
│                    │  FINALIZED JOB PROFILE │                               │
│                    │  • Company context     │                               │
│                    │  • Hard requirements   │                               │
│                    │  • Candidate traits    │                               │
│                    │  • Interview stages    │                               │
│                    │  • Outreach template   │                               │
│                    └────────────┬───────────┘                               │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  EXISTING FLOW                                                      │    │
│  │  ─────────────                                                      │    │
│  │  1. Upload candidates CSV                                           │    │
│  │  2. Pluto processes & ranks candidates                              │    │
│  │  3. Pre-interview briefing                                          │    │
│  │  4. Live interview with coaching                                    │    │
│  │  5. Post-interview analytics                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Documentation Index

| Document | Description |
|----------|-------------|
| [Phase 1: Data Models](./phase1-data-models.md) | Pydantic models for job profile extraction |
| [Phase 2: Parallel.ai Integration](./phase2-parallel-integration.md) | Company research and context enrichment |
| [Phase 3: JD Extraction](./phase3-jd-extraction.md) | Structured extraction from pasted JD |
| [Phase 4: LiveKit Voice Agent](./phase4-voice-agent.md) | Voice agent implementation with gap-fill |
| [Phase 5: Frontend Components](./phase5-frontend.md) | Real-time UI with glassmorphic cards |
| [Phase 6: Integration](./phase6-integration.md) | Connecting to existing candidate flow |

## Key Features

- **Smart Pre-fill**: Parallel.ai researches company before conversation starts
- **Flexible Input**: Paste JD text OR talk through it with voice agent
- **Real-time UI**: Cards populate as agent extracts information
- **Gap Detection**: Agent asks only about missing information
- **Nuance Capture**: Stores qualitative insights beyond structured fields
- **Contextual Questions**: Agent references company details in conversation

## Tech Stack

| Component | Technology |
|-----------|------------|
| Voice Agent | LiveKit Agents SDK (Python) |
| LLM | Gemini 2.5 Flash via OpenRouter |
| Extraction | Pydantic structured outputs |
| Company Research | Parallel.ai |
| Real-time Updates | WebSocket |
| Frontend | Next.js + Tailwind + Framer Motion |
| Database | Supabase PostgreSQL |

## Estimated Timeline

| Phase | Scope |
|-------|-------|
| Phase 1 | Data models and schemas |
| Phase 2 | Parallel.ai integration |
| Phase 3 | JD extraction endpoint |
| Phase 4 | LiveKit voice agent |
| Phase 5 | Frontend components |
| Phase 6 | Integration with existing flow |
