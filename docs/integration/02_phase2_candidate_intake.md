# Phase 2: Candidate Intake Integration

## Goal
Enable candidates to fill in resume gaps via a voice interview with an AI agent.

## User Journey

```
Recruiter sends link → Candidate uploads resume → AI identifies gaps → Voice interview → Enriched profile
```

---

## 2.1 Intake Link Generation

### New Endpoint
```python
POST /api/pluto/candidates/{candidate_id}/intake-link
```

### Response
```json
{
  "intake_url": "https://app.superposition.ai/intake/{candidate_id}?token={secure_token}",
  "expires_at": "2024-12-15T00:00:00Z",
  "candidate_name": "John Doe"
}
```

### Token Security
- Short-lived JWT (48h expiry)
- Contains: candidate_id, issuer, expiry
- Validates on intake page load

---

## 2.2 Intake Flow

### Frontend Route
```
/intake/{candidate_id} → IntakeOnboardingPage
```

### Steps
1. **Verify Token** - Check JWT validity
2. **Show Candidate Info** - Display extracted resume data
3. **Gap Analysis** - Show missing fields with questions
4. **Voice Session** - LiveKit agent interviews candidate
5. **Confirmation** - Show enriched profile

---

## 2.3 LiveKit Agent Integration

### Agent System Prompt
```
You are an AI assistant helping {candidate_name} complete their professional profile.

We have extracted the following from their resume:
{extracted_data}

We need to fill in these gaps:
{missing_fields}

Ask questions conversationally to collect:
1. {gap_1}
2. {gap_2}
...

When you receive an answer, call the update_candidate_profile function.
Keep the conversation natural and professional.
End when all gaps are filled or candidate says they're done.
```

### Function Calling
```python
@function_tool
def update_candidate_profile(field_name: str, field_value: str):
    """Update candidate profile with extracted information."""
    # Send to backend
    # Update live UI
```

---

## 2.4 Data Merging

### On Intake Completion
1. Fetch original candidate record
2. Store snapshot of original in `original_data`
3. Merge new fields
4. Set metadata:
   ```python
   candidate.has_enrichment_data = True
   candidate.enrichment_date = datetime.now()
   candidate.enrichment_fields = ["phone", "years_experience", ...]
   ```
5. Optionally trigger re-scoring

### Conflict Resolution
- Enriched data takes precedence
- Original data preserved for audit

---

## 2.5 Recruiter Notifications

### After Intake Completion
- Update candidate status: `intake_completed`
- Show indicator in rankings table
- Optional: Email notification to recruiter

---

## Files to Create/Modify

### Backend
| File | Action | Description |
|------|--------|-------------|
| `routers/intake.py` | CREATE | Intake link generation, validation |
| `services/livekit_intake.py` | CREATE | LiveKit agent for intake |
| `models/intake.py` | CREATE | Intake session models |

### Frontend
| File | Action | Description |
|------|--------|-------------|
| `app/intake/[id]/page.tsx` | CREATE | Candidate intake page |
| `components/intake-flow.tsx` | CREATE | Multi-step intake wizard |

---

## Success Criteria

- [ ] Can generate unique intake link for candidate
- [ ] Link is secure (expires, validates)
- [ ] Candidate sees their extracted data
- [ ] Voice agent asks relevant gap-filling questions
- [ ] Answers update candidate profile in real-time
- [ ] Recruiter sees enriched data in rankings
