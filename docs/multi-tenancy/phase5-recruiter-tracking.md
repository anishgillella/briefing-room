# Phase 5: Recruiter Tracking

## Status: PENDING

## Overview

This phase implements tracking of which recruiter created jobs and conducted interviews. This enables recruiter-level analytics and accountability.

## Tracking Points

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         RECRUITER TRACKING POINTS                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  JOB CREATION                                                                    │
│  ─────────────                                                                   │
│  • When: Recruiter creates a new job                                             │
│  • Track: created_by_recruiter_id                                                │
│  • Purpose: Know who is responsible for each job                                 │
│                                                                                  │
│  INTERVIEW CONDUCTED                                                             │
│  ──────────────────                                                              │
│  • When: Recruiter starts an interview                                           │
│  • Track: conducted_by_recruiter_id                                              │
│  • Purpose: Recruiter performance analytics                                      │
│                                                                                  │
│  CANDIDATE DECISION                                                              │
│  ─────────────────                                                               │
│  • When: Recruiter makes hire/no-hire decision                                   │
│  • Track: decided_by_recruiter_id (optional)                                     │
│  • Purpose: Decision accountability                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Update Interview Start Endpoint

When starting an interview, record who is conducting it:

```python
# backend/routers/db_interviews.py

@router.post("/candidate/{candidate_id}/start", response_model=StartInterviewResponse)
async def start_interview(
    candidate_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Start an interview, recording the conducting recruiter."""

    # Verify candidate access
    verify_candidate_access(UUID(candidate_id), current_user.organization_id)

    # Create interview with conducted_by
    interview_data = {
        "candidate_id": candidate_id,
        "conducted_by_recruiter_id": str(current_user.recruiter_id),
        "status": "in_progress",
        "started_at": datetime.utcnow().isoformat(),
        # ... other fields
    }

    result = db.table("interviews").insert(interview_data).execute()

    # ... rest of interview start logic
```

### 2. Recruiter Analytics Queries

Create queries to aggregate recruiter performance:

```python
# backend/repositories/streamlined/recruiter_repo.py

def get_recruiter_stats(self, recruiter_id: UUID) -> RecruiterStats:
    """Get comprehensive stats for a recruiter."""
    db = self.client

    # Jobs created by this recruiter
    jobs_result = db.table("job_postings")\
        .select("id")\
        .eq("created_by_recruiter_id", str(recruiter_id))\
        .execute()
    jobs_created = len(jobs_result.data or [])

    # Interviews conducted by this recruiter
    interviews_result = db.table("interviews")\
        .select("id, status")\
        .eq("conducted_by_recruiter_id", str(recruiter_id))\
        .execute()

    interviews = interviews_result.data or []
    total_interviews = len(interviews)
    completed_interviews = len([i for i in interviews if i["status"] == "completed"])

    # Get interview IDs for analytics lookup
    interview_ids = [i["id"] for i in interviews if i["status"] == "completed"]

    # Analytics for completed interviews
    strong_hires = 0
    hires = 0
    no_hires = 0
    total_score = 0

    if interview_ids:
        for iid in interview_ids:
            analytics_result = db.table("analytics")\
                .select("overall_score, recommendation")\
                .eq("interview_id", iid)\
                .execute()

            for a in analytics_result.data or []:
                rec = a.get("recommendation", "").lower()
                if "strong" in rec:
                    strong_hires += 1
                elif rec in ["hire", "yes"]:
                    hires += 1
                elif rec in ["no_hire", "no"]:
                    no_hires += 1

                if a.get("overall_score"):
                    total_score += a["overall_score"]

    avg_score = total_score / len(interview_ids) if interview_ids else 0

    return RecruiterStats(
        recruiter_id=recruiter_id,
        jobs_created=jobs_created,
        total_interviews=total_interviews,
        completed_interviews=completed_interviews,
        strong_hires=strong_hires,
        hires=hires,
        no_hires=no_hires,
        avg_interview_score=round(avg_score, 1),
        hire_rate=round((strong_hires + hires) / completed_interviews * 100, 1) if completed_interviews > 0 else 0
    )
```

### 3. Recruiter Stats Model

```python
# backend/models/streamlined/recruiter.py

class RecruiterStats(BaseModel):
    """Statistics for a recruiter's activity."""
    recruiter_id: UUID
    jobs_created: int = 0
    total_interviews: int = 0
    completed_interviews: int = 0
    strong_hires: int = 0
    hires: int = 0
    no_hires: int = 0
    avg_interview_score: float = 0.0
    hire_rate: float = 0.0
```

### 4. Recruiter Stats Endpoint

```python
# backend/routers/recruiters.py

@router.get("/me/stats", response_model=RecruiterStats)
async def get_my_stats(
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get the current recruiter's statistics."""
    repo = RecruiterRepository()
    return repo.get_recruiter_stats(current_user.recruiter_id)


@router.get("/{recruiter_id}/stats", response_model=RecruiterStats)
async def get_recruiter_stats(
    recruiter_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get statistics for a recruiter (must be in same org)."""
    repo = RecruiterRepository()

    # Verify recruiter is in same org
    recruiter = repo.get_by_id_sync(UUID(recruiter_id))
    if not recruiter or str(recruiter.organization_id) != str(current_user.organization_id):
        raise HTTPException(status_code=404, detail="Recruiter not found")

    return repo.get_recruiter_stats(UUID(recruiter_id))
```

### 5. Frontend Recruiter Dashboard

```typescript
// frontend/src/app/dashboard/recruiter/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeader } from '@/lib/authApi';

interface RecruiterStats {
  recruiter_id: string;
  jobs_created: number;
  total_interviews: number;
  completed_interviews: number;
  strong_hires: number;
  hires: number;
  no_hires: number;
  avg_interview_score: number;
  hire_rate: number;
}

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<RecruiterStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/recruiters/me/stats`,
          { headers: getAuthHeader() }
        );
        if (response.ok) {
          setStats(await response.json());
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">
        My Performance Dashboard
      </h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Jobs Created"
          value={stats?.jobs_created || 0}
        />
        <StatCard
          label="Interviews Conducted"
          value={stats?.completed_interviews || 0}
        />
        <StatCard
          label="Avg Interview Score"
          value={stats?.avg_interview_score || 0}
          suffix="/100"
        />
        <StatCard
          label="Hire Rate"
          value={stats?.hire_rate || 0}
          suffix="%"
        />
      </div>

      <div className="bg-zinc-900 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">
          Interview Outcomes
        </h2>
        <div className="flex gap-8">
          <div>
            <span className="text-green-400 text-2xl font-bold">
              {stats?.strong_hires || 0}
            </span>
            <p className="text-zinc-400 text-sm">Strong Hires</p>
          </div>
          <div>
            <span className="text-blue-400 text-2xl font-bold">
              {stats?.hires || 0}
            </span>
            <p className="text-zinc-400 text-sm">Hires</p>
          </div>
          <div>
            <span className="text-red-400 text-2xl font-bold">
              {stats?.no_hires || 0}
            </span>
            <p className="text-zinc-400 text-sm">No Hires</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix = '' }: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-zinc-400 text-sm">{label}</p>
      <p className="text-2xl font-bold text-white">
        {value}{suffix}
      </p>
    </div>
  );
}
```

### 6. Update Job List to Show Creator

```typescript
// In job list component, show who created each job

<div className="text-sm text-zinc-500">
  Created by {job.created_by_recruiter_name || 'Unknown'}
</div>
```

Update the job response model to include creator info:

```python
# backend/routers/jobs.py

@router.get("/", response_model=List[JobWithCreator])
async def list_jobs(current_user: CurrentUser = Depends(get_current_user)):
    """List jobs with creator information."""
    db = get_db()

    result = db.table("job_postings")\
        .select("*, recruiters!created_by_recruiter_id(name)")\
        .eq("organization_id", str(current_user.organization_id))\
        .order("created_at", desc=True)\
        .execute()

    jobs = []
    for row in result.data:
        creator = row.pop("recruiters", {}) or {}
        jobs.append({
            **row,
            "created_by_recruiter_name": creator.get("name", "Unknown")
        })

    return jobs
```

## Tracking Summary

| Action | Field | Table | Purpose |
|--------|-------|-------|---------|
| Create Job | `created_by_recruiter_id` | `job_postings` | Job ownership |
| Start Interview | `conducted_by_recruiter_id` | `interviews` | Interview accountability |
| Make Decision | `decided_by_recruiter_id` | `candidates` | Decision tracking (optional) |

## Analytics Capabilities

With recruiter tracking in place, you can now answer:

1. **How many jobs has each recruiter created?**
2. **How many interviews has each recruiter conducted?**
3. **What is each recruiter's average interview score?**
4. **What is each recruiter's hire rate?**
5. **Which recruiter created a specific job?**
6. **Who conducted a specific interview?**

## Testing Checklist

- [ ] Creating a job sets `created_by_recruiter_id`
- [ ] Starting an interview sets `conducted_by_recruiter_id`
- [ ] Recruiter stats endpoint returns correct data
- [ ] Job list shows creator name
- [ ] Recruiter dashboard displays personal stats

## Future Enhancements

1. **Team Comparison** - Compare recruiters within the organization
2. **Time-based Analytics** - Stats by week/month/quarter
3. **Interview Quality Scoring** - Rate recruiters based on interview quality
4. **Recruiter Leaderboard** - Gamification for hiring teams

## Completion

With this phase complete, the multi-tenancy implementation is finished:

- ✅ Phase 1: Schema Changes
- ✅ Phase 2: Backend Auth
- ✅ Phase 3: Frontend Auth
- ✅ Phase 4: Organization Scoping
- ✅ Phase 5: Recruiter Tracking

The system now supports:
- Multiple organizations (tenants)
- Authenticated recruiters
- Organization-scoped data access
- Recruiter-level activity tracking
- Personal performance analytics
