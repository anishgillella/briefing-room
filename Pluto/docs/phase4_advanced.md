# Phase 4: Advanced Features (Over-Delivery)

**Goal:** Go beyond requirements with innovative features that showcase AI sophistication.
**Stack:** Python, OpenRouter, Pydantic

---

## 🚀 Features to Implement

### Feature 1: Red Flag Detection 🚩

Automatically surface potential concerns for each candidate.

**Pydantic Model:**
```python
class RedFlags(BaseModel):
    job_hopping: bool = Field(description="True if avg tenure < 18 months across 3+ roles")
    title_inflation: bool = Field(description="True if titles seem inconsistent with experience")
    gaps_in_employment: bool = Field(description="True if unexplained gaps > 6 months")
    overqualified: bool = Field(description="True if likely expecting above $200k OTE")
    red_flag_count: int = Field(description="Total number of flags raised")
    concerns: List[str] = Field(description="Specific concerns to probe in interview")
```

**Implementation:**
- Run as part of Phase 1 extraction (add to Gemini prompt).
- Display as warning badges in UI.

---

### Feature 2: Interview Questions Generator 💬

Generate tailored interview questions based on candidate gaps.

**Pydantic Model:**
```python
class InterviewQuestions(BaseModel):
    questions: List[str] = Field(min_length=3, max_length=5, description="Targeted questions")
    focus_areas: List[str] = Field(description="What these questions probe")
```

**Prompt Strategy:**
```
Based on this candidate's profile and their CONS/gaps, generate 5 interview questions that:
1. Probe their weaker areas
2. Validate claimed achievements
3. Test cultural fit for a startup
```

**Implementation:**
- Generate after scoring in Phase 2.
- Include in the `ScoredCandidate` output.

---

### Feature 3: Candidate Head-to-Head Comparison ⚖️

Pre-compute comparisons between top candidates for the Compare Mode UI.

**Pydantic Model:**
```python
class HeadToHead(BaseModel):
    candidate_a: str
    candidate_b: str
    winner: str = Field(description="Name of the stronger candidate for this role")
    key_differentiators: List[str] = Field(description="3 main differences")
    trade_off_summary: str = Field(description="One sentence on the trade-off")
```

**Implementation:**
- After ranking, compare Top 5 in pairs (10 comparisons).
- Store in `ranked_candidates.json` under a `comparisons` key.

---

### Feature 4: Outreach Email Drafter ✉️

Generate personalized recruiting emails for top candidates.

**Pydantic Model:**
```python
class OutreachEmail(BaseModel):
    subject: str = Field(description="Compelling email subject line")
    body: str = Field(description="3-4 sentence personalized email")
    personalization_hooks: List[str] = Field(description="Specific achievements referenced")
```

**Prompt Strategy:**
```
Write a compelling, personalized outreach email to {name} for the Founding AE role.
Reference their specific achievements: {pros}
Keep it under 100 words. Be warm but professional.
```

**Implementation:**
- Generate only for Tier 1 ("Top Match") candidates.
- Display in candidate detail view.

---

### Feature 5: Batch Analytics Summary 📈

Provide insights about the entire candidate pool.

**Pydantic Model:**
```python
class BatchAnalytics(BaseModel):
    total_candidates: int
    average_score: float
    score_distribution: dict  # {"80-100": 4, "60-79": 8, ...}
    top_missing_skills: List[str] = Field(description="Skills the pool lacks")
    sourcing_recommendation: str = Field(description="Advice on where to find better candidates")
```

**Implementation:**
- Generate once after all candidates are scored.
- Display on dashboard header.

---

## Implementation Priority

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| 🚩 Red Flags | Low | High | ⭐ P0 |
| 💬 Interview Questions | Low | High | ⭐ P0 |
| ⚖️ Head-to-Head | Medium | Medium | P1 |
| ✉️ Outreach Emails | Low | Medium | P1 |
| 📈 Batch Analytics | Medium | Medium | P2 |

---

## ✅ Do's
- **DO** generate Red Flags and Interview Questions during the same LLM call as scoring (saves API costs).
- **DO** limit Head-to-Head to Top 5 only (avoids O(n²) explosion).

## ❌ Don'ts
- **DON'T** block the main scoring flow for these features—run them in parallel or as post-processing.
- **DON'T** generate outreach emails for low-tier candidates (waste of tokens).

---

## Note on Confidence Calibration

You correctly noted that we're already extracting `reasoning` for each candidate. The "confidence" signal is implicitly captured in:
1. **How definitive the reasoning is** (strong language vs hedging)
2. **Profile completeness** (if we had to guess on missing data)

Rather than adding an explicit `confidence: float` field, we can let the UI interpret the reasoning tone. If needed later, we can add it as a simple heuristic based on data availability.
