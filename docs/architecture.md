# System Architecture

## High-Level Overview

Hirely is an AI-native interview intelligence platform composed of a Next.js frontend, a FastAPI backend, and several AI service integrations.

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Pre-Briefing   │  │   Video Room    │  │    Debrief      │  │
│  │ (Vapi/Streamline)│→ │  (Daily + AI)   │→ │  (AI Analysis)  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│         │                    │  │                    │          │
│      Vapi SDK            Daily.co  OpenAI         REST API      │
│         │                WebRTC   Realtime           │          │
15: └─────────│────────────────────│──────│────────────────│──────────┘
          │                    │      │                │
          ▼                    ▼      ▼                ▼
   ┌─────────────┐     ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │    Vapi     │     │ Daily.co │ │  OpenAI  │ │   Backend    │
   │   Servers   │     │  Servers │ │ Realtime │ │   FastAPI    │
   └─────────────┘     └──────────┘ └──────────┘ └──────────────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │   Supabase   │
                                                 │ (PostgresDB) │
                                                 └──────────────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │  OpenRouter  │
                                                 │    (LLM)     │
                                                 └──────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15+ (App Router) | React framework, UI components (shadcn/ui + Tailwind) |
| **Backend** | FastAPI (Python 3.12) | REST API, Business Logic, DB Interactions |
| **Database** | Supabase (PostgreSQL) | Data persistence (Jobs, Candidates, Interviews) |
| **Video** | Daily.co | WebRTC video rooms for interviews |
| **Voice (Briefing)** | Vapi | Voice AI for pre-interview briefings |
| **Voice (Candidate)** | OpenAI Realtime | AI candidate simulation (WebSocket) |
| **LLM** | OpenRouter | Text generation, extraction, and analysis |

## Core Data Flows

### 1. Job & Candidate Management
- **Job Creation**: Users create jobs with descriptions.
- **Extraction**: Backend (Resume Processor) uses LLMs to extract structured requirements (skills, experience).
- **Candidate Upload**: Resumes are parsed, and candidates are scored against the job's structured criteria.

### 2. Pre-Briefing (Voice Agent)
- The user initiates a voice session.
- Frontend connects to Vapi using a secure token.
- Vapi interacts with the user to gather context or provide a briefing.
- Webhooks update the backend with conversation status.

### 3. Interview Session
- Users join a Daily.co video room.
- (Optional) An AI Candidate (OpenAI Realtime) connects to simulate a candidate.
- Transcripts are captured.

### 4. Analysis & Debrief
- Post-interview, transcripts are sent to the backend.
- LLMs analyze the transcript against the job rubric.
- Scores and feedback are generated and stored in Supabase.
