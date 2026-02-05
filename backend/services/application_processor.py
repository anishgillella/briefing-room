"""
Application Processor Service.

Handles the processing of new public applications:
1. Reads resume file (PDF/DOCX)
2. Extracts text
3. Parses structured data (skills, bio, etc.)
4. Triggers AI screening and scoring
"""

import os
import logging
from uuid import UUID
import asyncio
from typing import Optional

from pydantic import BaseModel

from repositories.streamlined.job_repo import JobRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from services.resume_processor import extract_resume_data
from services.candidate_screening import process_candidate_screening

logger = logging.getLogger(__name__)

async def process_new_application(candidate_id: UUID, resume_path: str):
    """
    Process a new candidate application.
    
    Args:
        candidate_id: UUID of the candidate
        resume_path: Path to the uploaded resume file
    """
    logger.info(f"Starting processing for candidate {candidate_id}")
    
    candidate_repo = CandidateRepository()
    job_repo = JobRepository()

    try:
        # 1. Get Candidate and Job details
        candidate = candidate_repo.get_by_id_sync(candidate_id)
        if not candidate:
            logger.error(f"Candidate {candidate_id} not found")
            return
            
        job = job_repo.get_by_id_sync(candidate.job_id)
        if not job:
            logger.error(f"Job {candidate.job_id} not found")
            return

        # 2. Extract Text from Resume
        resume_text = await _extract_text_from_file(resume_path)
        
        if not resume_text:
            logger.warning(f"Failed to extract text from resume: {resume_path}")
            # We can still proceed if we have other data, but for now let's stop or just warn
            # Continue to try screening if we have any manual data, otherwise it might fail
        
        # 3. Extract Structured Data using Resume Processor
        # This gets bio, skills, experience, etc.
        extracted_data = await extract_resume_data(
            resume_text=resume_text or "",
            job_requirements=job.extracted_requirements
        )

        # 4. Update Candidate with Extracted Data (Bio, Skills)
        # We do this quickly before the heavier screening
        from models.streamlined.candidate import CandidateUpdate
        
        # Prepare "enrichment data" which acts as the profile source for screening
        # strictly from the current application (resume + form data)
        enrichment_data = {
            "name": candidate.person_name,
            "email": candidate.person_email,
            "full_name": candidate.person_name,
            # Extracted fields
            "bio_summary": extracted_data.get("bio_summary"),
            "skills": extracted_data.get("skills", []),
            "years_experience": extracted_data.get("years_experience"),
            "education": extracted_data.get("education"),
            "location": candidate.person_name, 
        }
        
        # Update skills/bio immediately
        candidate_repo.update_sync(candidate_id, CandidateUpdate(
            bio_summary=extracted_data.get("bio_summary"),
            skills=extracted_data.get("skills", []),
            years_experience=extracted_data.get("years_experience")
        ))
        
        logger.info(f"Triggering FRESH screening for candidate {candidate_id} on Job {job.title} ({job.id})")
        
        # 5. Trigger Full Screening (Scoring, Fit Analysis)
        # This reuses the exact same logic as CSV upload
        await process_candidate_screening(
            candidate_id=candidate_id,
            person_id=candidate.person_id,
            enrichment_data=enrichment_data,
            job_title=job.title,
            job_description=job.raw_description or "",
            extracted_requirements=job.extracted_requirements
        )
        
        logger.info(f"Successfully processed application for candidate {candidate_id}")

    except Exception as e:
        logger.error(f"Error processing application {candidate_id}: {e}")


async def _extract_text_from_file(file_path: str) -> Optional[str]:
    """Read PDF or DOCX file and return text content."""
    if not os.path.exists(file_path):
        return None
        
    ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if ext == ".pdf":
            return _extract_from_pdf(file_path)
        elif ext in [".docx", ".doc"]:
            return _extract_from_docx(file_path)
        else:
            # Try parsing as plain text
            with open(file_path, "r", errors="ignore") as f:
                return f.read()
    except Exception as e:
        logger.error(f"Text extraction failed for {file_path}: {e}")
        return None

def _extract_from_pdf(file_path: str) -> str:
    from pypdf import PdfReader
    text = ""
    try:
        reader = PdfReader(file_path)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
    return text

def _extract_from_docx(file_path: str) -> str:
    import docx
    text = ""
    try:
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
    return text
