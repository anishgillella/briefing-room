# Phase 6: Analytics and Scoring

## Status: COMPLETE

## Overview

This phase implements job-specific analytics generation. The key improvement is that analytics are now scored against the job's specific criteria, not generic competencies. Analytics are generated automatically after interviews complete, using Gemini 2.5 Flash via OpenRouter for intelligent evaluation.

## What Changes

| Aspect | Before | After |
|--------|--------|-------|
| Competencies | Generic list | From `job.scoring_criteria.technical_competencies` |
| Red Flags | Global defaults | From `job.red_flags` |
| Scoring Weights | Fixed 50/30/20 | From `job.scoring_criteria.weight_*` |
| Must-Haves | Not tracked | From `job.scoring_criteria.must_haves` |
| Storage | Temporary/file | Persisted to `Analytics` table |
| Trigger | Manual | Automatic on interview end |

## Analytics Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ANALYTICS GENERATION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INPUT                                                                       │
│  ─────                                                                       │
│  • Interview transcript                                                      │
│  • Job record (description, requirements, scoring criteria, red flags)       │
│  • Candidate record (bio, skills)                                            │
│                                                                              │
│  STEP 1: Extract Competencies from Job                                       │
│  ──────────────────────────────────────                                      │
│  • Use job.scoring_criteria.technical_competencies                           │
│  • Use job.scoring_criteria.cultural_fit_traits                              │
│  • Fallback to generic if not defined                                        │
│                                                                              │
│  STEP 2: Analyze Transcript                                                  │
│  ──────────────────────────                                                  │
│  For each competency:                                                        │
│  • Find evidence in transcript                                               │
│  • Score 0-100 based on demonstrated proficiency                             │
│  • Extract relevant quotes                                                   │
│                                                                              │
│  STEP 3: Check Must-Haves                                                    │
│  ─────────────────────────                                                   │
│  For each item in job.scoring_criteria.must_haves:                           │
│  • Determine if candidate demonstrated this                                  │
│  • Flag as critical concern if missing                                       │
│                                                                              │
│  STEP 4: Detect Red Flags                                                    │
│  ─────────────────────────                                                   │
│  For each item in job.red_flags:                                             │
│  • Check if exhibited in transcript                                          │
│  • Flag with evidence if found                                               │
│                                                                              │
│  STEP 5: Calculate Overall Score                                             │
│  ────────────────────────────────                                            │
│  • Apply weights from job.scoring_criteria                                   │
│  • weight_technical × technical_avg                                          │
│  • weight_experience × experience_score                                      │
│  • weight_cultural × cultural_avg                                            │
│  • Deduct for red flags / missing must-haves                                 │
│                                                                              │
│  STEP 6: Generate Recommendation                                             │
│  ────────────────────────────────                                            │
│  Based on overall score and red flags:                                       │
│  • strong_hire (85+, no red flags)                                           │
│  • hire (70+, no critical red flags)                                         │
│  • maybe (50+, minor concerns)                                               │
│  • no_hire (<50 or critical red flags)                                       │
│                                                                              │
│  OUTPUT                                                                      │
│  ──────                                                                      │
│  • Analytics record saved to database                                        │
│  • Linked to Interview → Candidate → Job                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

All analytics endpoints are in `backend/routers/jobs.py` with prefix `/api/jobs`.

### Get Interview Analytics

```
GET /api/jobs/interviews/{interview_id}/analytics
```

**Response:**
```json
{
  "id": "uuid",
  "interview_id": "uuid",
  "candidate_id": "uuid",
  "candidate_name": "John Smith",
  "job_id": "uuid",
  "job_title": "Senior Engineer",
  "overall_score": 82,
  "competency_scores": [
    {
      "name": "Python",
      "score": 90,
      "evidence": ["Quote showing skill"],
      "notes": "Strong experience"
    }
  ],
  "strengths": ["Strong technical skills", "Good communication"],
  "concerns": ["Limited cloud experience"],
  "red_flags_detected": [],
  "recommendation": "hire",
  "recommendation_reasoning": "Strong candidate with solid Python skills",
  "summary": "Experienced developer with strong technical background",
  "created_at": "2024-01-15T10:30:00Z",
  "model_used": "google/gemini-2.5-flash"
}
```

### Get Candidate Analytics

```
GET /api/jobs/{job_id}/candidates/{candidate_id}/analytics
```

Returns all analytics for a candidate across all their interviews for a job.

**Response:**
```json
{
  "job_id": "uuid",
  "job_title": "Senior Engineer",
  "candidate_id": "uuid",
  "candidate_name": "John Smith",
  "analytics": [
    {
      "id": "uuid",
      "interview_id": "uuid",
      "interview_type": "ai_candidate",
      "overall_score": 82,
      "recommendation": "hire",
      "summary": "Strong candidate",
      "strengths": ["..."],
      "concerns": ["..."],
      "red_flags_detected": [],
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total_interviews": 1,
  "total_analytics": 1,
  "average_score": 82.0
}
```

### Get Job Analytics

```
GET /api/jobs/{job_id}/analytics
```

Returns analytics for all candidates in a job, sorted by score.

**Response:**
```json
{
  "job_id": "uuid",
  "job_title": "Senior Engineer",
  "analytics": [
    {
      "id": "uuid",
      "interview_id": "uuid",
      "candidate_name": "John Smith",
      "overall_score": 85,
      "recommendation": "strong_hire",
      "summary": "Excellent candidate",
      "strengths_count": 3,
      "concerns_count": 1,
      "red_flags_count": 0,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 5
}
```

### Job Analytics Summary

```
GET /api/jobs/{job_id}/analytics/summary
```

Returns aggregated analytics metrics for a job.

**Response:**
```json
{
  "job_id": "uuid",
  "job_title": "Senior Engineer",
  "total_candidates": 10,
  "avg_score": 72.5,
  "recommendation_breakdown": {
    "strong_hire": 2,
    "hire": 4,
    "maybe": 3,
    "no_hire": 1
  },
  "top_candidates": [
    {"candidate_name": "John Smith", "score": 85, "recommendation": "strong_hire"},
    {"candidate_name": "Jane Doe", "score": 82, "recommendation": "hire"}
  ]
}
```

### Regenerate Analytics

```
POST /api/jobs/interviews/{interview_id}/analytics/regenerate
```

Regenerates analytics for an interview. Useful when job scoring criteria has been updated.

**Response:**
```json
{
  "message": "Analytics regenerated successfully",
  "analytics_id": "uuid",
  "interview_id": "uuid",
  "overall_score": 78,
  "recommendation": "hire"
}
```

## Analytics Generator Service

Located at `backend/services/analytics_generator.py`, this service:

1. Builds a rich prompt with full job and candidate context
2. Calls Gemini 2.5 Flash via OpenRouter
3. Parses the structured JSON response
4. Stores analytics in the database

Key functions:
- `build_analytics_prompt()` - Creates the LLM prompt
- `generate_analytics()` - Main async entry point
- `generate_analytics_sync()` - Synchronous version for background tasks
- `generate_analytics_background()` - Called automatically after interview ends

## Integration with Interview Flow

Analytics generation is automatically triggered when an interview ends:

```python
# In jobs.py end_interview endpoint
background_tasks.add_task(
    _trigger_analytics_generation,
    str(interview_id)
)

async def _trigger_analytics_generation(interview_id: str):
    from services.analytics_generator import generate_analytics_background
    generate_analytics_background(interview_id)
```

## Test Coverage

Tests are in `backend/tests/test_phase6_analytics.py`:

- **TestAnalyticsGenerator**: Prompt building, response parsing
- **TestAnalyticsGeneratorWithMock**: Full generation with mocked LLM
- **TestAnalyticsEndpoints**: API endpoint validation
- **TestAnalyticsEndpointsWithData**: Endpoints with actual data
- **TestAnalyticsRepository**: CRUD operations
- **TestAnalyticsIntegration**: End-to-end flow

Run tests:
```bash
cd backend
source ../.env  # Load environment variables
python -m pytest tests/test_phase6_analytics.py -v
```

## Key Improvements

1. **Job-Specific Competencies** - Evaluates against the job's defined competencies
2. **Custom Scoring Weights** - Uses the recruiter-defined weight distribution
3. **Must-Have Tracking** - Explicitly checks for non-negotiable requirements
4. **Job Red Flags** - Watches for job-specific concerns
5. **Persistent Storage** - All analytics saved to database
6. **Automatic Generation** - Triggered on interview completion
7. **Regeneration Support** - Can regenerate if criteria changes

## Next Phase

Once analytics are working, proceed to [Phase 7: Recruiter Dashboard](./phase7-recruiter-dashboard.md) to implement the multi-job dashboard view.
