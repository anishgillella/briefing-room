"""
Candidate store service - Supabase backed.
Maintains the same interface as the original JSON-based store
but now uses the CandidateRepository for Supabase persistence.
"""

import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
from models.candidate import Candidate, CandidateUpdate
from repositories.candidate_repository import CandidateRepository
import logging

logger = logging.getLogger(__name__)

# Singleton repository instance
_repo: Optional[CandidateRepository] = None

def _get_repo() -> CandidateRepository:
    """Get the candidate repository singleton."""
    global _repo
    if _repo is None:
        _repo = CandidateRepository()
    return _repo


def _dict_to_candidate(data: Dict[str, Any]) -> Candidate:
    """Convert a database record to a Candidate model."""
    # Handle datetime fields
    if isinstance(data.get("created_at"), str):
        try:
            data["created_at"] = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
        except:
            data["created_at"] = datetime.utcnow()
    if isinstance(data.get("updated_at"), str):
        try:
            data["updated_at"] = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))
        except:
            data["updated_at"] = datetime.utcnow()
    
    return Candidate(**data)


def save_candidates(candidates: List[Candidate]):
    """Save a list of candidates to Supabase, replacing existing data for the job posting."""
    repo = _get_repo()
    
    for candidate in candidates:
        data = candidate.model_dump()
        # Check if candidate exists
        existing = repo.get_by_id(str(candidate.id))
        if existing:
            repo.update(str(candidate.id), data)
        else:
            repo.create(data)


def get_all_candidates() -> List[Candidate]:
    """Get all candidates from Supabase, sorted by combined_score descending."""
    repo = _get_repo()
    data = repo.get_all(limit=200)  # Increased limit for all candidates
    
    # Convert to Candidate models
    candidates = []
    for c_data in data:
        try:
            candidates.append(_dict_to_candidate(c_data))
        except Exception as e:
            logger.warning(f"Failed to parse candidate: {e}")
    
    # Already sorted by combined_score in repository, but ensure it here too
    return sorted(candidates, key=lambda c: c.combined_score or 0, reverse=True)


def get_candidate(candidate_id: str) -> Optional[Candidate]:
    """Get a specific candidate by ID from Supabase."""
    repo = _get_repo()
    data = repo.get_by_id(candidate_id)
    
    if data:
        try:
            return _dict_to_candidate(data)
        except Exception as e:
            logger.error(f"Failed to parse candidate {candidate_id}: {e}")
    
    return None


def update_candidate(candidate_id: str, updates: CandidateUpdate | dict) -> Optional[Candidate]:
    """Update a candidate with partial data in Supabase."""
    repo = _get_repo()
    
    # Convert updates to dict
    update_dict = updates if isinstance(updates, dict) else updates.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.utcnow().isoformat()
    
    result = repo.update(candidate_id, update_dict)
    
    if result:
        return _dict_to_candidate(result)
    
    return None


def add_candidate(candidate: Candidate) -> Candidate:
    """Add a single candidate to Supabase."""
    repo = _get_repo()
    data = candidate.model_dump()
    
    result = repo.create(data)
    if result:
        return _dict_to_candidate(result)
    
    return candidate


def add_candidates(new_candidates: List[Candidate]):
    """Add multiple candidates to Supabase."""
    repo = _get_repo()
    
    for candidate in new_candidates:
        data = candidate.model_dump()
        repo.create(data)


def delete_candidate(candidate_id: str) -> bool:
    """Delete a candidate by ID from Supabase. Returns True if deleted."""
    repo = _get_repo()
    return repo.delete(candidate_id)


def clear_all_candidates(job_posting_id: Optional[str] = None):
    """
    Clear candidates before new upload.
    If job_posting_id is provided, only clears candidates for that job (preserving other jobs).
    If job_posting_id is None, clears ALL candidates (use with caution).
    """
    repo = _get_repo()
    if job_posting_id:
        deleted = repo.delete_by_job_posting(job_posting_id)
        logger.info(f"Cleared {deleted} candidates for job_posting_id={job_posting_id}")
    else:
        deleted = repo.delete_all()
        logger.info(f"Cleared ALL {deleted} candidates")


def get_candidates_by_job(job_posting_id: str) -> List[Candidate]:
    """Get all candidates for a specific job posting."""
    repo = _get_repo()
    data = repo.get_all(limit=500, job_posting_id=job_posting_id)
    
    candidates = []
    for c_data in data:
        try:
            candidates.append(_dict_to_candidate(c_data))
        except Exception as e:
            logger.warning(f"Failed to parse candidate: {e}")
    
    return sorted(candidates, key=lambda c: c.combined_score or 0, reverse=True)


def get_candidates_count(job_posting_id: Optional[str] = None) -> int:
    """Get total number of candidates, optionally filtered by job posting."""
    repo = _get_repo()
    if job_posting_id:
        return len(repo.get_all(limit=1000, job_posting_id=job_posting_id))
    return repo.count()
