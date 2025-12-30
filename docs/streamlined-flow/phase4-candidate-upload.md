# Phase 4: Candidate Upload

## Overview

This phase implements the CSV upload flow that links candidates to a specific job. Key changes from the existing flow:

1. **Job Selection Required** - Must select a job before uploading
2. **Person Deduplication** - Same email = same person across jobs
3. **Candidate = Person + Job** - Creates a junction record

## User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CANDIDATE UPLOAD FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Select Job                                                          │
│  ──────────────────                                                          │
│  • User navigates to job detail page                                         │
│  • Clicks "Upload Candidates"                                                │
│  • Job ID is already known from URL                                          │
│                                                                              │
│  STEP 2: Upload CSV                                                          │
│  ─────────────────                                                           │
│  • User selects or drags CSV file                                            │
│  • System validates CSV format                                               │
│  • Preview shows parsed candidates                                           │
│                                                                              │
│  STEP 3: Process Candidates                                                  │
│  ─────────────────────────                                                   │
│  For each row in CSV:                                                        │
│  ├── Check if Person exists (by email)                                       │
│  │   ├── YES: Use existing Person                                            │
│  │   └── NO: Create new Person                                               │
│  ├── Check if Candidate exists (person_id + job_id)                          │
│  │   ├── YES: Update existing Candidate                                      │
│  │   └── NO: Create new Candidate                                            │
│  └── Extract bio/skills from resume (async)                                  │
│                                                                              │
│  STEP 4: Review & Confirm                                                    │
│  ────────────────────────                                                    │
│  • Show processing results                                                   │
│  • Display any errors/warnings                                               │
│  • Redirect to job candidates list                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## CSV Format

Expected CSV columns:

| Column | Required | Description |
|--------|----------|-------------|
| name | Yes | Candidate's full name |
| email | Yes | Email address (used for deduplication) |
| phone | No | Phone number |
| resume | No | Resume text OR URL to resume file |
| linkedin_url | No | LinkedIn profile URL |
| current_company | No | Current employer |
| current_title | No | Current job title |
| years_experience | No | Years of experience |

Example CSV:
```csv
name,email,phone,resume,linkedin_url,current_company,current_title,years_experience
John Doe,john@example.com,555-1234,"Experienced engineer...",https://linkedin.com/in/johndoe,Acme Inc,Senior Engineer,7
Jane Smith,jane@example.com,555-5678,"Full-stack developer...",https://linkedin.com/in/janesmith,Tech Corp,Lead Developer,5
```

## API Endpoints

### Candidate Upload Endpoint

```python
# backend/routers/candidates.py

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from typing import List, Optional
from uuid import UUID
import csv
import io

from models.streamlined.person import Person, PersonCreate
from models.streamlined.candidate import Candidate, CandidateCreate, InterviewStatus
from repositories.streamlined.person_repo import PersonRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from repositories.streamlined.job_repo import JobRepository
from services.resume_processor import process_resume_async

router = APIRouter(prefix="/candidates", tags=["candidates"])


class UploadResult:
    def __init__(self):
        self.created = 0
        self.updated = 0
        self.errors = []


@router.post("/upload/{job_id}")
async def upload_candidates(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    person_repo: PersonRepository = Depends(get_person_repo),
    candidate_repo: CandidateRepository = Depends(get_candidate_repo),
    job_repo: JobRepository = Depends(get_job_repo),
):
    """
    Upload a CSV of candidates for a specific job.

    1. Validates the job exists
    2. Parses CSV
    3. For each row:
       - Find or create Person (by email)
       - Find or create Candidate (person + job)
    4. Triggers async resume processing
    5. Returns upload summary
    """
    # Validate job exists
    job = await job_repo.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Parse CSV
    content = await file.read()
    csv_text = content.decode("utf-8")

    try:
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {str(e)}")

    # Validate required columns
    required_columns = {"name", "email"}
    if rows:
        columns = set(rows[0].keys())
        missing = required_columns - columns
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing)}"
            )

    result = UploadResult()

    for row_num, row in enumerate(rows, start=2):  # Start at 2 (header is row 1)
        try:
            # Validate required fields
            if not row.get("name") or not row.get("email"):
                result.errors.append(f"Row {row_num}: Missing name or email")
                continue

            email = row["email"].strip().lower()
            name = row["name"].strip()

            # Find or create Person
            person = await person_repo.get_by_email(email)
            if not person:
                person = await person_repo.create(PersonCreate(
                    name=name,
                    email=email,
                    phone=row.get("phone", "").strip() or None,
                    linkedin_url=row.get("linkedin_url", "").strip() or None,
                ))

            # Check if Candidate already exists for this job
            existing = await candidate_repo.get_by_person_and_job(person.id, job_id)

            if existing:
                # Update existing candidate
                await candidate_repo.update(existing.id, {
                    "current_company": row.get("current_company", "").strip() or None,
                    "current_title": row.get("current_title", "").strip() or None,
                    "years_experience": int(row["years_experience"]) if row.get("years_experience") else None,
                })
                result.updated += 1
            else:
                # Create new candidate
                candidate = await candidate_repo.create(CandidateCreate(
                    person_id=person.id,
                    job_id=job_id,
                    current_company=row.get("current_company", "").strip() or None,
                    current_title=row.get("current_title", "").strip() or None,
                    years_experience=int(row["years_experience"]) if row.get("years_experience") else None,
                ))
                result.created += 1

                # Process resume in background
                resume_text = row.get("resume", "").strip()
                if resume_text:
                    background_tasks.add_task(
                        process_resume_async,
                        candidate.id,
                        resume_text,
                        job.extracted_requirements  # Pass job requirements for context
                    )

        except Exception as e:
            result.errors.append(f"Row {row_num}: {str(e)}")

    return {
        "job_id": str(job_id),
        "created": result.created,
        "updated": result.updated,
        "errors": result.errors,
        "total_processed": result.created + result.updated,
    }


@router.get("/job/{job_id}")
async def get_candidates_for_job(
    job_id: UUID,
    status: Optional[InterviewStatus] = None,
    candidate_repo: CandidateRepository = Depends(get_candidate_repo),
):
    """Get all candidates for a specific job."""
    candidates = await candidate_repo.list_by_job(job_id, status=status)
    return candidates


@router.get("/{candidate_id}")
async def get_candidate(
    candidate_id: UUID,
    candidate_repo: CandidateRepository = Depends(get_candidate_repo),
):
    """Get a single candidate with full details."""
    candidate = await candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.get("/person/{email}/applications")
async def get_person_applications(
    email: str,
    person_repo: PersonRepository = Depends(get_person_repo),
    candidate_repo: CandidateRepository = Depends(get_candidate_repo),
):
    """
    Get all job applications for a person (by email).

    Useful for seeing if someone has applied to multiple jobs.
    """
    person = await person_repo.get_by_email(email)
    if not person:
        return {"person": None, "applications": []}

    applications = await candidate_repo.list_by_person(person.id)

    return {
        "person": person,
        "applications": applications,
    }
```

### Resume Processing Service

```python
# backend/services/resume_processor.py

from typing import Optional, List
from uuid import UUID
import json

from models.streamlined.job import ExtractedRequirements
from models.streamlined.candidate import CandidateUpdate
from repositories.streamlined.candidate_repo import CandidateRepository
from services.llm_client import call_llm


RESUME_EXTRACTION_PROMPT = """
You are an expert recruiter. Analyze this resume and extract key information.

Resume:
{resume_text}

Job Requirements (for context):
{job_requirements}

Extract the following in JSON format:
{{
    "bio_summary": "A 2-3 sentence professional summary of this candidate",
    "skills": ["list", "of", "key", "skills"],
    "years_experience": 5,  // estimated total years, or null
    "education": "Highest degree and institution",
    "strengths_for_role": ["specific", "strengths", "relevant", "to", "job"],
    "potential_concerns": ["any", "gaps", "or", "concerns"]
}}

Be concise and focus on information relevant to the job requirements.
Return ONLY valid JSON.
"""


async def extract_resume_data(
    resume_text: str,
    job_requirements: Optional[ExtractedRequirements] = None
) -> dict:
    """Extract structured data from resume text."""

    # Format job requirements for context
    job_context = "Not specified"
    if job_requirements:
        job_context = f"""
        Required Skills: {', '.join(job_requirements.required_skills or [])}
        Experience: {job_requirements.years_experience or 'Not specified'}
        """

    prompt = RESUME_EXTRACTION_PROMPT.format(
        resume_text=resume_text[:5000],  # Limit resume length
        job_requirements=job_context
    )

    response = await call_llm(
        prompt=prompt,
        model="google/gemini-2.0-flash-001",
        temperature=0.1
    )

    try:
        return json.loads(response)
    except json.JSONDecodeError:
        return {}


async def process_resume_async(
    candidate_id: UUID,
    resume_text: str,
    job_requirements: Optional[ExtractedRequirements] = None
):
    """
    Process a resume in the background and update the candidate.

    This is called as a background task after CSV upload.
    """
    repo = CandidateRepository()

    try:
        # Extract data from resume
        extracted = await extract_resume_data(resume_text, job_requirements)

        # Update candidate with extracted data
        await repo.update(candidate_id, CandidateUpdate(
            bio_summary=extracted.get("bio_summary"),
            skills=extracted.get("skills", []),
            years_experience=extracted.get("years_experience"),
        ))

    except Exception as e:
        print(f"Failed to process resume for candidate {candidate_id}: {e}")
```

### Candidate Repository

```python
# backend/repositories/streamlined/candidate_repo.py

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from models.streamlined.candidate import Candidate, CandidateCreate, CandidateUpdate, InterviewStatus
from services.supabase_client import get_supabase_client


class CandidateRepository:
    def __init__(self):
        self.client = get_supabase_client()
        self.table = "candidates"

    async def create(self, data: CandidateCreate) -> Candidate:
        """Create a new candidate."""
        insert_data = {
            "person_id": str(data.person_id),
            "job_id": str(data.job_id),
            "bio_summary": data.bio_summary,
            "skills": data.skills,
            "years_experience": data.years_experience,
            "current_company": data.current_company,
            "current_title": data.current_title,
            "interview_status": InterviewStatus.PENDING.value,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = self.client.table(self.table).insert(insert_data).execute()
        return Candidate(**result.data[0])

    async def get_by_id(self, candidate_id: UUID) -> Optional[Candidate]:
        """Get candidate by ID with joined person and job data."""
        result = self.client.table(self.table)\
            .select("*, persons(name, email), jobs(title)")\
            .eq("id", str(candidate_id))\
            .execute()

        if not result.data:
            return None

        data = result.data[0]
        # Flatten joined data
        data["person_name"] = data.pop("persons", {}).get("name")
        data["person_email"] = data.pop("persons", {}).get("email")
        data["job_title"] = data.pop("jobs", {}).get("title")

        return Candidate(**data)

    async def get_by_person_and_job(
        self,
        person_id: UUID,
        job_id: UUID
    ) -> Optional[Candidate]:
        """Check if a candidate record exists for this person + job combo."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("person_id", str(person_id))\
            .eq("job_id", str(job_id))\
            .execute()

        if not result.data:
            return None

        return Candidate(**result.data[0])

    async def list_by_job(
        self,
        job_id: UUID,
        status: Optional[InterviewStatus] = None
    ) -> List[Candidate]:
        """List all candidates for a job."""
        query = self.client.table(self.table)\
            .select("*, persons(name, email)")\
            .eq("job_id", str(job_id))

        if status:
            query = query.eq("interview_status", status.value)

        result = query.order("created_at", desc=True).execute()

        candidates = []
        for data in result.data:
            data["person_name"] = data.pop("persons", {}).get("name")
            data["person_email"] = data.pop("persons", {}).get("email")
            candidates.append(Candidate(**data))

        return candidates

    async def list_by_person(self, person_id: UUID) -> List[Candidate]:
        """List all job applications for a person."""
        result = self.client.table(self.table)\
            .select("*, jobs(title, status)")\
            .eq("person_id", str(person_id))\
            .execute()

        candidates = []
        for data in result.data:
            data["job_title"] = data.pop("jobs", {}).get("title")
            candidates.append(Candidate(**data))

        return candidates

    async def update(
        self,
        candidate_id: UUID,
        data: CandidateUpdate
    ) -> Optional[Candidate]:
        """Update a candidate."""
        update_data = data.model_dump(exclude_unset=True)

        if not update_data:
            return await self.get_by_id(candidate_id)

        if "interview_status" in update_data:
            update_data["interview_status"] = update_data["interview_status"].value

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(candidate_id))\
            .execute()

        if not result.data:
            return None

        return Candidate(**result.data[0])
```

---

## Frontend Implementation

### Upload Page

```tsx
// frontend/src/app/jobs/[id]/upload/page.tsx

"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface ParsedCandidate {
  name: string;
  email: string;
  phone?: string;
  current_company?: string;
  current_title?: string;
}

interface UploadResult {
  created: number;
  updated: number;
  errors: string[];
  total_processed: number;
}

export default function UploadCandidatesPage() {
  const params = useParams();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedCandidate[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (text: string): ParsedCandidate[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const candidates: ParsedCandidate[] = [];

    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      // Preview first 5
      const values = lines[i].split(",").map((v) => v.trim());
      const candidate: any = {};

      headers.forEach((header, index) => {
        candidate[header] = values[index];
      });

      if (candidate.name && candidate.email) {
        candidates.push(candidate as ParsedCandidate);
      }
    }

    return candidates;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFile(file);
    setError(null);
    setResult(null);

    // Parse and preview
    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.length === 0) {
      setError("Could not parse CSV. Make sure it has 'name' and 'email' columns.");
      return;
    }

    setPreview(parsed);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/candidates/upload/${params.id}`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Upload failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push(`/jobs/${params.id}`)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Job
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Upload Candidates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Result Display */}
          {result && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Successfully processed {result.total_processed} candidates.
                ({result.created} new, {result.updated} updated)
                {result.errors.length > 0 && (
                  <div className="mt-2 text-sm text-orange-600">
                    {result.errors.length} rows had errors
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Dropzone */}
          {!result && (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors
                ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
                ${file ? "border-green-500 bg-green-50" : ""}
              `}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Click or drag to replace
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">
                    Drag & drop a CSV file, or click to select
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Required columns: name, email
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Preview Table */}
          {preview.length > 0 && !result && (
            <div>
              <h3 className="font-medium mb-2">
                Preview (first {preview.length} rows):
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Title</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((candidate, i) => (
                    <TableRow key={i}>
                      <TableCell>{candidate.name}</TableCell>
                      <TableCell>{candidate.email}</TableCell>
                      <TableCell>{candidate.current_company || "-"}</TableCell>
                      <TableCell>{candidate.current_title || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            {result ? (
              <Button
                className="flex-1"
                onClick={() => router.push(`/jobs/${params.id}`)}
              >
                View Candidates
              </Button>
            ) : (
              <>
                <Button
                  className="flex-1"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Candidates
                    </>
                  )}
                </Button>
                {file && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setPreview([]);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </>
            )}
          </div>

          {/* CSV Format Help */}
          <div className="bg-muted p-4 rounded-lg text-sm">
            <h4 className="font-medium mb-2">CSV Format:</h4>
            <code className="block bg-background p-2 rounded text-xs">
              name,email,phone,current_company,current_title,resume
              <br />
              John Doe,john@example.com,555-1234,Acme Inc,Senior Engineer,"Resume text..."
            </code>
            <p className="mt-2 text-muted-foreground">
              Only <strong>name</strong> and <strong>email</strong> are required.
              Other columns are optional.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Candidates List Component

```tsx
// frontend/src/components/candidates/candidate-list.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Play, CheckCircle, Clock, XCircle } from "lucide-react";

interface Candidate {
  id: string;
  person_name: string;
  person_email: string;
  current_company?: string;
  current_title?: string;
  interview_status: string;
  skills: string[];
}

interface CandidateListProps {
  jobId: string;
}

export function CandidateList({ jobId }: CandidateListProps) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCandidates();
  }, [jobId]);

  const fetchCandidates = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/candidates/job/${jobId}`
      );
      const data = await response.json();
      setCandidates(data);
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Play className="h-4 w-4 text-blue-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading candidates...</div>;
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">No candidates yet.</p>
        <Button onClick={() => router.push(`/jobs/${jobId}/upload`)}>
          Upload Candidates
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Current Role</TableHead>
          <TableHead>Skills</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((candidate) => (
          <TableRow key={candidate.id}>
            <TableCell>
              <div>
                <p className="font-medium">{candidate.person_name}</p>
                <p className="text-sm text-muted-foreground">
                  {candidate.person_email}
                </p>
              </div>
            </TableCell>
            <TableCell>
              {candidate.current_title && candidate.current_company ? (
                <div>
                  <p>{candidate.current_title}</p>
                  <p className="text-sm text-muted-foreground">
                    {candidate.current_company}
                  </p>
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {candidate.skills.slice(0, 3).map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
                {candidate.skills.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{candidate.skills.length - 3}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getStatusIcon(candidate.interview_status)}
                <span className="capitalize">{candidate.interview_status}</span>
              </div>
            </TableCell>
            <TableCell>
              {candidate.interview_status === "pending" && (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(`/candidates/${candidate.id}/interview`)
                  }
                >
                  <Play className="mr-1 h-3 w-3" />
                  Interview
                </Button>
              )}
              {candidate.interview_status === "completed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    router.push(`/candidates/${candidate.id}/analytics`)
                  }
                >
                  View Results
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

---

## Implementation Steps

1. **Create backend files:**
   - `backend/routers/candidates.py`
   - `backend/repositories/streamlined/candidate_repo.py`
   - `backend/repositories/streamlined/person_repo.py`
   - `backend/services/resume_processor.py`

2. **Register router in main.py:**
   ```python
   from routers.candidates import router as candidates_router
   app.include_router(candidates_router)
   ```

3. **Create frontend components:**
   - `frontend/src/app/jobs/[id]/upload/page.tsx`
   - `frontend/src/components/candidates/candidate-list.tsx`

4. **Install dropzone package:**
   ```bash
   npm install react-dropzone
   ```

5. **Update job detail page** to include CandidateList component

## Next Phase

Once candidate upload is working, proceed to [Phase 5: Interview Flow](./phase5-interview-flow.md) to implement the candidate interview with full job context.
