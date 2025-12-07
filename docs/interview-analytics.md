# Interview Analytics, AI Highlights & Coach Mode

## Overview

Three features to enhance the interview experience:

1. **Interview Analytics** - Per-question scoring and overall metrics
2. **AI Highlights** - TL;DR of key moments in the debrief
3. **Coach Mode** - Real-time suggestions during the interview

---

## Interview Analytics

### API Endpoint

`POST /api/analytics/{room_name}`

**Request:**
```json
{
  "transcript": "Interviewer: Tell me about... Candidate: ...",
  "job_description": "Senior Software Engineer...",
  "resume": "John has 5 years experience..."
}
```

### Per-Question Metrics

| Metric | Range | Description |
|--------|-------|-------------|
| Relevance | 0-10 | Did answer address the question? |
| Clarity | 0-10 | Well-structured response? |
| Depth | 0-10 | Thorough vs surface-level? |
| Type-Specific | 0-10 | STAR/Technical accuracy based on type |

### Overall Metrics

| Metric | Description |
|--------|-------------|
| Overall Score | 0-100 combined performance |
| Communication | Average clarity |
| Technical | Average technical accuracy |
| Cultural Fit | Inferred from behavioral responses |
| Recommendation | Strong Hire → No Hire |
| Recommendation Reasoning | **WHY** the recommendation |

---

## AI Highlights (TL;DR)

Displayed in the debrief after each interview:

| Type | Description |
|------|-------------|
| 🌟 **Best Answer** | Strongest response + why it was strong |
| 🚩 **Red Flag** | Concerning moment + why (if any) |
| 💬 **Quotable Moment** | Memorable quote capturing the candidate |
| 🔍 **Areas to Probe** | Topics needing follow-up in next round |

---

## Real-Time Coach Mode

### How It Works

1. Coach detects when a Q&A exchange completes (Interviewer → Candidate pattern)
2. Sends the exchange to Gemini for analysis
3. Returns a suggested next question with context

### API Endpoint

`POST /api/coach/suggest`

**Request:**
```json
{
  "last_exchange": "Interviewer: Tell me about a time... Candidate: At my previous company...",
  "full_transcript": "Full conversation so far...",
  "elapsed_minutes": 15,
  "briefing_context": "Job description/resume summary"
}
```

**Response:**
```json
{
  "last_question_type": "behavioral",
  "answer_quality": "strong",
  "suggested_next_question": "Can you tell me about a technical challenge you faced?",
  "reasoning": "Good behavioral answer, now explore technical depth",
  "should_change_topic": true,
  "topic_suggestion": "Technical skills"
}
```

### UI in Sidebar

The AI sidebar shows:
- **Answer Quality Badge**: ✓ Strong / ○ Adequate / ⚠ Needs probing
- **Suggested Next Question**: The exact question to ask
- **Reasoning**: Why this question
- **Topic Change**: If relevant, when to switch topics

---

## Robustness Features

- **Retry Logic**: Up to 2 retries on validation errors
- **Data Normalization**: Handles LLM returning null fields gracefully
- **Graceful Fallbacks**: Sensible defaults if API fails

---

## Files

| File | Purpose |
|------|---------|
| `backend/models/analytics.py` | Pydantic models for all analytics |
| `backend/routers/analytics.py` | Analytics endpoint with retry logic |
| `backend/routers/coach.py` | Coach Mode endpoint |
| `frontend/src/lib/api.ts` | TypeScript types and API functions |
| `frontend/src/components/debrief-screen.tsx` | Highlights + Recommendation display |
| `frontend/src/components/ai-chat-sidebar.tsx` | Coach Mode UI integration |
