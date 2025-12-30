# Phase 2: Job Management

## Overview

This phase implements the Job CRUD (Create, Read, Update, Delete) functionality. Jobs are the central organizing entity - candidates, interviews, and analytics all reference a Job.

## User Stories

1. As a recruiter, I want to create a new job by pasting a job description
2. As a recruiter, I want to see all my active jobs in a dashboard
3. As a recruiter, I want to edit a job's details or status
4. As a recruiter, I want to close a job when the position is filled

## API Endpoints

### Jobs Router

```python
# backend/routers/jobs.py

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from uuid import UUID

from models.streamlined.job import (
    Job, JobCreate, JobUpdate, JobStatus,
    ExtractedRequirements
)
from repositories.streamlined.job_repo import JobRepository
from services.jd_extractor import extract_requirements_from_jd

router = APIRouter(prefix="/jobs", tags=["jobs"])

# Dependency injection for repository
def get_job_repo() -> JobRepository:
    return JobRepository()


@router.post("/", response_model=Job)
async def create_job(
    job_data: JobCreate,
    repo: JobRepository = Depends(get_job_repo)
) -> Job:
    """
    Create a new job.

    1. Saves the raw job description
    2. Triggers AI extraction of requirements (async)
    3. Returns the job with status 'draft'
    """
    # Create the job record
    job = await repo.create(job_data)

    # Trigger async extraction (non-blocking)
    # This will update the job with extracted_requirements
    await trigger_jd_extraction(job.id, job.raw_description)

    return job


@router.get("/", response_model=List[Job])
async def list_jobs(
    status: Optional[JobStatus] = None,
    repo: JobRepository = Depends(get_job_repo)
) -> List[Job]:
    """
    List all jobs, optionally filtered by status.

    Returns jobs with candidate counts for dashboard display.
    """
    jobs = await repo.list_all(status=status)
    return jobs


@router.get("/{job_id}", response_model=Job)
async def get_job(
    job_id: UUID,
    repo: JobRepository = Depends(get_job_repo)
) -> Job:
    """Get a single job by ID with all details."""
    job = await repo.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/{job_id}", response_model=Job)
async def update_job(
    job_id: UUID,
    job_update: JobUpdate,
    repo: JobRepository = Depends(get_job_repo)
) -> Job:
    """
    Update a job's details.

    Can update:
    - title, raw_description, status
    - extracted_requirements (after voice agent enrichment)
    - company_context (after voice agent enrichment)
    - scoring_criteria, red_flags
    """
    job = await repo.update(job_id, job_update)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/{job_id}")
async def delete_job(
    job_id: UUID,
    repo: JobRepository = Depends(get_job_repo)
):
    """
    Delete a job.

    Warning: This will also delete all associated candidates,
    interviews, and analytics (cascade delete).
    """
    success = await repo.delete(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted successfully"}


@router.post("/{job_id}/activate", response_model=Job)
async def activate_job(
    job_id: UUID,
    repo: JobRepository = Depends(get_job_repo)
) -> Job:
    """
    Activate a job (move from draft to active).

    Prerequisites:
    - Job must have extracted_requirements (from JD)
    - Job should have scoring_criteria (from voice agent)
    """
    job = await repo.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Validate job is ready
    if not job.extracted_requirements:
        raise HTTPException(
            status_code=400,
            detail="Job must have extracted requirements before activation"
        )

    # Update status
    updated = await repo.update(job_id, JobUpdate(status=JobStatus.ACTIVE))
    return updated


@router.post("/{job_id}/close", response_model=Job)
async def close_job(
    job_id: UUID,
    repo: JobRepository = Depends(get_job_repo)
) -> Job:
    """Close a job (position filled or cancelled)."""
    return await repo.update(job_id, JobUpdate(status=JobStatus.CLOSED))


@router.get("/{job_id}/candidates")
async def get_job_candidates(
    job_id: UUID,
    status: Optional[str] = None,
    repo: JobRepository = Depends(get_job_repo)
):
    """Get all candidates for a specific job."""
    # This will be implemented in Phase 4
    pass


@router.get("/{job_id}/analytics/summary")
async def get_job_analytics_summary(
    job_id: UUID,
    repo: JobRepository = Depends(get_job_repo)
):
    """Get aggregated analytics for all candidates in a job."""
    # This will be implemented in Phase 6
    pass
```

---

## JD Extraction Service

When a job is created, we automatically extract structured requirements from the raw description.

```python
# backend/services/jd_extractor.py

from typing import Optional
import json
from models.streamlined.job import ExtractedRequirements
from services.llm_client import call_llm

EXTRACTION_PROMPT = """
You are an expert HR analyst. Extract structured information from the following job description.

Job Description:
{job_description}

Extract the following information in JSON format:
{{
    "years_experience": "e.g., '3-5 years' or '5+ years' or null if not specified",
    "education": "e.g., 'Bachelor's in Computer Science' or null",
    "required_skills": ["list", "of", "required", "skills"],
    "preferred_skills": ["list", "of", "nice-to-have", "skills"],
    "certifications": ["any", "required", "certifications"],
    "location": "e.g., 'San Francisco, CA' or 'Remote' or null",
    "work_type": "one of: 'remote', 'hybrid', 'onsite', or null",
    "salary_range": "e.g., '$120k-$150k' or null"
}}

Be precise and only include information explicitly stated or strongly implied in the JD.
Return ONLY valid JSON, no other text.
"""


async def extract_requirements_from_jd(
    raw_description: str
) -> ExtractedRequirements:
    """
    Use LLM to extract structured requirements from job description.
    """
    prompt = EXTRACTION_PROMPT.format(job_description=raw_description)

    response = await call_llm(
        prompt=prompt,
        model="google/gemini-2.0-flash-001",  # Fast and cheap for extraction
        temperature=0.1  # Low temp for consistent extraction
    )

    try:
        data = json.loads(response)
        return ExtractedRequirements(**data)
    except (json.JSONDecodeError, ValueError) as e:
        # Return empty requirements if extraction fails
        return ExtractedRequirements()


async def trigger_jd_extraction(job_id: str, raw_description: str):
    """
    Trigger async JD extraction and update job.

    This runs in the background after job creation.
    """
    from repositories.streamlined.job_repo import JobRepository
    from models.streamlined.job import JobUpdate

    repo = JobRepository()

    # Extract requirements
    requirements = await extract_requirements_from_jd(raw_description)

    # Update job with extracted data
    await repo.update(job_id, JobUpdate(
        extracted_requirements=requirements
    ))
```

---

## Job Repository

```python
# backend/repositories/streamlined/job_repo.py

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from models.streamlined.job import Job, JobCreate, JobUpdate, JobStatus
from services.supabase_client import get_supabase_client


class JobRepository:
    def __init__(self):
        self.client = get_supabase_client()
        self.table = "jobs"

    async def create(self, job_data: JobCreate) -> Job:
        """Create a new job."""
        data = {
            "title": job_data.title,
            "raw_description": job_data.raw_description,
            "status": job_data.status.value,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = self.client.table(self.table).insert(data).execute()
        return Job(**result.data[0])

    async def get_by_id(self, job_id: UUID) -> Optional[Job]:
        """Get a job by ID."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(job_id))\
            .execute()

        if not result.data:
            return None

        return Job(**result.data[0])

    async def list_all(
        self,
        status: Optional[JobStatus] = None
    ) -> List[Job]:
        """List all jobs, optionally filtered by status."""
        query = self.client.table(self.table).select("*")

        if status:
            query = query.eq("status", status.value)

        result = query.order("created_at", desc=True).execute()

        # Enrich with candidate counts
        jobs = []
        for job_data in result.data:
            job = Job(**job_data)
            job.candidate_count = await self._get_candidate_count(job.id)
            job.interviewed_count = await self._get_interviewed_count(job.id)
            jobs.append(job)

        return jobs

    async def update(self, job_id: UUID, job_update: JobUpdate) -> Optional[Job]:
        """Update a job."""
        update_data = job_update.model_dump(exclude_unset=True)

        if not update_data:
            return await self.get_by_id(job_id)

        # Convert nested models to dict/JSON
        if "extracted_requirements" in update_data and update_data["extracted_requirements"]:
            update_data["extracted_requirements"] = update_data["extracted_requirements"].model_dump()
        if "company_context" in update_data and update_data["company_context"]:
            update_data["company_context"] = update_data["company_context"].model_dump()
        if "scoring_criteria" in update_data and update_data["scoring_criteria"]:
            update_data["scoring_criteria"] = update_data["scoring_criteria"].model_dump()
        if "status" in update_data:
            update_data["status"] = update_data["status"].value

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(job_id))\
            .execute()

        if not result.data:
            return None

        return Job(**result.data[0])

    async def delete(self, job_id: UUID) -> bool:
        """Delete a job (cascades to candidates, interviews, analytics)."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(job_id))\
            .execute()

        return len(result.data) > 0

    async def _get_candidate_count(self, job_id: UUID) -> int:
        """Get count of candidates for a job."""
        result = self.client.table("candidates")\
            .select("id", count="exact")\
            .eq("job_id", str(job_id))\
            .execute()
        return result.count or 0

    async def _get_interviewed_count(self, job_id: UUID) -> int:
        """Get count of interviewed candidates for a job."""
        result = self.client.table("candidates")\
            .select("id", count="exact")\
            .eq("job_id", str(job_id))\
            .eq("interview_status", "completed")\
            .execute()
        return result.count or 0
```

---

## Frontend Components

### Job List Page

```tsx
// frontend/src/app/jobs/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, CheckCircle, Clock } from "lucide-react";

interface Job {
  id: string;
  title: string;
  status: "draft" | "active" | "paused" | "closed";
  candidate_count: number;
  interviewed_count: number;
  created_at: string;
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/jobs`
      );
      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "draft": return "bg-yellow-500";
      case "paused": return "bg-orange-500";
      case "closed": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Jobs</h1>
        <Button onClick={() => router.push("/jobs/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Job
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : jobs.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No jobs yet. Create your first job to start hiring.
            </p>
            <Button onClick={() => router.push("/jobs/new")}>
              Create New Job
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/jobs/${job.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{job.title}</CardTitle>
                  <Badge className={getStatusColor(job.status)}>
                    {job.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {job.candidate_count} candidates
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    {job.interviewed_count} interviewed
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Created {new Date(job.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Create Job Page

```tsx
// frontend/src/app/jobs/new/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function NewJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title || !description) return;

    setCreating(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            raw_description: description,
          }),
        }
      );

      if (response.ok) {
        const job = await response.json();
        // Navigate to voice enrichment step
        router.push(`/jobs/${job.id}/enrich`);
      }
    } catch (error) {
      console.error("Failed to create job:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/jobs")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Jobs
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create New Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Job Title</Label>
            <Input
              id="title"
              placeholder="e.g., Senior Software Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Job Description</Label>
            <Textarea
              id="description"
              placeholder="Paste the full job description here..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={12}
            />
            <p className="text-xs text-muted-foreground">
              Our AI will automatically extract requirements, skills, and other
              details from the job description.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={!title || !description || creating}
          >
            {creating ? (
              "Creating..."
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Create & Continue to Voice Enrichment
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Job Detail Page

```tsx
// frontend/src/app/jobs/[id]/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  Upload,
  Play,
  Pause,
  CheckCircle,
  Edit,
} from "lucide-react";

interface Job {
  id: string;
  title: string;
  status: string;
  raw_description: string;
  extracted_requirements: any;
  company_context: any;
  scoring_criteria: any;
  red_flags: string[];
  candidate_count: number;
  interviewed_count: number;
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJob();
  }, [params.id]);

  const fetchJob = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/jobs/${params.id}`
      );
      const data = await response.json();
      setJob(data);
    } catch (error) {
      console.error("Failed to fetch job:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  if (!job) {
    return <div className="container mx-auto p-6">Job not found</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/jobs")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Jobs
      </Button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{job.title}</h1>
          <Badge className="mt-2">{job.status}</Badge>
        </div>
        <div className="flex gap-2">
          {job.status === "draft" && (
            <Button onClick={() => router.push(`/jobs/${job.id}/enrich`)}>
              <Edit className="mr-2 h-4 w-4" />
              Enrich with Voice
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push(`/jobs/${job.id}/upload`)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Candidates
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{job.candidate_count}</span>
            </div>
            <p className="text-sm text-muted-foreground">Total Candidates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{job.interviewed_count}</span>
            </div>
            <p className="text-sm text-muted-foreground">Interviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {job.candidate_count - job.interviewed_count}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="requirements">
        <TabsList>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="scoring">Scoring Criteria</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="description">Full Description</TabsTrigger>
        </TabsList>

        <TabsContent value="requirements">
          <Card>
            <CardHeader>
              <CardTitle>Extracted Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              {job.extracted_requirements ? (
                <div className="space-y-4">
                  {job.extracted_requirements.years_experience && (
                    <div>
                      <strong>Experience:</strong>{" "}
                      {job.extracted_requirements.years_experience}
                    </div>
                  )}
                  {job.extracted_requirements.required_skills?.length > 0 && (
                    <div>
                      <strong>Required Skills:</strong>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {job.extracted_requirements.required_skills.map(
                          (skill: string) => (
                            <Badge key={skill} variant="secondary">
                              {skill}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  )}
                  {/* Add more fields as needed */}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Requirements not yet extracted. Click "Enrich with Voice" to
                  add more details.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Criteria</CardTitle>
            </CardHeader>
            <CardContent>
              {job.scoring_criteria ? (
                <div className="space-y-4">
                  {/* Display scoring criteria */}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No scoring criteria defined. Use voice enrichment to set up
                  how candidates should be evaluated.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="candidates">
          {/* Candidate list - will be implemented in Phase 4 */}
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">
                {job.candidate_count === 0
                  ? "No candidates yet."
                  : `${job.candidate_count} candidates`}
              </p>
              <Button
                onClick={() => router.push(`/jobs/${job.id}/upload`)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Candidates CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="description">
          <Card>
            <CardHeader>
              <CardTitle>Full Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm">
                {job.raw_description}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Implementation Steps

1. **Create backend files:**
   - `backend/routers/jobs.py`
   - `backend/repositories/streamlined/job_repo.py`
   - `backend/services/jd_extractor.py`

2. **Register router in main.py:**
   ```python
   from routers.jobs import router as jobs_router
   app.include_router(jobs_router)
   ```

3. **Run database migrations** (from Phase 1)

4. **Create frontend pages:**
   - `frontend/src/app/jobs/page.tsx`
   - `frontend/src/app/jobs/new/page.tsx`
   - `frontend/src/app/jobs/[id]/page.tsx`

5. **Add navigation** to jobs page from main layout

## Next Phase

Once job management is working, proceed to [Phase 3: JD Voice Agent](./phase3-jd-voice-agent.md) to implement the voice-based job description enrichment.
