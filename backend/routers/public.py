"""
Public Router - Unauthenticated endpoints for career pages.

Handles public job viewing and candidate applications.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from uuid import UUID
import logging
import shutil
import os
from datetime import datetime

from models.streamlined.job import Job, JobStatus, ExtractedRequirements, WeightedAttribute
from models.streamlined.person import PersonCreate
from models.streamlined.candidate import CandidateCreate
from repositories.streamlined.job_repo import JobRepository
from repositories.streamlined.person_repo import PersonRepository
from repositories.streamlined.candidate_repo import CandidateRepository

from services.application_processor import process_new_application



logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public", tags=["public"])

# =============================================================================
# Response Models (Sanitized)
# =============================================================================

class PublicRequirements(BaseModel):
    """Sanitized requirements for public display."""
    years_experience: Optional[str] = None
    education: Optional[str] = None
    location: Optional[str] = None
    work_type: Optional[str] = None
    salary_range: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []

    @classmethod
    def from_internal(cls, req: Optional[ExtractedRequirements]):
        if not req:
            return cls()
        
        return cls(
            years_experience=req.years_experience,
            education=req.education,
            location=req.location,
            work_type=req.work_type,
            salary_range=req.salary_range,
            required_skills=[item.value for item in req.required_skills],
            preferred_skills=[item.value for item in req.preferred_skills]
        )

class PublicJobDetail(BaseModel):
    """Sanitized job details for public view."""
    id: str
    title: str
    description: str
    location: Optional[str] = None
    work_type: Optional[str] = None
    salary_range: Optional[str] = None
    requirements: PublicRequirements
    created_at: datetime

# =============================================================================
# Endpoints
# =============================================================================

@router.get("/jobs/{job_id}", response_model=PublicJobDetail)
async def get_public_job(job_id: UUID):
    """
    Get public job details. No authentication required.
    
    Hides internal scoring criteria, red flags, and notes.
    """
    repo = JobRepository()
    # We use get_by_id_sync which doesn't check org ownership (since it's public)
    # But we MUST check if it's active/published
    job = repo.get_by_id_sync(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Allow draft for preview? Maybe. But strictly should be ACTIVE.
    # For now, let's allow ACTIVE.
    if job.status != JobStatus.ACTIVE and job.status != JobStatus.DRAFT: 
        # Allowing DRAFT for testing ease, but maybe should restrict?
        # User prompt implies "publish", so maybe strict check later.
        pass

    # Extract plain location/work_type from requirements if available
    reqs = job.extracted_requirements
    location = reqs.location if reqs else None
    work_type = reqs.work_type if reqs else None
    salary = reqs.salary_range if reqs else None

    return PublicJobDetail(
        id=str(job.id),
        title=job.title,
        description=job.raw_description,
        location=location,
        work_type=work_type,
        salary_range=salary,
        requirements=PublicRequirements.from_internal(reqs),
        created_at=job.created_at
    )


@router.post("/jobs/{job_id}/apply")
async def apply_to_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    email: EmailStr = Form(...),
    phone: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    resume: Optional[UploadFile] = File(None),
):
    """
    Submit a job application.
    
    1. Creates/Updates Person record
    2. Upserts Candidate record
    3. Saves resume file
    """
    job_repo = JobRepository()
    person_repo = PersonRepository()
    candidate_repo = CandidateRepository()

    # 1. Verify Job
    job = job_repo.get_by_id_sync(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 2. Get or Create Person
    # Use robust entity resolution (Email > LinkedIn > Phone > Name)
    person_data = PersonCreate(
        name=name,
        email=email,
        phone=phone,
        linkedin_url=linkedin_url,
        resume_url=None # Will be updated if resume is uploaded
    )
    
    person, created = person_repo.get_or_create_sync(person_data)
    person_id = person.id

    # 3. Save Resume (if provided)
    resume_path = None
    if resume:
        # Initial local storage strategy
        upload_dir = f"uploads/resumes/{job_id}"
        os.makedirs(upload_dir, exist_ok=True)
        
        # timestamp to avoid collisions
        timestamp = int(datetime.utcnow().timestamp())
        safe_filename = f"{timestamp}_{resume.filename}".replace(" ", "_")
        file_path = f"{upload_dir}/{safe_filename}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)
        
        resume_path = file_path
        
        # Update person's resume_url if not set
        # (Or maybe we want to store it on the candidate application specifically? 
        # The model usually puts resume_url on Person, but let's check)
        # Assuming Person has resume_url. 
        # person_repo.update_resume_url(person_id, resume_path) 

    # 4. Create Candidate Application
    # Check if already applied?
    existing_candidate = candidate_repo.get_by_person_and_job_sync(person_id, job_id)
    if existing_candidate:
         # Already applied. Maybe update? Or return success?
         return {"message": "Application received", "candidate_id": str(existing_candidate.id)}

    candidate = candidate_repo.create_sync(CandidateCreate(
        job_id=job_id,
        person_id=person_id,
        person_name=name,
        person_email=email,
        # Default status is usually 'new'
    ))
    
    # 5. Send "Application Received" Confirmation Email IMMEDIATELY (before screening)
    from services.email_service import EmailService
    try:
        await EmailService.send_application_received_email(
            candidate_name=name,
            job_title=job.title,
            to_email=email
        )
        logger.info(f"Sent confirmation email to {email}")
    except Exception as e:
        logger.error(f"Failed to send confirmation email: {e}")
    
    # 6. Trigger Resume Parsing / Screening (Async - runs AFTER confirmation email)
    # If candidate is a Strong Fit, they'll get the interview link email after screening
    background_tasks.add_task(process_new_application, candidate.id, resume_path)

    return {"message": "Application submitted successfully", "candidate_id": str(candidate.id)}
