# Phase 4: Candidate Upload

## Overview

This phase implements the CSV upload flow that links candidates to a specific job. Key changes from the existing flow:

1. **Job Selection Required** - Must select a job before uploading
2. **Person Deduplication** - Same email = same person across jobs
3. **Candidate = Person + Job** - Creates a junction record

**Implementation Status: COMPLETE**

The upload endpoint is integrated into the jobs router at `/api/jobs/{job_id}/candidates/upload`.

## User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CANDIDATE UPLOAD FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Select Job                                                          │
│  • User navigates to job detail page                                         │
│  • Clicks "Upload Candidates"                                                │
│  • Job ID is already known from URL                                          │
│                                                                              │
│  STEP 2: Upload CSV                                                          │
│  • User selects or drags CSV file                                            │
│  • System validates CSV format                                               │
│  • Preview shows parsed candidates                                           │
│                                                                              │
│  STEP 3: Process Candidates                                                  │
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
| resume | No | Resume text (triggers async processing) |
| linkedin_url | No | LinkedIn profile URL |
| current_company | No | Current employer |
| current_title | No | Current job title |
| years_experience | No | Years of experience |

Example CSV:
```csv
name,email,phone,current_company,current_title,years_experience
John Doe,john@example.com,555-1234,Acme Inc,Senior Engineer,7
Jane Smith,jane@example.com,555-5678,Tech Corp,Lead Developer,5
```

## API Endpoints

### `POST /api/jobs/{job_id}/candidates/upload`

Upload a CSV of candidates for a specific job.

**Request:**
- Content-Type: `multipart/form-data`
- Body: CSV file

**Response:**
```json
{
  "job_id": "uuid",
  "created": 5,
  "updated": 2,
  "errors": ["Row 8: Missing email"],
  "total_processed": 7
}
```

### `GET /api/jobs/{job_id}/candidates`

Get all candidates for a job.

**Response:**
```json
{
  "job_id": "uuid",
  "job_title": "Senior Engineer",
  "candidates": [...],
  "total": 15
}
```

## Implementation Details

### Backend Files

- **Router**: `backend/routers/jobs.py`
  - `upload_candidates()` - CSV upload endpoint
  - `_process_resume_async()` - Background resume processing

- **Service**: `backend/services/resume_processor.py`
  - `extract_resume_data()` - LLM-based resume parsing
  - Returns `bio_summary`, `skills`, `years_experience`, etc.

### Data Flow

```
CSV Upload
    │
    ▼
Parse CSV rows
    │
    ▼
For each row:
    ├─► Find/Create Person (by email)
    │       └─► PersonRepository.get_or_create_sync()
    │
    ├─► Find/Create Candidate (person + job)
    │       └─► CandidateRepository.get_by_person_and_job_sync()
    │       └─► CandidateRepository.create_sync() or update_sync()
    │
    └─► If resume text provided:
            └─► Background task: _process_resume_async()
                    └─► resume_processor.extract_resume_data()
                    └─► CandidateRepository.update_sync()
```

### Resume Processing

When a resume is provided, it's processed asynchronously using LLM:

```python
# Extracted from resume:
{
    "bio_summary": "Experienced Python developer with 5+ years...",
    "skills": ["Python", "AWS", "FastAPI", "PostgreSQL"],
    "years_experience": 5,
    "education": "BS Computer Science, Stanford",
    "strengths_for_role": ["Strong backend skills", "Cloud experience"],
    "potential_concerns": ["No management experience"]
}
```

The `bio_summary` and `skills` are saved to the Candidate record.

## Frontend Integration

```tsx
// Example upload implementation
async function uploadCandidates(jobId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `/api/jobs/${jobId}/candidates/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const result = await response.json();

  console.log(`Created: ${result.created}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Errors: ${result.errors.join(", ")}`);
}
```

## Error Handling

Common errors and how they're handled:

| Error | Handling |
|-------|----------|
| Missing name/email | Skipped, added to errors list |
| Invalid CSV format | 400 Bad Request |
| Job not found | 404 Not Found |
| Duplicate email in CSV | First occurrence wins |
| Resume too short | Skipped resume processing |

## Configuration

Environment variables:
- `OPENROUTER_API_KEY` - For resume processing LLM calls
- `LLM_MODEL` - Model for resume extraction (default: google/gemini-2.5-flash)

## Database Tables

### `persons` table
- `id` (UUID, PK)
- `name` (string)
- `email` (string, unique)
- `phone` (string, nullable)
- `linkedin_url` (string, nullable)
- `resume_url` (string, nullable)
- `created_at`, `updated_at`

### `candidates` table
- `id` (UUID, PK)
- `person_id` (UUID, FK → persons)
- `job_posting_id` (UUID, FK → job_postings)
- `name`, `email` (denormalized from person)
- `bio_summary` (text, nullable)
- `skills` (jsonb array)
- `years_experience` (int, nullable)
- `current_company`, `job_title` (strings)
- `pipeline_status` (string)
- `created_at`, `updated_at`

## Next Phase

Once candidate upload is working, proceed to [Phase 5: Interview Flow](./phase5-interview-flow.md) to implement the candidate interview with full job context.
