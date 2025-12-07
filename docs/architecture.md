# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Pre-Briefing   │  │   Video Room    │  │    Debrief      │  │
│  │  (Vapi Voice)   │→ │  (Daily + AI)   │→ │  (AI Analysis)  │  │
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
| Backend | FastAPI | REST API |
| LLM | OpenRouter | Text generation |

## Data Flow

### 1. Room Setup
```
User fills form → POST /api/rooms → Create Daily room → Redirect to /room/[name]
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

## Key Integration Points

### Daily.co + OpenAI Realtime (Important!)
- Both run simultaneously in browser
- Daily handles video via WebRTC
- OpenAI Realtime handles AI voice via WebSocket
- **No conflict** because different transports

### Daily.co + Vapi (Conflict!)
- Both use Daily.co internally
- **Cannot run simultaneously**
- Vapi used ONLY for pre-briefing (when video room inactive)
