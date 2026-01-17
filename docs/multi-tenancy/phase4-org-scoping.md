# Phase 4: Organization Scoping

## Status: PENDING

## Overview

This phase updates all database queries and API endpoints to automatically scope data by organization. This ensures recruiters only see data belonging to their organization.

## Scoping Strategy

Every query that returns jobs, candidates, interviews, or analytics must be filtered by the authenticated user's `organization_id`.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           QUERY SCOPING FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. Request arrives with JWT token                                               │
│  2. Middleware extracts organization_id from token                               │
│  3. Endpoint receives CurrentUser with organization_id                           │
│  4. Repository query adds: WHERE organization_id = ?                             │
│  5. Only organization's data returned                                            │
│                                                                                  │
│  Request → Auth Middleware → Endpoint → Repository → Database                    │
│     ↑                                      ↓                                     │
│     └──────── Response (org-scoped) ←──────┘                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Endpoints to Update

### Jobs Router (`backend/routers/jobs.py`)

| Endpoint | Change |
|----------|--------|
| `GET /api/jobs` | Filter by `organization_id` |
| `POST /api/jobs` | Set `organization_id` from user |
| `GET /api/jobs/{id}` | Verify job belongs to user's org |
| `PATCH /api/jobs/{id}` | Verify job belongs to user's org |
| `DELETE /api/jobs/{id}` | Verify job belongs to user's org |

### Candidates Router

| Endpoint | Change |
|----------|--------|
| `GET /api/jobs/{id}/candidates` | Job must belong to user's org |
| `POST /api/jobs/{id}/candidates` | Job must belong to user's org |

### Interviews Router

| Endpoint | Change |
|----------|--------|
| `GET /api/interviews` | Filter by org (via job → candidate → interview) |
| `POST /api/interviews/.../start` | Set `conducted_by_recruiter_id` |

### Dashboard Router

| Endpoint | Change |
|----------|--------|
| `GET /api/dashboard/stats` | All aggregations scoped to org |
| `GET /api/dashboard/top-candidates` | Candidates from org's jobs only |

## Implementation

### 1. Update Job Repository (`backend/repositories/streamlined/job_repo.py`)

```python
from models.auth import CurrentUser

class JobRepository:
    # ... existing code ...

    def list_all_for_org(
        self,
        organization_id: UUID,
        status: Optional[str] = None,
        recruiter_id: Optional[UUID] = None
    ) -> List[Job]:
        """List all jobs for an organization."""
        query = self.client.table(self.table)\
            .select("*")\
            .eq("organization_id", str(organization_id))

        if status:
            query = query.eq("status", status)

        if recruiter_id:
            query = query.eq("recruiter_id", str(recruiter_id))

        query = query.order("created_at", desc=True)
        result = query.execute()

        return [self._parse_job(row) for row in result.data]

    def get_by_id_for_org(
        self,
        job_id: UUID,
        organization_id: UUID
    ) -> Optional[Job]:
        """Get a job by ID, verifying it belongs to the organization."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(job_id))\
            .eq("organization_id", str(organization_id))\
            .execute()

        if not result.data:
            return None

        return self._parse_job(result.data[0])

    def create_for_org(
        self,
        job_data: JobCreate,
        organization_id: UUID,
        created_by_recruiter_id: UUID
    ) -> Job:
        """Create a job within an organization."""
        data = job_data.model_dump()
        data["organization_id"] = str(organization_id)
        data["created_by_recruiter_id"] = str(created_by_recruiter_id)
        data["created_at"] = datetime.utcnow().isoformat()
        data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create job")

        return self._parse_job(result.data[0])
```

### 2. Update Jobs Router (`backend/routers/jobs.py`)

```python
from fastapi import Depends
from middleware.auth_middleware import get_current_user
from models.auth import CurrentUser

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/", response_model=List[JobSummary])
async def list_jobs(
    status: Optional[str] = None,
    recruiter_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    """List all jobs for the authenticated user's organization."""
    repo = JobRepository()

    jobs = repo.list_all_for_org(
        organization_id=current_user.organization_id,
        status=status,
        recruiter_id=UUID(recruiter_id) if recruiter_id else None
    )

    return jobs


@router.post("/", response_model=Job, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_data: JobCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Create a new job in the authenticated user's organization."""
    repo = JobRepository()

    job = repo.create_for_org(
        job_data=job_data,
        organization_id=current_user.organization_id,
        created_by_recruiter_id=current_user.recruiter_id
    )

    return job


@router.get("/{job_id}", response_model=Job)
async def get_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get a job by ID (must belong to user's organization)."""
    repo = JobRepository()

    job = repo.get_by_id_for_org(
        job_id=UUID(job_id),
        organization_id=current_user.organization_id
    )

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    return job


@router.patch("/{job_id}", response_model=Job)
async def update_job(
    job_id: str,
    job_update: JobUpdate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update a job (must belong to user's organization)."""
    repo = JobRepository()

    # First verify access
    existing = repo.get_by_id_for_org(
        job_id=UUID(job_id),
        organization_id=current_user.organization_id
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    # Then update
    updated = repo.update_sync(UUID(job_id), job_update)
    return updated


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete a job (must belong to user's organization)."""
    repo = JobRepository()

    # Verify access
    existing = repo.get_by_id_for_org(
        job_id=UUID(job_id),
        organization_id=current_user.organization_id
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    repo.delete_sync(UUID(job_id))
    return {"message": "Job deleted"}
```

### 3. Update Dashboard Router (`backend/routers/dashboard.py`)

```python
@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get dashboard statistics for the authenticated user's organization."""
    db = get_db()
    org_id = str(current_user.organization_id)

    # Jobs count - filtered by org
    jobs_result = db.table("job_postings")\
        .select("id, status")\
        .eq("organization_id", org_id)\
        .execute()

    jobs = jobs_result.data or []
    total_jobs = len(jobs)
    active_jobs = len([j for j in jobs if j["status"] == "active"])

    # Candidates count - join through org's jobs
    job_ids = [j["id"] for j in jobs]

    total_candidates = 0
    if job_ids:
        for job_id in job_ids:
            candidates_result = db.table("candidates")\
                .select("id", count="exact")\
                .eq("job_posting_id", job_id)\
                .execute()
            total_candidates += candidates_result.count or 0

    # Interviews count - through org's candidates
    # ... similar pattern

    return DashboardStats(
        total_jobs=total_jobs,
        active_jobs=active_jobs,
        total_candidates=total_candidates,
        # ...
    )
```

### 4. Create Access Verification Helper

```python
# backend/services/access_control.py

from uuid import UUID
from fastapi import HTTPException, status
from db.client import get_db


def verify_job_access(job_id: UUID, organization_id: UUID) -> dict:
    """
    Verify that a job belongs to the given organization.
    Returns the job data if access is granted.
    Raises 404 if not found or doesn't belong to org.
    """
    db = get_db()

    result = db.table("job_postings")\
        .select("*")\
        .eq("id", str(job_id))\
        .eq("organization_id", str(organization_id))\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    return result.data[0]


def verify_candidate_access(candidate_id: UUID, organization_id: UUID) -> dict:
    """
    Verify that a candidate belongs to a job in the given organization.
    """
    db = get_db()

    # Get candidate with job info
    result = db.table("candidates")\
        .select("*, job_postings!inner(organization_id)")\
        .eq("id", str(candidate_id))\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    candidate = result.data[0]
    job = candidate.get("job_postings", {})

    if job.get("organization_id") != str(organization_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    return candidate


def verify_interview_access(interview_id: UUID, organization_id: UUID) -> dict:
    """
    Verify that an interview belongs to a candidate in the given organization.
    """
    db = get_db()

    result = db.table("interviews")\
        .select("*, candidates!inner(job_posting_id, job_postings!inner(organization_id))")\
        .eq("id", str(interview_id))\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )

    interview = result.data[0]
    candidate = interview.get("candidates", {})
    job = candidate.get("job_postings", {})

    if job.get("organization_id") != str(organization_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )

    return interview
```

### 5. Frontend API Updates

Update all API calls to include the auth header:

```typescript
// frontend/src/lib/jobsApi.ts

import { getAuthHeader } from './authApi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function getJobs(): Promise<Job[]> {
  const response = await fetch(`${API_URL}/api/jobs`, {
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired - redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    throw new Error('Failed to fetch jobs');
  }

  return response.json();
}

export async function createJob(data: JobCreate): Promise<Job> {
  const response = await fetch(`${API_URL}/api/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create job');
  }

  return response.json();
}
```

## Endpoints Requiring Updates

### High Priority (Core Functionality)

- [ ] `GET /api/jobs` - List jobs
- [ ] `POST /api/jobs` - Create job
- [ ] `GET /api/jobs/{id}` - Get job
- [ ] `PATCH /api/jobs/{id}` - Update job
- [ ] `DELETE /api/jobs/{id}` - Delete job
- [ ] `GET /api/jobs/{id}/candidates` - List candidates
- [ ] `POST /api/jobs/{id}/candidates` - Upload candidates
- [ ] `GET /api/dashboard/stats` - Dashboard stats
- [ ] `GET /api/dashboard/top-candidates` - Top candidates

### Medium Priority (Interview Flow)

- [ ] `POST /api/interviews/.../start` - Start interview
- [ ] `GET /api/interviews/{id}` - Get interview
- [ ] `POST /api/interviews/{id}/complete` - Complete interview
- [ ] `GET /api/candidates/{id}` - Get candidate
- [ ] `GET /api/candidates/{id}/interviews` - Candidate interviews

### Lower Priority (Analytics & Reports)

- [ ] `GET /api/analytics/{id}` - Get analytics
- [ ] `GET /api/recruiters` - List recruiters (org-scoped)
- [ ] `GET /api/managers/...` - Manager analytics

## Testing Checklist

- [ ] User A in Org 1 cannot see Org 2's jobs
- [ ] User A in Org 1 cannot see Org 2's candidates
- [ ] Creating a job sets correct organization_id
- [ ] Dashboard stats only count org's data
- [ ] 404 returned when accessing other org's resources
- [ ] API returns 401 when token missing/invalid

## Security Considerations

1. **Never trust client-provided organization_id** - Always extract from JWT
2. **Use joins for nested resources** - Verify candidate belongs to org's job
3. **Return 404, not 403** - Don't leak existence of other org's data
4. **Audit logs** - Consider logging access attempts (future)

## Next Phase

Once org scoping is complete, proceed to [Phase 5: Recruiter Tracking](./phase5-recruiter-tracking.md) to track which recruiter created jobs and conducted interviews.
