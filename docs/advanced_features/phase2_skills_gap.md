# Phase 2: Skills Gap Intelligence

Aggregate analytics across all candidates and interviews to identify hiring patterns and optimize job descriptions.

## Problem Statement

- Companies don't know which skills they're consistently missing
- Job descriptions often include requirements that are never tested
- Some "requirements" eliminate good candidates who could learn quickly

## Solution

A dashboard that aggregates data across ALL candidates and interviews to surface actionable insights.

---

## Dashboard Sections

### 1. Skills Coverage Analysis

```
┌────────────────────────────────────────────────────────────┐
│  📊 Skills Coverage Analysis                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Skills in JD vs. Skills Tested vs. Skills Found           │
│                                                            │
│  Python          ███████████████████████  92% tested       │
│  Leadership      ██████████░░░░░░░░░░░░  45% tested       │
│  SQL             ██████████████████░░░░  78% tested       │
│  "5+ years"      ░░░░░░░░░░░░░░░░░░░░░░  Not verified!    │
│                                                            │
│  ⚠️ "Leadership" in JD but only tested in 45% of interviews│
│  💡 Recommendation: Add behavioral questions for leadership│
└────────────────────────────────────────────────────────────┘
```

### 2. Candidate Pool Analysis

```
┌────────────────────────────────────────────────────────────┐
│  📊 Candidate Pool Insights                                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Total Candidates: 1,245                                   │
│  With "Python": 890 (71%)                                  │
│  With "5+ years": 234 (19%)  ⚠️ Limiting factor!          │
│                                                            │
│  Skills Correlation with Success:                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  "Startup Experience" → 2.3x more likely to hire    │   │
│  │  "Enterprise Sales"   → 1.8x more likely to hire    │   │
│  │  "MBA"                → 0.7x (negative correlation) │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  💡 Consider relaxing "5+ years" to expand pool            │
└────────────────────────────────────────────────────────────┘
```

### 3. Interview Question Effectiveness

```
┌────────────────────────────────────────────────────────────┐
│  📊 Question Effectiveness                                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Most Predictive Questions (high score variance):          │
│  1. "Describe a time you failed..." - Variance: 34        │
│  2. "Walk me through your process..." - Variance: 28      │
│                                                            │
│  Least Useful Questions (everyone scores the same):        │
│  1. "Tell me about yourself" - Variance: 3                │
│  2. "Why this company?" - Variance: 5                     │
│                                                            │
│  💡 Replace low-variance questions with more discriminating│
└────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Materialized view for performance
CREATE MATERIALIZED VIEW skills_gap_metrics AS
SELECT 
    jp.id as job_posting_id,
    jp.title,
    
    -- Skills in JD
    jp.scoring_criteria->>'required_skills' as jd_required_skills,
    
    -- Skills found in candidates
    (
        SELECT jsonb_agg(DISTINCT skill)
        FROM candidates c, jsonb_array_elements_text(c.skills) AS skill
        WHERE c.job_posting_id = jp.id
    ) as candidate_skills,
    
    -- Skills tested in interviews (from question topics)
    (
        SELECT jsonb_agg(DISTINCT qa.topic)
        FROM analytics a
        JOIN interviews i ON a.interview_id = i.id
        JOIN candidates c ON i.candidate_id = c.id,
        jsonb_array_elements(a.question_analytics) as qa
        WHERE c.job_posting_id = jp.id
    ) as tested_skills,
    
    -- Hiring stats
    COUNT(DISTINCT c.id) as total_candidates,
    COUNT(DISTINCT CASE WHEN c.final_decision = 'accepted' THEN c.id END) as hired,
    AVG(c.combined_score) as avg_score
    
FROM job_postings jp
LEFT JOIN candidates c ON c.job_posting_id = jp.id
GROUP BY jp.id, jp.title, jp.scoring_criteria;

-- Refresh periodically
CREATE OR REPLACE FUNCTION refresh_skills_gap_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW skills_gap_metrics;
END;
$$ LANGUAGE plpgsql;
```

---

## API Endpoints

```python
@router.get("/analytics/skills-gap/{job_posting_id}")
async def get_skills_gap_analysis(job_posting_id: str):
    """Get skills gap analysis for a job posting."""
    return {
        "jd_skills": get_jd_skills(job_posting_id),
        "tested_skills": get_tested_skills(job_posting_id),
        "candidate_skills": get_candidate_skill_distribution(job_posting_id),
        "skill_success_correlation": get_skill_hire_correlation(job_posting_id),
        "recommendations": generate_recommendations(job_posting_id)
    }

@router.get("/analytics/question-effectiveness/{job_posting_id}")
async def get_question_effectiveness(job_posting_id: str):
    """Analyze which interview questions are most predictive."""
    questions = get_all_questions_for_job(job_posting_id)
    return [
        {
            "question_pattern": q.pattern,
            "times_asked": q.count,
            "score_variance": q.variance,
            "correlation_with_hire": q.hire_correlation,
            "recommendation": "keep" if q.variance > 15 else "replace"
        }
        for q in questions
    ]
```

---

## AI Recommendations Engine

```python
def generate_recommendations(job_posting_id: str) -> List[str]:
    """Generate actionable recommendations based on data."""
    recommendations = []
    
    # Check for skills in JD but not tested
    untested = get_untested_skills(job_posting_id)
    if untested:
        recommendations.append(
            f"Skills in JD but rarely tested: {', '.join(untested)}. "
            f"Add interview questions for these or remove from requirements."
        )
    
    # Check for limiting requirements
    limiting = get_limiting_requirements(job_posting_id)
    for req in limiting:
        if req.candidate_rate < 0.20:
            recommendations.append(
                f"Only {req.candidate_rate*100:.0f}% of candidates meet '{req.name}'. "
                f"Consider relaxing this requirement to expand candidate pool."
            )
    
    # Check for low-value questions
    low_variance_qs = get_low_variance_questions(job_posting_id)
    if low_variance_qs:
        recommendations.append(
            f"Questions with low predictive value: {', '.join(low_variance_qs[:3])}. "
            f"Replace with more discriminating questions."
        )
    
    return recommendations
```

---

## Frontend Dashboard

```tsx
// Skills Gap Dashboard
<div className="grid grid-cols-2 gap-6">
  {/* Skills Coverage */}
  <div className="glass-panel rounded-3xl p-6">
    <h3 className="text-white/60 text-sm uppercase mb-4">Skills Coverage</h3>
    {skillsCoverage.map(skill => (
      <div key={skill.name} className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-white">{skill.name}</span>
          <span className={skill.testRate > 0.5 ? 'text-green-400' : 'text-yellow-400'}>
            {(skill.testRate * 100).toFixed(0)}% tested
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`h-full ${skill.testRate > 0.5 ? 'bg-green-500' : 'bg-yellow-500'}`}
            style={{ width: `${skill.testRate * 100}%` }}
          />
        </div>
      </div>
    ))}
  </div>

  {/* Recommendations */}
  <div className="glass-panel rounded-3xl p-6">
    <h3 className="text-white/60 text-sm uppercase mb-4">AI Recommendations</h3>
    {recommendations.map((rec, i) => (
      <div key={i} className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-3">
        <Lightbulb className="w-4 h-4 text-yellow-400 inline mr-2" />
        <span className="text-yellow-200 text-sm">{rec}</span>
      </div>
    ))}
  </div>
</div>
```

---

## Implementation Checklist

- [ ] Create materialized view for skills gap metrics
- [ ] Build skills coverage analysis API
- [ ] Build question effectiveness analysis API
- [ ] Create AI recommendations engine
- [ ] Build dashboard UI components
- [ ] Add job posting-level and global views
- [ ] Set up periodic refresh of materialized views

---

## Next: [Phase 3 - Candidate Warm-Up Mode](./phase3_warmup_mode.md)
