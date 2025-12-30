# Phase 6: Analytics and Scoring

## Overview

This phase implements job-specific analytics generation. The key improvement is that analytics are now scored against the job's specific criteria, not generic competencies.

## What Changes

| Aspect | Before | After |
|--------|--------|-------|
| Competencies | Generic list | From `job.scoring_criteria.technical_competencies` |
| Red Flags | Global defaults | From `job.red_flags` |
| Scoring Weights | Fixed 50/30/20 | From `job.scoring_criteria.weight_*` |
| Must-Haves | Not tracked | From `job.scoring_criteria.must_haves` |
| Storage | Temporary/file | Persisted to `Analytics` table |

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

## Analytics Service

```python
# backend/services/analytics_generator.py

from typing import List, Optional, Dict, Any
from uuid import UUID
import json

from models.streamlined.job import Job, ScoringCriteria
from models.streamlined.candidate import Candidate
from models.streamlined.interview import Interview
from models.streamlined.analytics import Analytics, AnalyticsCreate, CompetencyScore
from repositories.streamlined.analytics_repo import AnalyticsRepository
from repositories.streamlined.interview_repo import InterviewRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from repositories.streamlined.job_repo import JobRepository
from services.llm_client import call_llm


# Default competencies if job doesn't have specific ones
DEFAULT_COMPETENCIES = [
    "Technical Knowledge",
    "Problem Solving",
    "Communication",
    "Teamwork",
    "Leadership Potential",
    "Cultural Fit",
]


def build_analytics_prompt(
    transcript: str,
    job: Job,
    candidate: Candidate,
) -> str:
    """Build the prompt for analytics generation."""

    # Get competencies from job or use defaults
    competencies = []
    if job.scoring_criteria:
        competencies.extend(job.scoring_criteria.technical_competencies or [])
        competencies.extend(job.scoring_criteria.cultural_fit_traits or [])
    if not competencies:
        competencies = DEFAULT_COMPETENCIES

    # Get must-haves and red flags
    must_haves = []
    if job.scoring_criteria:
        must_haves = job.scoring_criteria.must_haves or []

    red_flags = job.red_flags or []

    # Get weights
    weight_technical = 0.5
    weight_experience = 0.3
    weight_cultural = 0.2
    if job.scoring_criteria:
        weight_technical = job.scoring_criteria.weight_technical
        weight_experience = job.scoring_criteria.weight_experience
        weight_cultural = job.scoring_criteria.weight_cultural

    prompt = f"""You are an expert interviewer and talent evaluator. Analyze this interview transcript and provide a detailed assessment.

## JOB CONTEXT
Title: {job.title}
Description: {job.raw_description[:2000] if job.raw_description else 'Not provided'}

## CANDIDATE CONTEXT
Name: {candidate.person_name}
Background: {candidate.bio_summary or 'Not provided'}
Skills: {', '.join(candidate.skills[:10]) if candidate.skills else 'Not provided'}

## INTERVIEW TRANSCRIPT
{transcript}

---

## YOUR ANALYSIS TASK

Evaluate the candidate against these specific criteria:

### COMPETENCIES TO EVALUATE
{json.dumps(competencies, indent=2)}

### MUST-HAVES (Critical Requirements)
{json.dumps(must_haves, indent=2) if must_haves else 'None specified'}

### RED FLAGS TO WATCH FOR
{json.dumps(red_flags, indent=2) if red_flags else 'None specified'}

### SCORING WEIGHTS
- Technical/Skills: {weight_technical * 100}%
- Experience: {weight_experience * 100}%
- Cultural Fit: {weight_cultural * 100}%

---

## OUTPUT FORMAT

Return a JSON object with this exact structure:

{{
    "competency_scores": [
        {{
            "name": "Competency Name",
            "score": 85,
            "evidence": ["Quote from transcript showing this", "Another relevant quote"],
            "notes": "Brief analysis of their performance in this area"
        }}
    ],
    "must_have_assessment": [
        {{
            "requirement": "Must-have requirement",
            "demonstrated": true,
            "evidence": "How they demonstrated it"
        }}
    ],
    "red_flags_detected": [
        {{
            "flag": "Red flag description",
            "evidence": "Quote or observation from transcript"
        }}
    ],
    "strengths": [
        "Key strength 1",
        "Key strength 2",
        "Key strength 3"
    ],
    "concerns": [
        "Concern or area for improvement 1",
        "Concern or area for improvement 2"
    ],
    "overall_score": 78,
    "recommendation": "hire",
    "recommendation_reasoning": "1-2 sentence explanation",
    "summary": "2-3 sentence overall summary of the candidate"
}}

SCORING GUIDELINES:
- 90-100: Exceptional, exceeded expectations
- 80-89: Strong, fully meets requirements
- 70-79: Good, meets most requirements
- 60-69: Adequate, some gaps
- 50-59: Below average, significant gaps
- Below 50: Does not meet requirements

RECOMMENDATION OPTIONS:
- "strong_hire": Score 85+, no red flags, all must-haves demonstrated
- "hire": Score 70+, no critical red flags
- "maybe": Score 50-69, minor concerns worth discussing
- "no_hire": Score below 50, or critical red flags, or missing must-haves

Return ONLY the JSON object, no other text."""

    return prompt


async def generate_analytics(interview_id: UUID) -> Analytics:
    """
    Generate analytics for a completed interview.

    This is the main entry point for analytics generation.
    """
    # Load all required data
    interview_repo = InterviewRepository()
    candidate_repo = CandidateRepository()
    job_repo = JobRepository()
    analytics_repo = AnalyticsRepository()

    interview = await interview_repo.get_by_id(interview_id)
    if not interview:
        raise ValueError(f"Interview {interview_id} not found")

    candidate = await candidate_repo.get_by_id(interview.candidate_id)
    if not candidate:
        raise ValueError(f"Candidate {interview.candidate_id} not found")

    job = await job_repo.get_by_id(candidate.job_id)
    if not job:
        raise ValueError(f"Job {candidate.job_id} not found")

    # Build prompt and call LLM
    prompt = build_analytics_prompt(
        transcript=interview.transcript or "",
        job=job,
        candidate=candidate,
    )

    response = await call_llm(
        prompt=prompt,
        model="google/gemini-2.5-flash-preview-05-20",  # More capable model for analysis
        temperature=0.3,
    )

    # Parse response
    try:
        data = json.loads(response)
    except json.JSONDecodeError:
        # Try to extract JSON from response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            data = json.loads(json_match.group())
        else:
            raise ValueError("Failed to parse analytics response")

    # Transform competency scores
    competency_scores = [
        CompetencyScore(
            name=cs["name"],
            score=cs["score"],
            evidence=cs.get("evidence", []),
            notes=cs.get("notes"),
        )
        for cs in data.get("competency_scores", [])
    ]

    # Extract red flags as simple list
    red_flags_detected = [
        rf["flag"] for rf in data.get("red_flags_detected", [])
    ]

    # Create analytics record
    analytics = await analytics_repo.create(AnalyticsCreate(
        interview_id=interview_id,
        overall_score=data.get("overall_score", 0),
        competency_scores=competency_scores,
        strengths=data.get("strengths", []),
        concerns=data.get("concerns", []),
        red_flags_detected=red_flags_detected,
        recommendation=data.get("recommendation", "maybe"),
        summary=data.get("summary", ""),
    ))

    # Store raw response for debugging
    await analytics_repo.update(analytics.id, {
        "raw_ai_response": data,
        "recommendation_reasoning": data.get("recommendation_reasoning"),
        "model_used": "google/gemini-2.5-flash-preview-05-20",
    })

    return analytics


async def generate_analytics_async(interview_id: UUID):
    """
    Async wrapper for analytics generation (for background tasks).
    """
    try:
        await generate_analytics(interview_id)
    except Exception as e:
        print(f"Failed to generate analytics for interview {interview_id}: {e}")
        # Could add error tracking/notification here
```

## Analytics Repository

```python
# backend/repositories/streamlined/analytics_repo.py

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from models.streamlined.analytics import Analytics, AnalyticsCreate, CompetencyScore
from services.supabase_client import get_supabase_client


class AnalyticsRepository:
    def __init__(self):
        self.client = get_supabase_client()
        self.table = "analytics"

    async def create(self, data: AnalyticsCreate) -> Analytics:
        """Create a new analytics record."""
        insert_data = {
            "interview_id": str(data.interview_id),
            "overall_score": data.overall_score,
            "competency_scores": [cs.model_dump() for cs in data.competency_scores],
            "strengths": data.strengths,
            "concerns": data.concerns,
            "red_flags_detected": data.red_flags_detected,
            "recommendation": data.recommendation,
            "summary": data.summary,
            "created_at": datetime.utcnow().isoformat(),
        }

        result = self.client.table(self.table).insert(insert_data).execute()
        return self._parse_analytics(result.data[0])

    async def get_by_id(self, analytics_id: UUID) -> Optional[Analytics]:
        """Get analytics by ID."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(analytics_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_analytics(result.data[0])

    async def get_by_interview(self, interview_id: UUID) -> Optional[Analytics]:
        """Get analytics for an interview."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("interview_id", str(interview_id))\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()

        if not result.data:
            return None

        return self._parse_analytics(result.data[0])

    async def list_by_job(self, job_id: UUID) -> List[Analytics]:
        """Get all analytics for candidates of a job."""
        # This requires a join through interviews and candidates
        result = self.client.table(self.table)\
            .select("""
                *,
                interviews!inner(
                    candidate_id,
                    candidates!inner(
                        job_id,
                        person_id,
                        persons(name)
                    )
                )
            """)\
            .eq("interviews.candidates.job_id", str(job_id))\
            .execute()

        analytics_list = []
        for data in result.data:
            analytics = self._parse_analytics(data)
            # Add candidate info
            interview_data = data.get("interviews", {})
            candidate_data = interview_data.get("candidates", {})
            analytics.candidate_name = candidate_data.get("persons", {}).get("name")
            analytics.candidate_id = candidate_data.get("person_id")
            analytics_list.append(analytics)

        return analytics_list

    async def update(self, analytics_id: UUID, data: Dict[str, Any]) -> Optional[Analytics]:
        """Update analytics record."""
        result = self.client.table(self.table)\
            .update(data)\
            .eq("id", str(analytics_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_analytics(result.data[0])

    def _parse_analytics(self, data: dict) -> Analytics:
        """Parse raw data into Analytics model."""
        # Parse competency scores
        competency_scores = [
            CompetencyScore(**cs) for cs in data.get("competency_scores", [])
        ]
        data["competency_scores"] = competency_scores
        return Analytics(**data)
```

## Analytics API Endpoints

```python
# backend/routers/analytics.py

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from uuid import UUID

from models.streamlined.analytics import Analytics
from repositories.streamlined.analytics_repo import AnalyticsRepository
from services.analytics_generator import generate_analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/interview/{interview_id}")
async def get_interview_analytics(
    interview_id: UUID,
    analytics_repo: AnalyticsRepository = Depends(get_analytics_repo),
):
    """Get analytics for a specific interview."""
    analytics = await analytics_repo.get_by_interview(interview_id)
    if not analytics:
        raise HTTPException(status_code=404, detail="Analytics not found")
    return analytics


@router.get("/candidate/{candidate_id}")
async def get_candidate_analytics(
    candidate_id: UUID,
    analytics_repo: AnalyticsRepository = Depends(get_analytics_repo),
):
    """Get all analytics for a candidate (across all their interviews)."""
    from repositories.streamlined.interview_repo import InterviewRepository

    interview_repo = InterviewRepository()
    interviews = await interview_repo.list_by_candidate(candidate_id)

    analytics_list = []
    for interview in interviews:
        analytics = await analytics_repo.get_by_interview(interview.id)
        if analytics:
            analytics_list.append(analytics)

    return analytics_list


@router.get("/job/{job_id}")
async def get_job_analytics(
    job_id: UUID,
    analytics_repo: AnalyticsRepository = Depends(get_analytics_repo),
):
    """Get all analytics for candidates in a job."""
    analytics_list = await analytics_repo.list_by_job(job_id)
    return analytics_list


@router.get("/job/{job_id}/summary")
async def get_job_analytics_summary(
    job_id: UUID,
    analytics_repo: AnalyticsRepository = Depends(get_analytics_repo),
):
    """Get aggregated analytics summary for a job."""
    analytics_list = await analytics_repo.list_by_job(job_id)

    if not analytics_list:
        return {
            "job_id": str(job_id),
            "total_candidates": 0,
            "avg_score": 0,
            "recommendation_breakdown": {},
            "top_candidates": [],
        }

    # Calculate aggregates
    scores = [a.overall_score for a in analytics_list]
    avg_score = sum(scores) / len(scores)

    # Count recommendations
    rec_breakdown = {}
    for a in analytics_list:
        rec = a.recommendation
        rec_breakdown[rec] = rec_breakdown.get(rec, 0) + 1

    # Get top candidates
    sorted_analytics = sorted(analytics_list, key=lambda a: a.overall_score, reverse=True)
    top_candidates = [
        {
            "candidate_name": a.candidate_name,
            "score": a.overall_score,
            "recommendation": a.recommendation,
        }
        for a in sorted_analytics[:5]
    ]

    return {
        "job_id": str(job_id),
        "total_candidates": len(analytics_list),
        "avg_score": round(avg_score, 1),
        "recommendation_breakdown": rec_breakdown,
        "top_candidates": top_candidates,
    }


@router.post("/regenerate/{interview_id}")
async def regenerate_analytics(
    interview_id: UUID,
):
    """Regenerate analytics for an interview (e.g., if criteria changed)."""
    analytics = await generate_analytics(interview_id)
    return analytics
```

## Frontend Analytics Page

```tsx
// frontend/src/app/candidates/[id]/analytics/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Star,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface CompetencyScore {
  name: string;
  score: number;
  evidence: string[];
  notes?: string;
}

interface Analytics {
  id: string;
  overall_score: number;
  competency_scores: CompetencyScore[];
  strengths: string[];
  concerns: string[];
  red_flags_detected: string[];
  recommendation: string;
  recommendation_reasoning?: string;
  summary: string;
}

export default function AnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [params.id]);

  const fetchAnalytics = async () => {
    try {
      // First get the interview ID for this candidate
      const interviewsRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/interviews/candidate/${params.id}`
      );
      const interviews = await interviewsRes.json();

      if (interviews.length > 0) {
        // Get analytics for the latest interview
        const analyticsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/analytics/interview/${interviews[0].id}`
        );
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case "strong_hire":
        return { color: "bg-green-500", icon: Star, text: "Strong Hire" };
      case "hire":
        return { color: "bg-blue-500", icon: CheckCircle, text: "Hire" };
      case "maybe":
        return { color: "bg-yellow-500", icon: AlertTriangle, text: "Maybe" };
      case "no_hire":
        return { color: "bg-red-500", icon: XCircle, text: "No Hire" };
      default:
        return { color: "bg-gray-500", icon: AlertTriangle, text: "Unknown" };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="container mx-auto p-6">
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No analytics available yet. Complete an interview first.
            </p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recStyle = getRecommendationStyle(analytics.recommendation);
  const RecIcon = recStyle.icon;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.back()}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      {/* Header with Score and Recommendation */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Overall Score</p>
              <p className={`text-6xl font-bold ${getScoreColor(analytics.overall_score)}`}>
                {analytics.overall_score}
              </p>
              <p className="text-muted-foreground">out of 100</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Recommendation</p>
              <div className="flex justify-center items-center gap-2 mb-2">
                <Badge className={`${recStyle.color} text-white text-lg px-4 py-2`}>
                  <RecIcon className="mr-2 h-5 w-5" />
                  {recStyle.text}
                </Badge>
              </div>
              {analytics.recommendation_reasoning && (
                <p className="text-sm text-muted-foreground mt-2">
                  {analytics.recommendation_reasoning}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{analytics.summary}</p>
        </CardContent>
      </Card>

      {/* Competency Scores */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Competency Scores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {analytics.competency_scores.map((cs, i) => (
            <div key={i}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{cs.name}</span>
                <span className={`font-bold ${getScoreColor(cs.score)}`}>
                  {cs.score}
                </span>
              </div>
              <Progress value={cs.score} className="h-2 mb-2" />
              {cs.notes && (
                <p className="text-sm text-muted-foreground">{cs.notes}</p>
              )}
              {cs.evidence.length > 0 && (
                <div className="mt-2 pl-4 border-l-2 border-muted">
                  {cs.evidence.map((e, j) => (
                    <p key={j} className="text-sm text-muted-foreground italic">
                      "{e}"
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Strengths and Concerns */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analytics.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-yellow-500" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analytics.concerns.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-1 shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Red Flags */}
      {analytics.red_flags_detected.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              Red Flags Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analytics.red_flags_detected.map((rf, i) => (
                <li key={i} className="flex items-start gap-2 text-red-700">
                  <XCircle className="h-4 w-4 mt-1 shrink-0" />
                  <span>{rf}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## Implementation Steps

1. **Create analytics service:**
   - `backend/services/analytics_generator.py`

2. **Create analytics repository:**
   - `backend/repositories/streamlined/analytics_repo.py`

3. **Create analytics router:**
   - `backend/routers/analytics.py`

4. **Register router:**
   ```python
   from routers.analytics import router as analytics_router
   app.include_router(analytics_router)
   ```

5. **Create frontend page:**
   - `frontend/src/app/candidates/[id]/analytics/page.tsx`

6. **Install progress component (if needed):**
   ```bash
   npx shadcn-ui@latest add progress
   ```

## Key Improvements

1. **Job-Specific Competencies** - Evaluates against the job's defined competencies
2. **Custom Scoring Weights** - Uses the recruiter-defined weight distribution
3. **Must-Have Tracking** - Explicitly checks for non-negotiable requirements
4. **Job Red Flags** - Watches for job-specific concerns
5. **Persistent Storage** - All analytics saved to database

## Next Phase

Once analytics are working, proceed to [Phase 7: Recruiter Dashboard](./phase7-recruiter-dashboard.md) to implement the multi-job dashboard view.
