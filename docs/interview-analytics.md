# AI Highlights & Coach Mode

## Overview

Two new features to enhance the interview experience:

1. **AI Highlights** - TL;DR of the interview with key moments
2. **Coach Mode** - Proactive suggestions during the interview

---

## AI Highlights

Extracted automatically from the interview transcript in the debrief:

| Type | Description |
|------|-------------|
| 🌟 **Best Answer** | Strongest response with explanation |
| 🚩 **Red Flag** | Concern with context |
| 💡 **Quotable Moment** | Notable candidate quote |
| ⚠️ **Area to Probe** | Needs follow-up in next round |

### Example Output

```json
{
  "highlights": {
    "best_answer": {
      "quote": "At my previous company, I led a team of 5 to redesign...",
      "context": "Strong STAR response showing leadership"
    },
    "red_flag": {
      "quote": "I've worked with distributed systems",
      "context": "Vague claim with no specifics despite probing"
    },
    "quotable_moment": "I believe in shipping fast and learning from users",
    "areas_to_probe": ["Leadership depth", "Technical system design"]
  }
}
```

---

## Real-Time Coach Mode

AI sidebar provides proactive suggestions during the interview:

| Trigger | Suggestion |
|---------|-----------|
| Vague answer | "💡 Ask for a specific example" |
| No technical questions in 10 min | "📊 Consider exploring technical depth" |
| Candidate claim vs resume mismatch | "🔍 Their resume doesn't mention X - verify" |
| Time running low | "⏰ 8 mins left - cover culture fit" |

### API Endpoint

`POST /api/coach/suggest`

**Request:**
```json
{
  "transcript_chunk": "Recent conversation...",
  "elapsed_minutes": 15,
  "questions_asked": ["behavioral", "behavioral"],
  "briefing_context": "Role requirements..."
}
```

**Response:**
```json
{
  "suggestion": "You've asked 2 behavioral questions. Consider a technical deep-dive.",
  "type": "question_coverage",
  "priority": "medium"
}
```

---

## Files

| File | Purpose |
|------|---------|
| `backend/models/analytics.py` | Enhanced with Highlights model |
| `backend/routers/coach.py` | Coach Mode endpoint |
| `frontend/src/components/ai-chat-sidebar.tsx` | Coach Mode integration |
| `frontend/src/components/debrief-screen.tsx` | Highlights display |
