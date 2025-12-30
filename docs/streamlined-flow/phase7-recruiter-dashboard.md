# Phase 7: Recruiter Dashboard

## Overview

This phase implements the recruiter dashboard - the main landing page that provides a high-level view across all jobs and candidates. This is where recruiters spend most of their time managing the hiring pipeline.

## Dashboard Features

1. **Overview Stats** - Total jobs, candidates, interviews, hires
2. **Active Jobs List** - Quick access to all active hiring roles
3. **Recent Activity** - Latest interviews and analytics
4. **Pipeline Funnel** - Visual representation of hiring stages
5. **Quick Actions** - Create job, upload candidates, start interview

## Dashboard Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RECRUITER DASHBOARD                                    [+ Create New Job]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   5 Jobs     │  │  47 Total    │  │  23 Interviews│  │  8 Offers    │    │
│  │   Active     │  │  Candidates  │  │  Completed    │  │  Extended    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────┐  ┌────────────────────────────────┐│
│  │  ACTIVE JOBS                       │  │  PIPELINE FUNNEL               ││
│  │  ──────────────                    │  │  ──────────────                ││
│  │                                    │  │                                ││
│  │  ┌─────────────────────────────┐   │  │    Applied    ████████████ 47 ││
│  │  │ Senior Backend Engineer     │   │  │    Screened   ████████     35 ││
│  │  │ 12 candidates | 8 interviewed│  │  │    Interviewed████         23 ││
│  │  │ [View] [Upload]             │   │  │    Offered    ██            8 ││
│  │  └─────────────────────────────┘   │  │    Hired      █             3 ││
│  │                                    │  │                                ││
│  │  ┌─────────────────────────────┐   │  └────────────────────────────────┘│
│  │  │ Product Manager             │   │                                    │
│  │  │ 8 candidates | 5 interviewed │  │  ┌────────────────────────────────┐│
│  │  │ [View] [Upload]             │   │  │  RECENT ACTIVITY               ││
│  │  └─────────────────────────────┘   │  │  ──────────────                ││
│  │                                    │  │                                ││
│  │  ┌─────────────────────────────┐   │  │  • John Doe interviewed        ││
│  │  │ Data Scientist              │   │  │    Score: 85 | Hire            ││
│  │  │ 7 candidates | 4 interviewed │  │  │    2 hours ago                 ││
│  │  │ [View] [Upload]             │   │  │                                ││
│  │  └─────────────────────────────┘   │  │  • Jane Smith interviewed      ││
│  │                                    │  │    Score: 72 | Maybe           ││
│  │  [View All Jobs]                   │  │    5 hours ago                 ││
│  └────────────────────────────────────┘  │                                ││
│                                          │  [View All Activity]           ││
│                                          └────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Dashboard API Endpoints

```python
# backend/routers/dashboard.py

from fastapi import APIRouter, Depends
from typing import List, Optional
from datetime import datetime, timedelta

from repositories.streamlined.job_repo import JobRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from repositories.streamlined.interview_repo import InterviewRepository
from repositories.streamlined.analytics_repo import AnalyticsRepository

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    job_repo: JobRepository = Depends(get_job_repo),
    candidate_repo: CandidateRepository = Depends(get_candidate_repo),
    interview_repo: InterviewRepository = Depends(get_interview_repo),
):
    """
    Get high-level dashboard statistics.
    """
    # Count active jobs
    all_jobs = await job_repo.list_all()
    active_jobs = [j for j in all_jobs if j.status == "active"]

    # Count all candidates across all jobs
    total_candidates = sum(j.candidate_count for j in all_jobs)
    interviewed_candidates = sum(j.interviewed_count for j in all_jobs)

    # Count recommendations (would need analytics aggregation)
    # For now, we'll estimate based on completed interviews

    return {
        "active_jobs": len(active_jobs),
        "total_jobs": len(all_jobs),
        "total_candidates": total_candidates,
        "interviewed_candidates": interviewed_candidates,
        "pending_candidates": total_candidates - interviewed_candidates,
        # These would come from analytics aggregation
        "strong_hires": 0,  # TODO: Aggregate from analytics
        "offers_extended": 0,  # TODO: Track in candidate status
    }


@router.get("/jobs/summary")
async def get_jobs_summary(
    limit: int = 5,
    job_repo: JobRepository = Depends(get_job_repo),
):
    """
    Get summary of active jobs for dashboard.
    """
    jobs = await job_repo.list_all(status="active")

    summaries = []
    for job in jobs[:limit]:
        summaries.append({
            "id": str(job.id),
            "title": job.title,
            "status": job.status,
            "candidate_count": job.candidate_count,
            "interviewed_count": job.interviewed_count,
            "pending_count": job.candidate_count - job.interviewed_count,
            "created_at": job.created_at.isoformat() if job.created_at else None,
        })

    return {
        "jobs": summaries,
        "total_active": len(jobs),
    }


@router.get("/pipeline")
async def get_pipeline_stats(
    job_repo: JobRepository = Depends(get_job_repo),
    candidate_repo: CandidateRepository = Depends(get_candidate_repo),
):
    """
    Get pipeline funnel statistics across all jobs.
    """
    # Aggregate candidate statuses
    all_jobs = await job_repo.list_all()

    pipeline = {
        "applied": 0,
        "screened": 0,
        "interviewed": 0,
        "offered": 0,
        "hired": 0,
        "rejected": 0,
    }

    for job in all_jobs:
        # Get candidates for each job
        candidates = await candidate_repo.list_by_job(job.id)
        for c in candidates:
            status = c.interview_status
            if status == "pending":
                pipeline["applied"] += 1
            elif status == "scheduled":
                pipeline["screened"] += 1
            elif status == "completed":
                pipeline["interviewed"] += 1
            elif status == "rejected":
                pipeline["rejected"] += 1
            # Note: "offered" and "hired" would need additional status values

    return pipeline


@router.get("/activity")
async def get_recent_activity(
    limit: int = 10,
    interview_repo: InterviewRepository = Depends(get_interview_repo),
    analytics_repo: AnalyticsRepository = Depends(get_analytics_repo),
):
    """
    Get recent interview activity with analytics.
    """
    # Get recent completed interviews
    # Note: This would need a method to get recent interviews across all candidates
    # For now, returning a placeholder structure

    activities = []

    # This would be implemented with a proper query
    # Example structure:
    # activities.append({
    #     "type": "interview_completed",
    #     "candidate_name": "John Doe",
    #     "job_title": "Senior Engineer",
    #     "score": 85,
    #     "recommendation": "hire",
    #     "timestamp": datetime.utcnow().isoformat(),
    # })

    return {
        "activities": activities,
        "total": len(activities),
    }


@router.get("/top-candidates")
async def get_top_candidates(
    limit: int = 5,
    analytics_repo: AnalyticsRepository = Depends(get_analytics_repo),
):
    """
    Get top-scoring candidates across all jobs.
    """
    # This would require a method to get top analytics across all jobs
    # Returning placeholder structure

    top_candidates = []

    # Example structure:
    # top_candidates.append({
    #     "candidate_name": "John Doe",
    #     "job_title": "Senior Engineer",
    #     "score": 92,
    #     "recommendation": "strong_hire",
    #     "interview_date": datetime.utcnow().isoformat(),
    # })

    return {
        "candidates": top_candidates,
    }
```

## Frontend Dashboard Page

```tsx
// frontend/src/app/dashboard/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Briefcase,
  Users,
  CheckCircle,
  Star,
  ArrowRight,
  Clock,
  TrendingUp,
} from "lucide-react";

interface DashboardStats {
  active_jobs: number;
  total_candidates: number;
  interviewed_candidates: number;
  pending_candidates: number;
}

interface JobSummary {
  id: string;
  title: string;
  candidate_count: number;
  interviewed_count: number;
  pending_count: number;
}

interface PipelineStats {
  applied: number;
  screened: number;
  interviewed: number;
  offered: number;
  hired: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, jobsRes, pipelineRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/stats`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/jobs/summary`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/pipeline`),
      ]);

      const [statsData, jobsData, pipelineData] = await Promise.all([
        statsRes.json(),
        jobsRes.json(),
        pipelineRes.json(),
      ]);

      setStats(statsData);
      setJobs(jobsData.jobs);
      setPipeline(pipelineData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const maxPipelineValue = pipeline
    ? Math.max(
        pipeline.applied,
        pipeline.screened,
        pipeline.interviewed,
        pipeline.offered,
        pipeline.hired
      )
    : 1;

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your hiring pipeline
          </p>
        </div>
        <Button onClick={() => router.push("/jobs/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Job
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Briefcase className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.active_jobs || 0}</p>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.total_candidates || 0}
                </p>
                <p className="text-sm text-muted-foreground">Total Candidates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.interviewed_candidates || 0}
                </p>
                <p className="text-sm text-muted-foreground">Interviewed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.pending_candidates || 0}
                </p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Jobs</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/jobs")}
            >
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-4">No active jobs yet.</p>
                <Button
                  variant="outline"
                  onClick={() => router.push("/jobs/new")}
                >
                  Create Your First Job
                </Button>
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  <div>
                    <p className="font-medium">{job.title}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                      <span>{job.candidate_count} candidates</span>
                      <span>{job.interviewed_count} interviewed</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/jobs/${job.id}/upload`);
                      }}
                    >
                      Upload
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/jobs/${job.id}`);
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pipeline Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pipeline Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pipeline && (
              <>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Applied</span>
                      <span className="font-medium">{pipeline.applied}</span>
                    </div>
                    <Progress
                      value={(pipeline.applied / maxPipelineValue) * 100}
                      className="h-3"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Screened</span>
                      <span className="font-medium">{pipeline.screened}</span>
                    </div>
                    <Progress
                      value={(pipeline.screened / maxPipelineValue) * 100}
                      className="h-3"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Interviewed</span>
                      <span className="font-medium">{pipeline.interviewed}</span>
                    </div>
                    <Progress
                      value={(pipeline.interviewed / maxPipelineValue) * 100}
                      className="h-3"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Offered</span>
                      <span className="font-medium">{pipeline.offered}</span>
                    </div>
                    <Progress
                      value={(pipeline.offered / maxPipelineValue) * 100}
                      className="h-3"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Hired</span>
                      <span className="font-medium">{pipeline.hired}</span>
                    </div>
                    <Progress
                      value={(pipeline.hired / maxPipelineValue) * 100}
                      className="h-3 bg-green-100"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Conversion Rate</span>
                    <span className="font-medium">
                      {pipeline.applied > 0
                        ? Math.round((pipeline.interviewed / pipeline.applied) * 100)
                        : 0}
                      % to interview
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/jobs/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Job
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/jobs")}
            >
              <Briefcase className="mr-2 h-4 w-4" />
              View All Jobs
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Would open a modal or navigate to first job's upload
                if (jobs.length > 0) {
                  router.push(`/jobs/${jobs[0].id}/upload`);
                }
              }}
              disabled={jobs.length === 0}
            >
              <Users className="mr-2 h-4 w-4" />
              Upload Candidates
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Navigation Layout

```tsx
// frontend/src/components/layout/main-nav.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart3,
  Settings,
} from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Jobs",
    href: "/jobs",
    icon: Briefcase,
  },
  {
    title: "Candidates",
    href: "/candidates",
    icon: Users,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center space-x-6">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
```

---

## Implementation Steps

1. **Create dashboard router:**
   - `backend/routers/dashboard.py`

2. **Register router:**
   ```python
   from routers.dashboard import router as dashboard_router
   app.include_router(dashboard_router)
   ```

3. **Create frontend pages:**
   - `frontend/src/app/dashboard/page.tsx`
   - `frontend/src/components/layout/main-nav.tsx`

4. **Update root redirect:**
   - Redirect `/` to `/dashboard`

5. **Add layout with navigation:**
   - Update `frontend/src/app/layout.tsx` to include navigation

## Dashboard Metrics

| Metric | Source | Description |
|--------|--------|-------------|
| Active Jobs | `jobs` table, `status = 'active'` | Currently hiring |
| Total Candidates | Sum of `candidate_count` across jobs | All applicants |
| Interviewed | Sum of `interviewed_count` across jobs | Completed interviews |
| Pending | Total - Interviewed | Awaiting action |
| Pipeline | `candidates` table, grouped by `interview_status` | Funnel visualization |

## Future Enhancements

1. **Time-based filtering** - View stats for this week, month, quarter
2. **Job comparison** - Compare hiring metrics across jobs
3. **Recruiter leaderboard** - If multiple recruiters (future)
4. **Email notifications** - Alert for pending candidates
5. **Calendar integration** - Schedule real interviews
6. **Export reports** - Download hiring reports as PDF/CSV

## Completion

This completes the 7-phase implementation plan for the streamlined interview flow. The system now provides:

1. **Job-centric organization** - All data flows through the Job entity
2. **Unified context** - Same job description used everywhere
3. **Multi-job support** - Manage parallel hiring roles
4. **Full traceability** - Analytics → Interview → Candidate → Job → Person
5. **Recruiter dashboard** - Bird's eye view of all hiring activity
