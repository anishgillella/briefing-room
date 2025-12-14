# Phase 1: Candidate Feedback Loop

Automatically send personalized, constructive feedback to candidates after interviews.

## Problem Statement

- 72% of candidates never hear back from companies
- Bad candidate experience = negative Glassdoor reviews
- Rejected candidates could be future customers or referrers

## Solution

After each interview (including rejections), auto-generate a personalized feedback email highlighting strengths and areas for improvement.

---

## User Flow

```
Interview Completed
       │
       ▼
┌─────────────────────────┐
│  AI generates feedback  │
│  (based on analytics)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Recruiter reviews      │
│  (optional edit)        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Email sent to candidate│
│  (branded template)     │
└─────────────────────────┘
```

---

## Database Schema

```sql
-- Add to existing schema
CREATE TABLE candidate_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    interview_id UUID REFERENCES interviews(id),
    
    -- Generated content
    feedback_text TEXT NOT NULL,
    strengths JSONB DEFAULT '[]',
    improvements JSONB DEFAULT '[]',
    percentile_rank INT,  -- "Top 30% of applicants"
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'skipped')),
    reviewed_by TEXT,
    sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## AI Prompt for Feedback Generation

```python
FEEDBACK_PROMPT = """
Generate constructive interview feedback for a candidate.

INTERVIEW DATA:
- Candidate: {candidate_name}
- Role: {job_title}
- Overall Score: {score}/100
- Recommendation: {recommendation}

QUESTION ANALYTICS:
{question_analytics}

GUIDELINES:
1. Be encouraging but honest
2. Highlight 2-3 specific strengths with examples
3. Suggest 1-2 areas for improvement (actionable)
4. Do NOT mention: other candidates, specific scores, internal notes
5. Keep tone professional but warm

OUTPUT FORMAT:
{{
  "greeting": "Hi {first_name},",
  "opening": "Thank you for interviewing...",
  "strengths": [
    {{"area": "Communication", "detail": "Your explanation of X was clear and structured."}},
    ...
  ],
  "improvements": [
    {{"area": "Technical Depth", "suggestion": "Consider practicing..."}}
  ],
  "closing": "We appreciate your time...",
  "percentile_message": "Your interview performance was in the top X% of applicants."
}}
"""
```

---

## Email Template

```html
Subject: Your Interview Feedback - {company_name}

Hi {first_name},

Thank you for taking the time to interview for the {job_title} position at {company_name}.

**What Stood Out:**
{for strength in strengths}
✅ {strength.area}: {strength.detail}
{endfor}

**Suggestions for Future Interviews:**
{for improvement in improvements}
💡 {improvement.area}: {improvement.suggestion}
{endfor}

{percentile_message}

We encourage you to apply for future roles that match your experience.

Best regards,
The {company_name} Team
```

---

## API Endpoints

```python
@router.post("/candidates/{candidate_id}/generate-feedback")
async def generate_feedback(candidate_id: str, interview_id: str):
    """Generate AI feedback based on interview analytics."""
    analytics = get_analytics(interview_id)
    feedback = await generate_feedback_with_ai(analytics)
    save_feedback(candidate_id, interview_id, feedback)
    return feedback

@router.patch("/feedback/{feedback_id}/approve")
async def approve_feedback(feedback_id: str, edits: Optional[str] = None):
    """Recruiter approves (optionally edits) feedback before sending."""
    if edits:
        update_feedback_text(feedback_id, edits)
    mark_as_approved(feedback_id)
    return {"status": "approved"}

@router.post("/feedback/{feedback_id}/send")
async def send_feedback(feedback_id: str):
    """Send approved feedback to candidate."""
    feedback = get_feedback(feedback_id)
    send_email(feedback.candidate.email, format_email(feedback))
    mark_as_sent(feedback_id)
    return {"status": "sent"}
```

---

## Frontend UI

Add to candidate page:

```tsx
{/* Feedback Section (after decision) */}
{candidate.final_decision && (
  <div className="glass-panel rounded-3xl p-6 mt-6">
    <h3 className="text-white/60 text-sm uppercase mb-4">Candidate Feedback</h3>
    
    {feedback.status === 'pending' && (
      <>
        <div className="bg-black/20 rounded-xl p-4 mb-4 text-white/80 text-sm">
          {feedback.feedback_text}
        </div>
        <div className="flex gap-3">
          <button onClick={approveFeedback} className="btn-primary">
            Approve & Send
          </button>
          <button onClick={() => setEditMode(true)} className="btn-secondary">
            Edit First
          </button>
          <button onClick={skipFeedback} className="btn-ghost text-white/40">
            Skip
          </button>
        </div>
      </>
    )}
    
    {feedback.status === 'sent' && (
      <div className="text-green-400 flex items-center gap-2">
        <CheckCircle className="w-4 h-4" />
        Feedback sent on {formatDate(feedback.sent_at)}
      </div>
    )}
  </div>
)}
```

---

## Metrics to Track

| Metric | Target |
|--------|--------|
| Feedback generation time | < 3 seconds |
| Recruiter approval rate | > 80% |
| Candidate email open rate | > 50% |
| Candidate reply rate | > 5% |

---

## Implementation Checklist

- [ ] Add `candidate_feedback` table to schema
- [ ] Create feedback generation prompt
- [ ] Build approve/edit/send API endpoints
- [ ] Create email template
- [ ] Add feedback section to candidate page
- [ ] Set up email sending (SendGrid/Resend)

---

## Next: [Phase 2 - Skills Gap Intelligence](./phase2_skills_gap.md)
