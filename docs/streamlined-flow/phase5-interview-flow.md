# Phase 5: Candidate Interview Flow

## Status: COMPLETE

## Overview

This phase implements the candidate interview flow with full job context. The voice agent (playing the candidate) receives the complete job description, scoring criteria, and company context from the Job record, enabling realistic and role-specific candidate simulations.

## What Changes From Current Flow

| Aspect | Before | After |
|--------|--------|-------|
| Job Context | Only `job_title` from candidate | Full `Job` record with description, requirements, criteria |
| Agent Prompt | Generic based on title | Role-specific based on full JD, company context, scoring criteria |
| Interview Metadata | Limited info | Includes `job_id`, `candidate_id`, `interview_id` for full traceability |
| Interview Record | Not persisted | Saved to `Interview` table with transcript |
| Candidate Status | Manual update | Automatically updated (in_progress → completed) |

## Interview Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CANDIDATE INTERVIEW FLOW (VAPI-BASED)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Start Interview                                                     │
│  ───────────────────────                                                     │
│  • Recruiter clicks "Interview" on candidate                                 │
│  • System loads:                                                             │
│    - Candidate record (bio, skills, experience)                              │
│    - Job record (description, requirements, scoring criteria, company)       │
│  • Creates Interview record (status: in_progress)                            │
│  • Returns Vapi configuration with job-enriched prompt                       │
│  • Candidate status → in_progress                                            │
│                                                                              │
│  STEP 2: Voice Agent Starts                                                  │
│  ─────────────────────────                                                   │
│  • Agent uses full job context in system prompt:                             │
│    - Candidate's bio_summary and skills                                      │
│    - Job's requirements and preferred skills                                 │
│    - Company context (culture, team, growth stage)                           │
│    - Scoring criteria hints (must-haves, nice-to-haves)                      │
│  • Agent plays the candidate role authentically                              │
│                                                                              │
│  STEP 3: Interview Happens                                                   │
│  ─────────────────────────                                                   │
│  • Recruiter interviews the AI candidate                                     │
│  • Natural conversation with role-specific responses                         │
│  • Transcript captured in real-time                                          │
│                                                                              │
│  STEP 4: End Interview                                                       │
│  ─────────────────────                                                       │
│  • Vapi end-of-call webhook OR manual end endpoint                           │
│  • Transcript saved to Interview record                                      │
│  • Duration calculated automatically                                         │
│  • Interview status → completed                                              │
│  • Candidate status → completed                                              │
│  • Triggers analytics generation (Phase 6)                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

All endpoints are in `backend/routers/jobs.py` with prefix `/api/jobs`.

### Start Interview

```
POST /api/jobs/{job_id}/candidates/{candidate_id}/interview/start
```

**Response:**
```json
{
  "interview_id": "uuid",
  "vapi_public_key": "pk_...",
  "assistant_id": "asst_...",
  "candidate_id": "uuid",
  "job_id": "uuid",
  "assistant_overrides": {
    "variableValues": {
      "interview_id": "uuid",
      "candidate_name": "John Smith",
      "job_title": "Senior Engineer",
      ...
    },
    "firstMessage": "Hi, thank you for taking the time...",
    "metadata": {
      "interviewId": "uuid",
      "candidateId": "uuid",
      "jobId": "uuid",
      "mode": "candidate_interview"
    },
    "model": {
      "provider": "openrouter",
      "model": "google/gemini-2.5-flash-preview-09-2025",
      "systemPrompt": "You are John Smith, a job candidate..."
    },
    "voice": {
      "provider": "11labs",
      "voiceId": "nPczCjzI2devNBz1zQrb"
    }
  }
}
```

### End Interview

```
POST /api/jobs/interviews/{interview_id}/end
```

**Response:**
```json
{
  "interview_id": "uuid",
  "status": "completed",
  "duration_seconds": 1234,
  "message": "Interview ended. Analytics will be generated shortly."
}
```

### Interview Webhook (for Vapi)

```
POST /api/jobs/interviews/webhook
```

Handles Vapi events:
- `end-of-call-report`: Saves transcript, marks interview completed

### Get Interview

```
GET /api/jobs/interviews/{interview_id}
```

### List Candidate Interviews

```
GET /api/jobs/{job_id}/candidates/{candidate_id}/interviews
```

## Candidate Persona Prompt

The AI candidate receives a rich prompt built from job context:

```python
def _build_candidate_interview_prompt(candidate, job) -> str:
    """
    Prompt includes:
    - Candidate's professional background (bio_summary)
    - Candidate's skills and experience
    - Company context (name, culture, team size, growth stage)
    - Job requirements (required/preferred skills, experience level)
    - Scoring criteria hints (what interviewers look for)
    - Job description summary
    - Interview guidelines (stay in character, be authentic, etc.)
    """
```

### Example System Prompt

```
You are John Smith, a job candidate being interviewed for the position of Senior Engineer.

YOUR PROFESSIONAL BACKGROUND:
Experienced Python developer with 7 years of backend experience. Led teams at multiple startups.

YOUR KEY SKILLS:
Python, FastAPI, PostgreSQL, Redis, AWS, Docker

CURRENT ROLE:
Staff Engineer at Previous Startup

YEARS OF EXPERIENCE: 7

COMPANY CONTEXT (what you know about the company):
- Company: TechCorp
- Team Size: 12 engineers
- Culture: Collaborative, fast-paced startup
- Growth Stage: Series B
- Reporting To: VP of Engineering

JOB REQUIREMENTS (what the role needs):
- Experience: 5+ years
- Required Skills: Python, FastAPI, PostgreSQL
- Preferred Skills: Redis, AWS, Docker
- Work Type: hybrid
- Location: San Francisco

WHAT THE INTERVIEWER IS LOOKING FOR:
- Must-haves: Python expertise, API design experience
- Nice-to-haves: Cloud infrastructure experience

INTERVIEW GUIDELINES:
1. STAY IN CHARACTER - You ARE John Smith
2. ANSWER AUTHENTICALLY - Give specific examples
3. DEMONSTRATE FIT - Connect experience to requirements
4. BE CONVERSATIONAL - Concise but complete answers
5. SHOW PERSONALITY - Be professional but personable
```

## Key Improvements

1. **Full Job Context** - Agent knows complete job requirements, not just title
2. **Company Context** - Agent can reference culture, team dynamics, growth stage
3. **Scoring Awareness** - Agent subtly addresses what interviewers look for
4. **Full Traceability** - Interview linked to Candidate → Job
5. **Transcript Persistence** - Saved to database for analytics
6. **Automatic Status Updates** - Candidate status flows with interview state
7. **Duration Tracking** - Automatically calculated on interview end

## Test Coverage

Tests are in `backend/tests/test_phase5_interview_flow.py`:

- **TestInterviewStart**: Start interview, verify Vapi config, check job context in prompt
- **TestInterviewEnd**: End interview, verify status updates, duration calculation
- **TestInterviewWebhook**: Webhook handling for end-of-call events
- **TestInterviewQueries**: Get interview, list candidate interviews
- **TestInterviewFlowIntegration**: Complete end-to-end flow

Run tests:
```bash
cd backend
source ../.env  # Load environment variables
python -m pytest tests/test_phase5_interview_flow.py -v
```

## Next Phase

Once interview flow is complete, proceed to [Phase 6: Analytics](./phase6-analytics.md) to implement job-specific scoring and evaluation based on the interview transcript.
