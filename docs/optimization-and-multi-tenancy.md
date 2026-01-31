# Optimization and Multi-tenancy

This document outlines the performance optimizations and multi-tenancy implementation in the Briefing Room platform.

## Performance: N+1 Query Optimization

As the platform moved from single interview rooms to complex dashboards (Recruiter/Manager Dashboard), the number of database queries required to display a single page increased significantly.

### The Problem
Initial implementations often used the N+1 pattern:
1. Fetch all Jobs for an organization (1 query).
2. For each Job, fetch candidate counts and interview status (N queries).

This resulted in slow page loads and high database overhead.

### The Solution: Batch Fetching
Repositories have been updated with `_batch_sync` and `list_by_ids_sync` methods.

**Example: `JobRepository.list_all_for_org_sync`**
This method now optionally includes candidate and interview counts in a single join or grouped query, reducing dozens of calls to just one or two.

**Example: `CandidateRepository.count_by_jobs_batch_sync`**
Instead of counting candidates per job in a loop, the repository now takes a list of `job_ids` and returns a dictionary of counts using the `in_` operator.

```python
# Before (Dashboard loop)
for job in jobs:
    job.candidate_count = candidate_repo.count_by_job(job.id)

# After (Batch operation)
job_ids = [j.id for j in jobs]
counts = candidate_repo.count_by_jobs_batch_sync(job_ids)
for job in jobs:
    job.candidate_count = counts.get(job.id, 0)
```

## Security: Multi-tenancy

The platform is designed to be multi-tenant, ensuring that recruiters and managers only see data belonging to their organization.

### 1. Data Isolation
Every core table in the database includes an `organization_id` column (linking to the `organizations` table).

### 2. Request Scoping
FastAPI middleware (`get_current_user`) extracts the user's `organization_id` from the authenticated JWT. 

### 3. Repository Enforcement
Repository methods that list or fetch data now require an `organization_id` parameter to scope the Supabase queries.

```python
# Scoped query in repository
def list_all_for_org_sync(self, org_id: str, include_counts: bool = True):
    query = self.client.table(self.table).select("*").eq("organization_id", org_id)
    # ...
```

### 4. API Layer
Endpoints in `backend/routers/dashboard.py` and others use the `Depends(get_current_user)` pattern to ensure every request is contextualized by the correct organization.
