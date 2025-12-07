# Pre-Interview Visual Brief

## Overview

Before the interview starts, the interviewer gets an instant **visual analysis** of the candidate's fit for the role. This replaces the auto-playing voice agent with a scannable dashboard that answers key questions at a glance.

---

## The Insight

**People scan faster than they listen.**

A visual brief lets interviewers:
- Glance at fit score in 2 seconds
- Scan strengths/concerns in 10 seconds  
- Decide if they need to ask AI for more context

Voice agent becomes **opt-in** for deep-dive questions.

---

## What It Shows

### 1. Overall Fit Score
```
Overall Match: 78/100 🟢
```
Single number summarizing candidate-job alignment.

### 2. Strong Points
```
✅ Strong Points:
 • 5 years Python + React experience
 • Led team of 4 at similar-stage startup
 • Matches 7/9 required skills
 • Strong communication in past roles
```

### 3. Areas to Probe
```
⚠️ Areas to Probe:
 • Leadership depth (only 1 year as lead)
 • No distributed systems experience
 • Vague about scaling claims in resume
```

### 4. Suggested Questions
```
🔍 Suggested Interview Questions:
 1. "Tell me about a time you led your team through a technical challenge"
 2. "How did you approach scaling X from Y to Z users?"
 3. "What was your role in the architecture decisions at Company X?"
```

### 5. Voice Agent (Opt-In)
```
[💬 Ask AI Coach About This Candidate]
```
Button to activate voice conversation for deeper questions.

---

## Technical Architecture

### Backend

**New Endpoint:** `POST /api/rooms/{room_name}/pre-brief`

**Request:**
```json
{
  "job_description": "Senior Software Engineer...",
  "resume": "John has 5 years experience..."
}
```

**Response:**
```json
{
  "overall_fit_score": 78,
  "strong_points": [
    "5 years Python + React experience",
    "Led team of 4 at similar-stage startup"
  ],
  "areas_to_probe": [
    "Leadership depth (only 1 year as lead)",
    "No distributed systems experience"
  ],
  "suggested_questions": [
    "Tell me about a time you led your team...",
    "How did you approach scaling X..."
  ],
  "skill_breakdown": {
    "technical": 85,
    "leadership": 65,
    "communication": 80,
    "domain_knowledge": 70
  }
}
```

### Frontend

**Component:** `PreInterviewBrief` (new)

**Location:** `frontend/src/components/pre-interview-brief.tsx`

**Flow:**
1. User uploads job description + resume
2. Call `/api/rooms/{room_name}/pre-brief` immediately
3. Display visual brief
4. Show **"Ask AI Coach"** button
5. On button click → activate voice agent with context

---

## Implementation Plan

### Backend Changes

| File | Changes |
|------|---------|
| `backend/models/analytics.py` | Add `PreInterviewBrief` Pydantic model |
| `backend/routers/briefing.py` | New router with `/pre-brief` endpoint |
| `backend/main.py` | Register briefing router |

### Frontend Changes

| File | Changes |
|------|---------|
| `frontend/src/components/pre-interview-brief.tsx` | New visual brief component |
| `frontend/src/lib/api.ts` | Add `getPreInterviewBrief()` function |
| `frontend/src/components/video-room.tsx` | Show brief before voice agent |

---

## LLM Prompt Strategy

**System Prompt:**
```
You are an expert hiring analyst. Given a job description and candidate resume, 
provide a brief pre-interview analysis.

Focus on:
1. Clear fit score (0-100)
2. 3-5 concrete strengths
3. 3-5 areas needing deeper exploration
4. 3-5 specific behavioral/technical questions to ask

Be concise and actionable. Use evidence from the resume.
```

**User Prompt:**
```
Job Description:
{job_description}

Candidate Resume:
{resume}

Analyze this candidate's fit and provide actionable interview guidance.
```

---

## UX Flow

```
1. Interviewer uploads JD + Resume
   ↓
2. Loading spinner (2-3s)
   ↓
3. Visual Brief appears
   ├─ Fit Score: 78/100
   ├─ Strengths (4 items)
   ├─ Areas to Probe (3 items)
   ├─ Suggested Questions (3-5)
   └─ [💬 Ask AI Coach] button
   ↓
4. Interviewer can:
   • Scan and mentally prepare
   • Click voice button for clarifications
   ↓
5. Candidate joins → Brief auto-dismisses
```

---

## Benefits Over Auto-Voice

| Metric | Auto-Voice | Visual Brief |
|--------|-----------|--------------|
| Time to first insight | 30-60s | 2s |
| Reference during interview | ❌ (audio gone) | ✅ (stays visible) |
| Interviewer control | ❌ (must listen) | ✅ (scan at own pace) |
| Accessibility | Audio-only | Visual + audio opt-in |

---

## Optional Enhancement: Pre/Post Comparison

Show in post-interview debrief:

```
📊 Concerns Addressed in Interview:

⚠️ Flagged: Leadership depth unclear
✅ Result: Strong STAR response (8/10 behavioral score)

⚠️ Flagged: No distributed systems experience  
🟡 Result: Adequate understanding but needs growth
```

**Implementation:** Match pre-brief "areas_to_probe" with post-interview topic scores.

---

## Files Overview

```
backend/
  models/analytics.py         # Add PreInterviewBrief model
  routers/briefing.py         # New router for pre-brief endpoint
  main.py                     # Register briefing router

frontend/
  src/components/
    pre-interview-brief.tsx   # Visual brief component
  src/lib/api.ts             # Add getPreInterviewBrief()
```

---

## Success Metrics

1. **< 3s** to show visual brief
2. **< 10s** for interviewer to feel prepared
3. **< 30%** opt-in rate for voice agent (visual is sufficient)
4. **Positive feedback** on "preparedness" in user testing
