# Phase 2: Dual Parallel Scoring System

**Goal:** Score each candidate 0-100 using both algorithmic and AI evaluation.
**Stack:** Python, OpenRouter `openai/gpt-5-mini`, Pydantic

---

## Requirements Mapping (from README)

| Requirement | Implementation |
|-------------|----------------|
| Score 0-100 | Both Algo (0-100) + AI (0-100) → Average |
| Rank best to worst | Sort by `final_score` descending |
| Clear reasoning | `Evaluation.reasoning` + `pros`/`cons` |
| Handle edge cases | Null checks, fallback scores |

---

## 🛠️ Implementation Specs

### 1. Pydantic Scoring Models

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class Evaluation(BaseModel):
    """AI evaluation output structure"""
    score: int = Field(ge=0, le=100, description="Fit score 0-100")
    one_line_summary: str = Field(description="10-word punchy summary")
    pros: List[str] = Field(min_length=1, max_length=5, description="Top strengths")
    cons: List[str] = Field(min_length=1, max_length=5, description="Top gaps/concerns")
    reasoning: str = Field(description="2-3 sentence explanation of the score")

class ScoredCandidate(BaseModel):
    """Final output for each candidate"""
    id: str
    name: str
    rank: int
    tier: str  # "🔥 Top Match", "✅ Strong Fit", etc.
    
    # Both scores on 0-100 scale
    algo_score: int
    ai_score: int
    final_score: int  # Average of both
    
    # AI evaluation details
    one_line_summary: str
    pros: List[str]
    cons: List[str]
    reasoning: str
    
    # Extracted data (from Phase 1)
    job_title: str
    years_sales_experience: float
    sold_to_finance: bool
    is_founder: bool
    industries: List[str]
    # ... other fields
```

### 2. Algorithmic Score (0-100)

Pure Python logic. **No LLM needed.**

```python
def calculate_algo_score(candidate: dict) -> int:
    score = 0
    
    # Closing Experience (max 30 pts)
    years = candidate.get("years_sales_experience", 0)
    score += min(int(years * 10), 30)  # 3+ years = max
    
    # Finance Sales Fit (max 25 pts) - CRITICAL requirement
    if candidate.get("sold_to_finance"):
        score += 25
    
    # Startup/Founder DNA (max 20 pts)
    if candidate.get("is_founder"):
        score += 20
    elif candidate.get("startup_experience"):
        score += 10
    
    # Deal Size/ACV (max 15 pts)
    acv = candidate.get("max_acv_mentioned") or 0
    if acv >= 100000:
        score += 15
    elif acv >= 50000:
        score += 10
    elif acv > 0:
        score += 5
    
    # Enterprise Experience (max 10 pts)
    if candidate.get("enterprise_experience"):
        score += 10
    
    return min(score, 100)  # Cap at 100
```

### 3. AI Evaluation Score (0-100)

**Model:** `openai/gpt-5-mini` (via OpenRouter)

**Prompt Template:**
```python
SYSTEM = "You are an expert executive recruiter. Return JSON only."

USER = f"""
ROLE: Founding Account Executive at an AI-powered SaaS marketplace
- OTE: $180K-$200K  
- CRITICAL: Must sell to CFOs/Controllers (finance/accounting leaders)
- 1+ years closing experience required
- Startup scrappiness highly valued

CANDIDATE PROFILE:
Name: {name}
Current Title: {job_title}
Experience: {years} years in sales roles
Key Skills: {skills}
Summary: {bio_summary}
Industries: {industries}

SCORING RUBRIC:
90-100: Exceptional - Exceeds all requirements, ideal fit
75-89: Strong - Meets all critical requirements  
60-74: Potential - Some gaps but coachable
40-59: Weak - Missing key requirements
0-39: Not a fit - Wrong background

EVALUATE this candidate. Return JSON matching this schema:
{Evaluation.model_json_schema()}
"""
```

### 4. Final Score Calculation

```python
def calculate_final_score(algo: int, ai: int) -> int:
    # Simple average of both 0-100 scores
    return round((algo + ai) / 2)

def assign_tier(score: int) -> str:
    if score >= 80:
        return "🔥 Top Match"
    elif score >= 65:
        return "✅ Strong Fit"
    elif score >= 50:
        return "⚠️ Consider"
    else:
        return "❌ Not a Fit"
```

### 5. Edge Case Handling

| Scenario | Handling |
|----------|----------|
| Missing `years_sales_experience` | Default to 0, penalizes score naturally |
| No `bio_summary` from Phase 1 | Use fallback prompt with available data |
| LLM returns invalid JSON | Retry once, then assign `ai_score = 50` |
| `sold_to_finance` = null | Treat as `False` (conservative) |

### 6. Output File

**Path:** `backend/data/ranked_candidates.json`

```json
[
  {
    "rank": 1,
    "id": "abc123",
    "name": "Sarah Chen",
    "tier": "🔥 Top Match",
    "algo_score": 85,
    "ai_score": 92,
    "final_score": 89,
    "one_line_summary": "Enterprise closer with CFO sales, 3x founder exits",
    "pros": ["5 years closing exp", "Sold directly to CFOs", "Founded 2 startups"],
    "cons": ["OTE may be above range", "No fintech specifically"],
    "reasoning": "Exceptional candidate with direct finance sales experience..."
  },
  ...
]
```

---

## ✅ Do's
- **DO** run algo scoring BEFORE AI (it's instant, provides quick baseline).
- **DO** include the algo score in the prompt context so AI can calibrate.
- **DO** validate all LLM responses with Pydantic `model_validate_json`.

## ❌ Don'ts
- **DON'T** weight the scores (40/60). Use **simple average** for transparency.
- **DON'T** skip edge case handling—missing data should degrade gracefully.
