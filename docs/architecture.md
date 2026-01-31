# System Architecture

## High-Level Overview

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
└─────────│────────────────────│──────│────────────────│──────────┘
          │                    │      │                │
          ▼                    ▼      ▼                ▼
   ┌─────────────┐     ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │    Vapi     │     │ Daily.co │ │  OpenAI  │ │   Backend    │
   │   Servers   │     │  Servers │ │ Realtime │ │   FastAPI    │
   └─────────────┘     └──────────┘ └──────────┘ └──────────────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │ Multi-tenant │
                                                 │ Repository   │
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
| Frontend | Next.js 16 | React framework |
| UI | shadcn/ui + Tailwind | Component library |
| Video | Daily.co | WebRTC video rooms |
| Voice (Briefing) | Vapi | Voice AI for pre-briefing |
| Voice (Candidate) | OpenAI Realtime | AI candidate voice (WebSocket) |
| Backend | FastAPI | REST API & N+1 Optimized Repos |
| Auth | JWT + Middleware | Organization-scoped access |
| LLM | OpenRouter | Text generation |

## Data Flow

### 1. Streamlined Flow Setup
```
Create Job → Add Candidates (CSV/Manual) → Generate Interview Brief → Start Video Room
```

### 2. Pre-Briefing
```
Load briefing context → Vapi voice agent → Prepare interviewer → Click "Start"
```

### 3. Interview
```
Daily video room active → (Optional) Connect AI candidate → Capture transcript
```

### 4. Debrief
```
POST /api/rooms/{name}/debrief with transcript → LLM analysis → Display results
```

### Multi-tenancy & Security
- All repositories use `organization_id` for isolation.
- Middleware extracts `organization_id` from JWT.
- Repositories implement batch-fetching to prevent N+1 query performance issues in dashboards.
