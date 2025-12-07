# AI Candidate Agent - Architecture

## Overview

The AI Candidate feature allows interviewers to practice with a realistic AI-powered candidate 
that responds naturally during mock interviews. The system captures full transcripts for debrief.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                    INTERVIEWER BROWSER                 │
│                                                        │
│  ┌──────────────────┐     ┌──────────────────────┐    │
│  │   Daily Video    │     │   Vapi Audio Agent   │    │
│  │   (Your camera)  │     │   (Candidate voice)  │    │
│  └──────────────────┘     └──────────────────────┘    │
│         │                          │                   │
│     WebRTC                     WebRTC                  │
│         ▼                          ▼                   │
│  ┌──────────────────┐     ┌──────────────────────┐    │
│  │  Daily.co Cloud  │     │    Vapi.ai Cloud     │    │
│  │  (Video infra)   │     │  (Deepgram/GPT/11L)  │    │
│  └──────────────────┘     └──────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

## How It Works

1. **Interviewer joins Daily room** - Normal video call setup
2. **Clicks "Connect to AI Candidate"** - Triggers Vapi agent
3. **Vapi agent starts** - Uses browser mic/speaker (overlay, not in Daily)
4. **Visual tile appears** - Shows "Candidate" avatar in the grid
5. **Interview proceeds** - Interviewer asks questions, AI responds
6. **Transcript captured** - Both sides (user + assistant) logged
7. **End Interview** - Transcript sent to debrief generator

## Candidate Persona

The AI candidate is configured with an "imperfect human" persona:
- Uses speech fillers ("um", "uh", "well")
- Shows slight nervousness (eager but not overconfident)
- Pauses before difficult questions
- Keeps answers under 60 seconds
- Never asks "How can I help you?"

## Context Injection

The candidate receives:
- **Resume**: Full text from pre-briefing
- **Job Description**: From notes field
- **Role**: Position title
- **Candidate Name**: Extracted from resume

## Transcript Format

```json
{
  "role": "user",       // Interviewer
  "content": "Tell me about your experience with RAG pipelines."
}
{
  "role": "assistant",  // Candidate (AI)
  "content": "Um, sure! So at AIRRIVED, I built RAG pipelines using Pinecone..."
}
```

## Components

- `VapiCandidateAgent.tsx` - Frontend component (similar to VapiAgent)
- `video-room.tsx` - Triggers candidate agent, shows visual tile
- Backend `/debrief` endpoint - Accepts transcript for analysis

## Limitations

- Candidate does NOT appear in Daily's participant list
- Audio goes through Vapi, not Daily (separate WebRTC stream)
- Requires VAPI_PUBLIC_KEY in frontend env
