"""
Repository layer for database operations.
"""
import os

from .candidate_repository import CandidateRepository
from .interview_repository import InterviewRepository
from .analytics_repository import AnalyticsRepository

# Use local storage by default, Supabase if configured
USE_SUPABASE = os.getenv("USE_SUPABASE", "false").lower() == "true"

if USE_SUPABASE:
    from .job_profile_repository import JobProfileRepository, job_profile_repo
else:
    from .job_profile_local import LocalJobProfileRepository as JobProfileRepository, job_profile_repo

__all__ = [
    "CandidateRepository",
    "InterviewRepository",
    "AnalyticsRepository",
    "JobProfileRepository",
    "job_profile_repo",
]
