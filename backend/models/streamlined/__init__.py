"""
Streamlined Interview Flow Models

This module contains the data models for the unified interview flow where:
- Jobs are the central organizing entity
- Persons can apply to multiple jobs (as Candidates)
- Interviews are linked to Candidates
- Analytics are generated per Interview with job-specific scoring

Hierarchy:
    Person (contact info)
      └── Candidate (application to a Job)
            └── Interview (interview session)
                  └── Analytics (AI analysis)

    Job (position details)
      └── Candidates (applications for this job)
"""

# Person models
from .person import (
    Person,
    PersonBase,
    PersonCreate,
    PersonUpdate,
    PersonWithApplications,
)

# Job models
from .job import (
    Job,
    JobBase,
    JobCreate,
    JobUpdate,
    JobStatus,
    JobSummary,
    ExtractedRequirements,
    CompanyContext,
    ScoringCriteria,
)

# Candidate models
from .candidate import (
    Candidate,
    CandidateBase,
    CandidateCreate,
    CandidateUpdate,
    CandidateWithScore,
    CandidateListItem,
    InterviewStatus,
)

# Interview models
from .interview import (
    Interview,
    InterviewBase,
    InterviewCreate,
    InterviewUpdate,
    InterviewSummary,
    InterviewStartResponse,
    InterviewType,
    InterviewSessionStatus,
)

# Analytics models
from .analytics import (
    Analytics,
    AnalyticsBase,
    AnalyticsCreate,
    AnalyticsUpdate,
    AnalyticsSummary,
    JobAnalyticsSummary,
    CompetencyScore,
    MustHaveAssessment,
    RedFlagDetection,
    Recommendation,
)

# Recruiter models
from .recruiter import (
    Recruiter,
    RecruiterBase,
    RecruiterCreate,
    RecruiterUpdate,
    RecruiterSummary,
    RecruiterStats,
)

__all__ = [
    # Person
    "Person",
    "PersonBase",
    "PersonCreate",
    "PersonUpdate",
    "PersonWithApplications",
    # Job
    "Job",
    "JobBase",
    "JobCreate",
    "JobUpdate",
    "JobStatus",
    "JobSummary",
    "ExtractedRequirements",
    "CompanyContext",
    "ScoringCriteria",
    # Candidate
    "Candidate",
    "CandidateBase",
    "CandidateCreate",
    "CandidateUpdate",
    "CandidateWithScore",
    "CandidateListItem",
    "InterviewStatus",
    # Interview
    "Interview",
    "InterviewBase",
    "InterviewCreate",
    "InterviewUpdate",
    "InterviewSummary",
    "InterviewStartResponse",
    "InterviewType",
    "InterviewSessionStatus",
    # Analytics
    "Analytics",
    "AnalyticsBase",
    "AnalyticsCreate",
    "AnalyticsUpdate",
    "AnalyticsSummary",
    "JobAnalyticsSummary",
    "CompetencyScore",
    "MustHaveAssessment",
    "RedFlagDetection",
    "Recommendation",
    # Recruiter
    "Recruiter",
    "RecruiterBase",
    "RecruiterCreate",
    "RecruiterUpdate",
    "RecruiterSummary",
    "RecruiterStats",
]
