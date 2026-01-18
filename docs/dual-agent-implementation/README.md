# Dual Agent Implementation Guide

> **Status: IMPLEMENTED** - All phases complete

## Overview

The dual-agent architecture allows users to join interviews as either **Interviewer** or **Candidate**. The AI plays the opposite role.

| Role Selection | AI Agent | Human Experience |
|----------------|----------|------------------|
| Join as Interviewer | `interview_agent.py` (AI Candidate) | You ask questions, AI answers |
| Join as Candidate | `interviewer_agent.py` (AI Interviewer) | AI asks questions, you answer |

## Quick Start

```bash
# Terminal 1: Backend API
cd backend && source venv/bin/activate && uvicorn main:app --reload

# Terminal 2: AI Candidate Agent (for interviewer mode)
cd backend && source venv/bin/activate && python interview_agent.py dev

# Terminal 3: AI Interviewer Agent (for candidate mode)
cd backend && source venv/bin/activate && python interviewer_agent.py dev

# Terminal 4: Frontend
cd frontend && npm run dev
```

Then navigate to a candidate and click "Start Interview" to see the role selection screen.

## Implementation Summary

| Phase | Status | Key Changes |
|-------|--------|-------------|
| 1 - Interviewer Agent | ✅ Complete | `backend/interviewer_agent.py` with AI interviewer persona |
| 2 - Backend Integration | ✅ Complete | `role` param in API, room name prefixes, agent dispatch |
| 3 - Frontend Integration | ✅ Complete | `RoleSelector` component, phase-based UI flow |

## Phase Documents

- [Phase 1: Interviewer Agent](./phase1-interviewer-agent.md) - Create the AI interviewer
- [Phase 2: Backend Integration](./phase2-backend-integration.md) - API and dispatch logic
- [Phase 3: Frontend Integration](./phase3-frontend-integration.md) - Role selection UI

## Dependencies

No new dependencies required - uses existing:
- LiveKit Agents SDK
- Deepgram (STT/TTS)
- OpenRouter + Gemini (LLM)
