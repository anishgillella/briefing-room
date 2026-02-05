"""
Jobs Router - API endpoints for job management.

Handles CRUD operations for jobs including creation, listing,
updating, and deletion with JD extraction.

Phase 3: Job enrichment via Vapi voice agent
Phase 4: Candidate CSV upload with resume processing
Phase 4 Multi-tenancy: Organization-scoped queries with authentication
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from enum import Enum
import csv
import io
import logging
import asyncio

from models.streamlined.job import (
    Job, JobCreate, JobUpdate, JobStatus, JobSummary,
    CompanyContext, ScoringCriteria, ExtractedRequirements
)
from models.streamlined.person import PersonCreate
from models.streamlined.candidate import CandidateCreate
from models.auth import CurrentUser
from repositories.streamlined.job_repo import JobRepository
from repositories.streamlined.person_repo import PersonRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from services.jd_extractor import (
    trigger_jd_extraction_for_job,
    extract_requirements_for_streamlined,
)
from middleware.auth_middleware import get_current_user, get_optional_user
from config import VAPI_PUBLIC_KEY, VAPI_ASSISTANT_ID, LLM_MODEL
from services.candidate_screening import process_candidate_screening

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def get_job_repo() -> JobRepository:
    """Dependency for getting JobRepository instance."""
    return JobRepository()


@router.post("/", response_model=Job)
async def create_job(
    job_data: JobCreate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    """
    Create a new job in the authenticated user's organization.

    1. Saves the raw job description with organization_id
    2. Triggers AI extraction of requirements (async)
    3. Returns the job with status 'draft'
    """
    repo = get_job_repo()

    # If the frontend provided extracted requirements with a formatted description,
    # use that as the source of truth for the job description to ensure beautiful rendering.
    if job_data.extracted_requirements and job_data.extracted_requirements.formatted_description:
        job_data.raw_description = job_data.extracted_requirements.formatted_description

    # Create the job record with organization scoping
    job = repo.create_for_org_sync(
        job_data=job_data,
        organization_id=current_user.organization_id,
        created_by_recruiter_id=current_user.recruiter_id
    )

    # Trigger async extraction ONLY if not already provided
    if not job_data.extracted_requirements and job_data.raw_description and len(job_data.raw_description) > 50:
        background_tasks.add_task(
            trigger_jd_extraction_for_job,
            str(job.id),
            job_data.raw_description
        )

    return job


class ExtractRequirementsRequest(BaseModel):
    """Request body for extract-requirements endpoint."""
    description: str


@router.post("/extract-requirements", response_model=ExtractedRequirements)
async def extract_requirements(
    request: ExtractRequirementsRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ExtractedRequirements:
    """
    Extract structured requirements from a job description text.

    Uses Gemini 2.5 Flash via OpenRouter with Pydantic structured outputs.
    Returns the validated ExtractedRequirements model with:
    - Basic info (experience, location, salary, etc.)
    - Skills (required, preferred, certifications)
    - Semantic profile attributes (success_signals, red_flags, behavioral_traits, etc.)
    - Missing fields that need recruiter input
    - Extraction confidence score
    """
    if not request.description or len(request.description.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Job description must be at least 50 characters"
        )

    requirements = await extract_requirements_for_streamlined(request.description)

    if not requirements:
        raise HTTPException(
            status_code=500,
            detail="Failed to extract requirements. Please try again."
        )

    return requirements


@router.get("/", response_model=List[Job])
async def list_jobs(
    status: Optional[str] = None,
    recruiter_id: Optional[str] = None,
    include_counts: bool = True,
    current_user: CurrentUser = Depends(get_current_user),
) -> List[Job]:
    """
    List all jobs for the authenticated user's organization.

    Args:
        status: Optional filter - one of 'draft', 'active', 'paused', 'closed'
        recruiter_id: Optional filter - UUID of the recruiter
        include_counts: If True (default), include candidate counts and stage counts.
                       Set to False for faster loading when counts aren't needed.

    Returns:
        List of jobs with candidate counts (scoped to organization)
    """
    repo = get_job_repo()
    recruiter_uuid = UUID(recruiter_id) if recruiter_id else None

    jobs = repo.list_all_for_org_sync(
        organization_id=current_user.organization_id,
        status=status,
        recruiter_id=recruiter_uuid,
        include_counts=include_counts
    )
    return jobs


@router.get("/active", response_model=List[Job])
async def list_active_jobs(
    current_user: CurrentUser = Depends(get_current_user),
) -> List[Job]:
    """List all active jobs only for the authenticated user's organization."""
    repo = get_job_repo()
    jobs = repo.list_all_for_org_sync(
        organization_id=current_user.organization_id,
        status="active"
    )
    return jobs


@router.get("/{job_id}", response_model=Job)
async def get_job(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    """Get a single job by ID (must belong to user's organization)."""
    repo = get_job_repo()
    job = repo.get_by_id_for_org_sync(job_id, current_user.organization_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.patch("/{job_id}", response_model=Job)
async def update_job(
    job_id: UUID,
    job_update: JobUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    """
    Update a job's details (must belong to user's organization).

    Can update:
    - title, raw_description, status
    - extracted_requirements (after voice agent enrichment)
    - company_context (after voice agent enrichment)
    - scoring_criteria, red_flags
    """
    repo = get_job_repo()
    job = repo.update_for_org_sync(job_id, current_user.organization_id, job_update)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.delete("/{job_id}")
async def delete_job(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Archive (soft delete) a job.

    The job is moved to archived state and can be restored later.
    All related candidates, interviews, and analytics are preserved.

    Use POST /{job_id}/permanent-delete to permanently delete an archived job.
    """
    repo = get_job_repo()
    success = repo.delete_for_org_sync(job_id, current_user.organization_id)

    if not success:
        raise HTTPException(status_code=404, detail="Job not found")

    return {"message": "Job archived successfully", "job_id": str(job_id)}


@router.post("/{job_id}/archive", response_model=Job)
async def archive_job(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    """
    Archive (soft delete) a job.

    The job is moved to archived state and can be restored later.
    All related candidates, interviews, and analytics are preserved.
    """
    repo = get_job_repo()
    job = repo.archive_for_org_sync(job_id, current_user.organization_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.post("/{job_id}/restore", response_model=Job)
async def restore_job(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    """
    Restore an archived job.

    The job is moved back to its previous status and becomes visible again.
    """
    repo = get_job_repo()
    job = repo.restore_for_org_sync(job_id, current_user.organization_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not archived")

    return job


@router.post("/{job_id}/permanent-delete")
async def permanent_delete_job(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Permanently delete an archived job.

    WARNING: This action is irreversible!

    The job record will be permanently deleted.
    Related candidates, interviews, and analytics will have their
    job reference set to NULL but will be preserved.
    """
    repo = get_job_repo()

    # Verify the job exists and is archived
    job = repo.get_archived_by_id_for_org_sync(job_id, current_user.organization_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found or not archived. Only archived jobs can be permanently deleted."
        )

    success = repo.permanent_delete_for_org_sync(job_id, current_user.organization_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to permanently delete job")

    return {"message": "Job permanently deleted", "job_id": str(job_id)}


@router.post("/{job_id}/activate", response_model=Job)
async def activate_job(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    """
    Activate a job (move from draft to active).

    Prerequisites:
    - Job should have extracted_requirements (from JD)
    - Job should ideally have scoring_criteria (from voice agent)
    """
    repo = get_job_repo()
    job = repo.get_by_id_for_org_sync(job_id, current_user.organization_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if job has minimum requirements
    if not job.extracted_requirements:
        raise HTTPException(
            status_code=400,
            detail="Job should have extracted requirements before activation. Wait for JD extraction to complete."
        )

    # Update status
    updated = repo.update_for_org_sync(job_id, current_user.organization_id, JobUpdate(status=JobStatus.ACTIVE))
    return updated


@router.post("/{job_id}/pause", response_model=Job)
async def pause_job(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    """Pause a job (temporarily stop reviewing candidates)."""
    repo = get_job_repo()
    updated = repo.update_for_org_sync(job_id, current_user.organization_id, JobUpdate(status=JobStatus.PAUSED))

    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")

    return updated


@router.post("/{job_id}/close", response_model=Job)
async def close_job(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    """Close a job (position filled or cancelled)."""
    repo = get_job_repo()
    updated = repo.update_for_org_sync(job_id, current_user.organization_id, JobUpdate(status=JobStatus.CLOSED))

    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")

    return updated


@router.post("/{job_id}/reopen", response_model=Job)
async def reopen_job(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    """Reopen a closed or paused job."""
    repo = get_job_repo()
    updated = repo.update_for_org_sync(job_id, current_user.organization_id, JobUpdate(status=JobStatus.ACTIVE))

    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")

    return updated


@router.post("/{job_id}/extract", response_model=Job)
async def trigger_extraction(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    """
    Manually trigger JD extraction for a job.

    Useful if automatic extraction failed or you updated the description.
    """
    repo = get_job_repo()
    job = repo.get_by_id_for_org_sync(job_id, current_user.organization_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.raw_description or len(job.raw_description) < 50:
        raise HTTPException(
            status_code=400,
            detail="Job description is too short for extraction"
        )

    # Trigger extraction in background
    background_tasks.add_task(
        trigger_jd_extraction_for_job,
        str(job_id),
        job.raw_description
    )

    return job


@router.get("/{job_id}/candidates")
async def get_job_candidates(
    job_id: UUID,
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get all candidates for a specific job (must belong to user's organization).
    """
    from repositories.streamlined.candidate_repo import CandidateRepository

    repo = get_job_repo()
    job = repo.get_by_id_for_org_sync(job_id, current_user.organization_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate_repo = CandidateRepository()
    candidates = candidate_repo.list_by_job_sync(job_id, status=status)

    return {
        "job_id": str(job_id),
        "job_title": job.title,
        "candidates": candidates,
        "total": len(candidates),
    }


@router.get("/{job_id}/candidates/{candidate_id}")
async def get_job_candidate(
    job_id: UUID,
    candidate_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get a single candidate for a specific job (must belong to user's organization).
    """
    from repositories.streamlined.candidate_repo import CandidateRepository
    from repositories.streamlined.person_repo import PersonRepository

    repo = get_job_repo()
    job = repo.get_by_id_for_org_sync(job_id, current_user.organization_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate_repo = CandidateRepository()
    candidate = candidate_repo.get_by_id_sync(candidate_id)

    if not candidate or str(candidate.job_id) != str(job_id):
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Get person details
    person_repo = PersonRepository()
    person = person_repo.get_by_id_sync(candidate.person_id)

    # Build response with person details
    response = {
        "id": str(candidate.id),
        "person_id": str(candidate.person_id),
        "job_id": str(candidate.job_id),
        "person_name": person.name if person else candidate.person_name,
        "person_email": person.email if person else candidate.person_email,
        "current_title": person.current_title if person else candidate.current_title,
        "current_company": person.current_company if person else candidate.current_company,
        "years_experience": candidate.years_experience,
        "skills": person.skills if person else candidate.skills,
        "bio_summary": candidate.bio_summary,
        "combined_score": candidate.combined_score,
        "screening_notes": candidate.screening_notes,
        "interview_status": candidate.interview_status.value if hasattr(candidate.interview_status, 'value') else candidate.interview_status,
        "pipeline_status": candidate.pipeline_status,
        "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
    }

    return response


@router.delete("/{job_id}/candidates/{candidate_id}")
async def delete_job_candidate(
    job_id: UUID,
    candidate_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Delete a candidate from a job.
    """
    from repositories.streamlined.candidate_repo import CandidateRepository

    repo = get_job_repo()
    job = repo.get_by_id_for_org_sync(job_id, current_user.organization_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate_repo = CandidateRepository()
    candidate = candidate_repo.get_by_id_sync(candidate_id)

    if not candidate or str(candidate.job_id) != str(job_id):
        raise HTTPException(status_code=404, detail="Candidate not found")

    success = candidate_repo.delete_sync(candidate_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete candidate")

    return {"message": "Candidate deleted successfully"}



@router.get("/{job_id}/analytics/summary")
async def get_job_analytics_summary(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get aggregated analytics for all candidates in a job.
    """
    from repositories.streamlined.analytics_repo import AnalyticsRepository

    repo = get_job_repo()
    job = repo.get_by_id_for_org_sync(job_id, current_user.organization_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    analytics_repo = AnalyticsRepository()

    try:
        analytics_list = analytics_repo.list_by_job_sync(job_id)
    except Exception:
        analytics_list = []

    if not analytics_list:
        return {
            "job_id": str(job_id),
            "job_title": job.title,
            "total_candidates": 0,
            "avg_score": 0,
            "recommendation_breakdown": {},
            "top_candidates": [],
        }

    # Calculate aggregates
    scores = [a.overall_score for a in analytics_list if a.overall_score]
    avg_score = sum(scores) / len(scores) if scores else 0

    # Count recommendations
    rec_breakdown = {}
    for a in analytics_list:
        rec = a.recommendation.value if hasattr(a.recommendation, 'value') else str(a.recommendation)
        rec_breakdown[rec] = rec_breakdown.get(rec, 0) + 1

    # Get top candidates
    sorted_analytics = sorted(
        analytics_list,
        key=lambda a: a.overall_score or 0,
        reverse=True
    )
    top_candidates = [
        {
            "candidate_name": a.candidate_name,
            "score": a.overall_score,
            "recommendation": a.recommendation.value if hasattr(a.recommendation, 'value') else str(a.recommendation),
        }
        for a in sorted_analytics[:5]
    ]

    return {
        "job_id": str(job_id),
        "job_title": job.title,
        "total_candidates": len(analytics_list),
        "avg_score": round(avg_score, 1),
        "recommendation_breakdown": rec_breakdown,
        "top_candidates": top_candidates,
    }


# =============================================================================
# Phase 3: Job Enrichment via Voice Agent
# =============================================================================

class VapiEnrichResponse(BaseModel):
    """Response containing Vapi configuration for job enrichment."""
    vapi_public_key: str
    assistant_id: str
    job_id: str
    assistant_overrides: Dict[str, Any]


@router.post("/{job_id}/enrich", response_model=VapiEnrichResponse)
async def get_job_enrich_config(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> VapiEnrichResponse:
    """
    Get Vapi configuration for job enrichment voice session.

    Returns assistant ID, public key, and variable overrides for the frontend
    to initiate a voice call that will enrich the job with:
    - Company context (culture, team size, reporting structure)
    - Scoring criteria (must-haves, nice-to-haves, weights)
    - Red flags to watch for

    The frontend uses this to start a Vapi call. Tool calls from the assistant
    will hit the /jobs/enrich-webhook endpoint to update the job.
    """
    repo = get_job_repo()
    job = repo.get_by_id_for_org_sync(job_id, current_user.organization_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not VAPI_PUBLIC_KEY:
        raise HTTPException(
            status_code=500,
            detail="Vapi public key not configured. Set VAPI_PUBLIC_KEY environment variable."
        )

    if not VAPI_ASSISTANT_ID:
        raise HTTPException(
            status_code=500,
            detail="Vapi assistant ID not configured. Set VAPI_ASSISTANT_ID environment variable."
        )

    # Build variable values from job data
    variable_values = _build_job_enrich_variables(job)
    variable_values["job_id"] = str(job_id)

    # Build first message
    first_message = _build_job_enrich_first_message(job)

    # Build system prompt for job enrichment
    system_prompt = _build_job_enrich_system_prompt(job)

    # Assistant overrides
    assistant_overrides = {
        "variableValues": variable_values,
        "firstMessage": first_message,
        "metadata": {
            "jobId": str(job_id),
            "jobTitle": job.title,
            "mode": "job_enrichment",
        },
        "model": {
            "provider": "openrouter",
            "model": LLM_MODEL,
            "temperature": 0.7,
            "systemPrompt": system_prompt
        },
        "voice": {
            "provider": "11labs",
            "voiceId": "pFZP5JQG7iQjIQuC4Bku",  # Lily - warm, conversational
            "stability": 0.5,
            "similarityBoost": 0.75,
        }
    }

    logger.info(f"Returning Vapi enrich config for job {job_id}")

    return VapiEnrichResponse(
        vapi_public_key=VAPI_PUBLIC_KEY,
        assistant_id=VAPI_ASSISTANT_ID,
        job_id=str(job_id),
        assistant_overrides=assistant_overrides,
    )


def _build_job_enrich_variables(job: Job) -> Dict[str, str]:
    """Build variable values for job enrichment Vapi session."""
    req = job.extracted_requirements

    variables = {
        "job_title": job.title,
        "job_description_summary": job.raw_description[:500] if job.raw_description else "",
    }

    if req:
        variables["years_experience"] = req.years_experience or "Not specified"
        variables["required_skills"] = ", ".join(req.required_skills) if req.required_skills else "Not specified"
        variables["preferred_skills"] = ", ".join(req.preferred_skills) if req.preferred_skills else "Not specified"
        variables["location"] = req.location or "Not specified"
        variables["work_type"] = req.work_type or "Not specified"

    return variables


def _build_job_enrich_first_message(job: Job) -> str:
    """Build opening message for job enrichment session."""
    req = job.extracted_requirements

    intro = f"Hi! I've reviewed the job description for {job.title}."

    if req and req.required_skills:
        skills = ", ".join(req.required_skills[:3])
        intro += f" I see you're looking for someone with {skills}."

    intro += " I'd like to ask a few questions to help define exactly what you're looking for. This will help us evaluate candidates more accurately. Ready to get started?"

    return intro


def _build_job_enrich_system_prompt(job: Job) -> str:
    """Build system prompt for job enrichment voice agent."""
    return f"""You are a recruiting advisor helping define hiring criteria for a {job.title} position.

## Context
Job Title: {job.title}
Job Description (summary): {job.raw_description[:1000] if job.raw_description else 'Not provided'}

## Your Goal
Extract information that's NOT in the written job description but in the recruiter's head:
1. Company/team context (culture, team size, who they report to)
2. Scoring criteria (must-haves vs nice-to-haves, how to weight skills)
3. Red flags (dealbreakers, patterns to avoid)

## Conversation Flow
1. Verify the extracted requirements are correct
2. Ask about the team they'll join (size, culture, reporting structure)
3. Define must-have vs nice-to-have skills
4. Ask about technical competencies to evaluate
5. Identify red flags and dealbreakers
6. Confirm the scoring weights (technical vs experience vs cultural fit)

## Tool Usage
Use these tools to save information AS YOU GO:
- `update_company_context`: Save company/team information
- `update_scoring_criteria`: Save must-haves, nice-to-haves, weights
- `add_red_flag`: Add a red flag to watch for
- `activate_job`: When enrichment is complete, activate the job

## Guidelines
- Keep responses concise (1-3 sentences)
- Ask ONE question at a time
- Be conversational, not robotic
- Save information immediately when you learn it

Remember: The job_id is {str(job.id)} - include this in all tool calls."""


@router.post("/enrich-webhook")
async def job_enrich_webhook(request: Dict[str, Any]):
    """
    Webhook endpoint for Vapi tool calls during job enrichment.

    Handles tool calls from the job enrichment voice agent to update
    the job with company context, scoring criteria, and red flags.
    """
    import json

    message_type = request.get("message", {}).get("type")

    logger.info(f"Job enrich webhook received: {message_type}")

    if message_type != "tool-calls":
        return {"status": "ok"}

    message = request.get("message", {})
    tool_calls = message.get("toolCalls", [])

    # Get job_id from metadata
    call_data = message.get("call", {})
    metadata = call_data.get("metadata", {}) or message.get("metadata", {})
    assistant_overrides = call_data.get("assistantOverrides", {})
    overrides_metadata = assistant_overrides.get("metadata", {})

    job_id_str = (
        metadata.get("jobId") or
        metadata.get("job_id") or
        overrides_metadata.get("jobId") or
        overrides_metadata.get("job_id")
    )

    results = []

    for tool_call in tool_calls:
        tool_name = tool_call.get("function", {}).get("name")
        tool_args = tool_call.get("function", {}).get("arguments", {})
        tool_call_id = tool_call.get("id")

        # Parse arguments if string
        if isinstance(tool_args, str):
            try:
                tool_args = json.loads(tool_args)
            except:
                tool_args = {}

        # Get job_id from args or metadata
        job_id = tool_args.get("job_id") or job_id_str

        if not job_id:
            results.append({
                "toolCallId": tool_call_id,
                "result": json.dumps({"error": "job_id not provided"})
            })
            continue

        try:
            result = await _execute_enrich_tool(tool_name, tool_args, job_id)
            results.append({
                "toolCallId": tool_call_id,
                "result": json.dumps(result)
            })
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            results.append({
                "toolCallId": tool_call_id,
                "result": json.dumps({"error": str(e)})
            })

    return {"results": results}


async def _execute_enrich_tool(tool_name: str, args: Dict[str, Any], job_id: str) -> Dict[str, Any]:
    """Execute a job enrichment tool."""
    repo = get_job_repo()
    job = repo.get_by_id_sync(UUID(job_id))

    if not job:
        return {"error": "Job not found"}

    result = {"success": False, "message": "Unknown tool"}

    if tool_name == "update_company_context":
        company_context = CompanyContext(
            company_name=args.get("company_name"),
            company_description=args.get("company_description"),
            team_size=args.get("team_size"),
            team_culture=args.get("team_culture"),
            reporting_to=args.get("reporting_to"),
            growth_stage=args.get("growth_stage"),
            key_projects=args.get("key_projects", []),
        )
        repo.update_sync(UUID(job_id), JobUpdate(company_context=company_context))
        result = {"success": True, "field": "company_context"}

    elif tool_name == "update_scoring_criteria":
        scoring = ScoringCriteria(
            must_haves=args.get("must_haves", []),
            nice_to_haves=args.get("nice_to_haves", []),
            cultural_fit_traits=args.get("cultural_fit_traits", []),
            technical_competencies=args.get("technical_competencies", []),
            weight_technical=args.get("weight_technical", 0.5),
            weight_experience=args.get("weight_experience", 0.3),
            weight_cultural=args.get("weight_cultural", 0.2),
        )
        repo.update_sync(UUID(job_id), JobUpdate(scoring_criteria=scoring))
        result = {"success": True, "field": "scoring_criteria"}

    elif tool_name == "add_red_flag":
        red_flag = args.get("red_flag", "")
        if red_flag:
            current_flags = job.red_flags or []
            if red_flag not in current_flags:
                current_flags.append(red_flag)
                repo.update_sync(UUID(job_id), JobUpdate(red_flags=current_flags))
            result = {"success": True, "red_flag": red_flag, "total": len(current_flags)}
        else:
            result = {"success": False, "error": "red_flag not provided"}

    elif tool_name == "activate_job":
        repo.update_sync(UUID(job_id), JobUpdate(status=JobStatus.ACTIVE))
        result = {"success": True, "status": "active"}

    return result


# =============================================================================
# Phase 4: Candidate CSV Upload
# =============================================================================

class UploadResult(BaseModel):
    """Result of candidate upload."""
    job_id: str
    created: int
    updated: int
    errors: List[str]
    total_processed: int


def _parse_enrichment_data(raw_json: str) -> Optional[Dict[str, Any]]:
    """Parse crustdata_enrichment_data JSON column safely."""
    import json as json_lib
    if not raw_json or raw_json.strip() == "":
        return None
    try:
        data = json_lib.loads(raw_json)
        # Handle both list and dict formats
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            return data[0]
        if isinstance(data, dict):
            return data
        return None
    except (json_lib.JSONDecodeError, TypeError):
        return None


def _extract_name_from_enrichment(enrichment: Dict[str, Any]) -> Optional[str]:
    """Extract name from enrichment data, checking multiple possible field names."""
    # Try different field names for name
    name = enrichment.get("full_name") or enrichment.get("name") or enrichment.get("Name")

    # If no direct name field, try combining first + last name
    if not name:
        first_name = enrichment.get("first_name") or enrichment.get("firstName") or ""
        last_name = enrichment.get("last_name") or enrichment.get("lastName") or ""
        if first_name or last_name:
            name = f"{first_name} {last_name}".strip()

    return name if name else None


def _extract_profile_from_enrichment(enrichment: Dict[str, Any]) -> Dict[str, Any]:
    """Extract profile fields from crustdata enrichment data."""
    profile = {}

    # Name - check multiple field names
    name = _extract_name_from_enrichment(enrichment)
    if name:
        profile["name"] = name

    # Headline
    if enrichment.get("headline"):
        profile["headline"] = str(enrichment["headline"])[:500]

    # Summary
    if enrichment.get("summary"):
        profile["summary"] = str(enrichment["summary"])

    # Location
    if enrichment.get("location"):
        profile["location"] = str(enrichment["location"])[:255]

    # Current job from current_employers
    current_employers = enrichment.get("current_employers", [])
    if current_employers and isinstance(current_employers, list) and len(current_employers) > 0:
        current_job = current_employers[0]
        if isinstance(current_job, dict):
            if current_job.get("employee_title"):
                profile["current_title"] = str(current_job["employee_title"])[:255]
            if current_job.get("employer_name") or current_job.get("company_name"):
                profile["current_company"] = str(
                    current_job.get("employer_name") or current_job.get("company_name")
                )[:255]

    # Fallback to title field if no current_employers
    if not profile.get("current_title") and enrichment.get("title"):
        profile["current_title"] = str(enrichment["title"])[:255]

    # Skills - extract names from skill objects
    skills_data = enrichment.get("skills", [])
    if skills_data and isinstance(skills_data, list):
        skills = []
        for s in skills_data[:30]:  # Limit to 30 skills
            if isinstance(s, dict):
                skill_name = s.get("name") or s.get("skill")
                if skill_name:
                    skills.append(str(skill_name))
            elif isinstance(s, str):
                skills.append(s)
        profile["skills"] = skills

    # Work history from past_employers + current_employers
    work_history = []
    for employer_list in [current_employers, enrichment.get("past_employers", [])]:
        if employer_list and isinstance(employer_list, list):
            for emp in employer_list[:10]:  # Limit to 10 positions
                if isinstance(emp, dict):
                    work_entry = {
                        "company": emp.get("employer_name") or emp.get("company_name"),
                        "title": emp.get("employee_title") or emp.get("title"),
                        "start_date": emp.get("start_date"),
                        "end_date": emp.get("end_date"),
                        "is_current": emp in current_employers,
                    }
                    work_history.append(work_entry)
    if work_history:
        profile["work_history"] = work_history

    # Education
    education_data = enrichment.get("education", [])
    if education_data and isinstance(education_data, list):
        education = []
        for edu in education_data[:5]:  # Limit to 5 education entries
            if isinstance(edu, dict):
                edu_entry = {
                    "school": edu.get("school_name") or edu.get("school"),
                    "degree": edu.get("degree"),
                    "field_of_study": edu.get("field_of_study") or edu.get("major"),
                    "start_date": edu.get("start_date"),
                    "end_date": edu.get("end_date") or edu.get("graduation_year"),
                }
                education.append(edu_entry)
        if education:
            profile["education"] = education

    # Store raw enrichment data for reference
    profile["enrichment_data"] = enrichment

    return profile


@router.post("/{job_id}/candidates/upload", response_model=UploadResult)
async def upload_candidates(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
) -> UploadResult:
    """
    Upload a CSV of candidates for a specific job (must belong to user's organization).

    CSV Format:
    - Required columns: name
    - Optional columns: email, phone, resume, linkedin_url, current_company, current_title, years_experience
    - Enrichment column: crustdata_enrichment_data (JSON with profile data from LinkedIn/Crustdata)

    Process:
    1. Validates the job exists and belongs to user's org
    2. Parses CSV
    3. For each row:
       - Parse crustdata_enrichment_data if present to extract profile (headline, summary, skills, etc.)
       - Find or create Person (by email or linkedin_url if available) with enriched profile
       - Find or create Candidate (person + job)
    4. Triggers LLM extraction and screening in PARALLEL BATCHES of 10 for speed
    5. Returns upload summary
    """
    import asyncio

    job_repo = get_job_repo()
    person_repo = PersonRepository()
    candidate_repo = CandidateRepository()

    # Validate job exists and belongs to user's organization
    job = job_repo.get_by_id_for_org_sync(job_id, current_user.organization_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Parse CSV
    content = await file.read()
    try:
        csv_text = content.decode("utf-8")
    except UnicodeDecodeError:
        csv_text = content.decode("latin-1")

    try:
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {str(e)}")

    # Validate required columns
    if rows:
        columns = set(rows[0].keys())
        # Normalize column names (lowercase, strip)
        columns_lower = {c.lower().strip() for c in columns}
        required = {"name"}
        missing = required - columns_lower
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing)}"
            )

    created = 0
    updated = 0
    errors = []

    # Collect candidates for batch LLM processing
    candidates_to_screen = []


    # Concurrency control
    sem = asyncio.Semaphore(20)

    async def process_row(row_num, row):
        async with sem:
            try:
                # Normalize column names
                row_normalized = {k.lower().strip(): v for k, v in row.items()}

                # Parse enrichment data if present
                enrichment_raw = row_normalized.get("crustdata_enrichment_data", "")
                enrichment = _parse_enrichment_data(enrichment_raw)
                profile_data = _extract_profile_from_enrichment(enrichment) if enrichment else {}

                # Get name
                name = row_normalized.get("name", "").strip()
                if not name and profile_data.get("name"):
                    name = profile_data.get("name")
                if not name and enrichment:
                    name = _extract_name_from_enrichment(enrichment)

                if not name:
                    return {"error": f"Row {row_num}: Missing name"}

                # Get email
                email = row_normalized.get("email", "").strip().lower() or None
                if not email and enrichment:
                    enrichment_email = enrichment.get("email") or enrichment.get("work_email") or enrichment.get("personal_email")
                    if isinstance(enrichment_email, list):
                        email = enrichment_email[0] if enrichment_email else None
                    else:
                        email = enrichment_email
                    if email:
                        email = str(email).strip().lower()

                # Get linkedin_url
                linkedin_url = row_normalized.get("linkedin_url", "").strip() or None
                if not linkedin_url and enrichment:
                    linkedin_url = enrichment.get("linkedin_url") or enrichment.get("linkedin_profile_url")

                # Build PersonCreate
                person_data = PersonCreate(
                    name=name,
                    email=email,
                    phone=row_normalized.get("phone", "").strip() or None,
                    linkedin_url=linkedin_url,
                    headline=profile_data.get("headline"),
                    summary=profile_data.get("summary"),
                    current_title=profile_data.get("current_title") or row_normalized.get("current_title", "").strip() or None,
                    current_company=profile_data.get("current_company") or row_normalized.get("current_company", "").strip() or None,
                    location=profile_data.get("location"),
                    skills=profile_data.get("skills", []),
                    work_history=profile_data.get("work_history", []),
                    education=profile_data.get("education", []),
                    enrichment_data=profile_data.get("enrichment_data"),
                )

                # Find or create Person (Async)
                person, person_created = await person_repo.get_or_create(person_data)

                # Update person enrichment if needed
                if not person_created and enrichment and not person.enrichment_data:
                    from models.streamlined.person import PersonUpdate
                    await person_repo.update(person.id, PersonUpdate(
                        headline=profile_data.get("headline"),
                        summary=profile_data.get("summary"),
                        current_title=profile_data.get("current_title"),
                        current_company=profile_data.get("current_company"),
                        location=profile_data.get("location"),
                        skills=profile_data.get("skills", []),
                        work_history=profile_data.get("work_history", []),
                        education=profile_data.get("education", []),
                        enrichment_data=profile_data.get("enrichment_data"),
                    ))

                # Check if Candidate already exists for this job (Async)
                existing = await candidate_repo.get_by_person_and_job(person.id, job_id)

                # Parse years_experience
                years_exp = None
                if row_normalized.get("years_experience"):
                    try:
                        years_exp = int(row_normalized.get("years_experience"))
                    except ValueError:
                        pass

                res_created = 0
                res_updated = 0
                candidate_id = None
                existing_score = None

                if existing:
                    # Update existing candidate
                    from models.streamlined.candidate import CandidateUpdate
                    await candidate_repo.update(existing.id, CandidateUpdate(
                        current_company=profile_data.get("current_company") or row_normalized.get("current_company", "").strip() or None,
                        current_title=profile_data.get("current_title") or row_normalized.get("current_title", "").strip() or None,
                        years_experience=years_exp,
                    ))
                    res_updated = 1
                    candidate_id = existing.id
                    existing_score = existing.combined_score
                else:
                    # Create new candidate
                    candidate = await candidate_repo.create(CandidateCreate(
                        person_id=person.id,
                        job_id=job_id,
                        current_company=profile_data.get("current_company") or row_normalized.get("current_company", "").strip() or None,
                        current_title=profile_data.get("current_title") or row_normalized.get("current_title", "").strip() or None,
                        years_experience=years_exp,
                    ))
                    res_created = 1
                    candidate_id = candidate.id
                    existing_score = None

                # Prepare return data
                screening_data = None
                if not existing_score:
                    enrichment_for_screening = enrichment if enrichment else row_normalized
                    screening_data = {
                        "candidate_id": candidate_id,
                        "person_id": person.id,
                        "enrichment_data": enrichment_for_screening,
                    }
                
                resume_task = None
                resume_text = row_normalized.get("resume", "").strip()
                if resume_text and len(resume_text) > 50:
                    resume_task = {
                       "candidate_id": candidate_id,
                       "resume_text": resume_text
                    }

                return {
                    "created": res_created,
                    "updated": res_updated,
                    "screening": screening_data,
                    "resume_task": resume_task
                }

            except Exception as e:
                logger.error(f"Error processing row {row_num}: {e}")
                return {"error": f"Row {row_num}: {str(e)}"}

    # Run processing within async context
    tasks = [process_row(i, row) for i, row in enumerate(rows, start=2)]
    results = await asyncio.gather(*tasks)

    # Aggregate results
    for res in results:
        if "error" in res:
            errors.append(res["error"])
            continue
        
        created += res.get("created", 0)
        updated += res.get("updated", 0)
        
        if res.get("screening"):
            candidates_to_screen.append(res["screening"])
        
        if res.get("resume_task"):
             # For resume processing, we still use background tasks but just queue them here
             background_tasks.add_task(
                _process_resume_async,
                res["resume_task"]["candidate_id"],
                res["resume_task"]["resume_text"],
                job.extracted_requirements
            )

    # Run LLM extraction and screening in parallel batches of 10
    if candidates_to_screen:
        logger.info(f"Starting parallel LLM screening for {len(candidates_to_screen)} candidates in batches of 10")
        background_tasks.add_task(
            _process_candidates_batch_parallel,
            candidates_to_screen,
            job.title,
            job.raw_description or "",
            job.extracted_requirements,
        )

    return UploadResult(
        job_id=str(job_id),
        created=created,
        updated=updated,
        errors=errors,
        total_processed=created + updated,
    )


async def _process_candidates_batch_parallel(
    candidates: List[Dict[str, Any]],
    job_title: str,
    job_description: str,
    extracted_requirements,
    batch_size: int = 10,
):
    """
    Process candidates in parallel batches for LLM extraction and screening.

    Args:
        candidates: List of dicts with candidate_id, person_id, enrichment_data
        job_title: The job title
        job_description: Full job description text
        extracted_requirements: ExtractedRequirements with weighted attributes
        batch_size: Number of concurrent LLM calls (default 10)
    """
    import asyncio

    total = len(candidates)
    logger.info(f"Processing {total} candidates in parallel batches of {batch_size}")

    for i in range(0, total, batch_size):
        batch = candidates[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (total + batch_size - 1) // batch_size

        logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} candidates)")

        # Create tasks for this batch
        tasks = [
            process_candidate_screening(
                candidate["candidate_id"],
                candidate["person_id"],
                candidate["enrichment_data"],
                job_title,
                job_description,
                extracted_requirements,
            )
            for candidate in batch
        ]

        # Run batch concurrently
        await asyncio.gather(*tasks, return_exceptions=True)

        logger.info(f"Completed batch {batch_num}/{total_batches}")

    logger.info(f"Finished processing all {total} candidates")


async def _process_resume_async(
    candidate_id: str,
    resume_text: str,
    job_requirements
):
    """
    Process a resume in the background and update the candidate.

    Extracts bio summary and skills from the resume text.
    """
    from services.resume_processor import extract_resume_data

    try:
        extracted = await extract_resume_data(resume_text, job_requirements)

        if extracted:
            candidate_repo = CandidateRepository()
            from models.streamlined.candidate import CandidateUpdate

            candidate_repo.update_sync(UUID(candidate_id), CandidateUpdate(
                bio_summary=extracted.get("bio_summary"),
                skills=extracted.get("skills", []),
            ))

            logger.info(f"Processed resume for candidate {candidate_id}")

    except Exception as e:
        logger.error(f"Failed to process resume for candidate {candidate_id}: {e}")


# =============================================================================
# Phase 5: Candidate Interview Flow with Full Job Context
# =============================================================================

from models.streamlined.interview import (
    Interview, InterviewCreate, InterviewUpdate,
    InterviewType, InterviewSessionStatus, InterviewStartResponse
)
from models.streamlined.candidate import CandidateUpdate, InterviewStatus
from repositories.streamlined.interview_repo import InterviewRepository
from datetime import datetime


class VapiInterviewResponse(BaseModel):
    """Response containing Vapi configuration for candidate interview."""
    interview_id: str
    vapi_public_key: str
    assistant_id: str
    candidate_id: str
    job_id: str
    assistant_overrides: Dict[str, Any]


class InterviewEndResponse(BaseModel):
    """Response after ending an interview."""
    interview_id: str
    status: str
    duration_seconds: Optional[int]
    message: str


@router.post("/{job_id}/candidates/{candidate_id}/interview/start", response_model=VapiInterviewResponse)
async def start_candidate_interview(
    job_id: UUID,
    candidate_id: UUID,
    interview_type: InterviewType = InterviewType.AI_CANDIDATE,
    current_user: CurrentUser = Depends(get_current_user),
) -> VapiInterviewResponse:
    """
    Start an interview session for a candidate with full job context.

    This is the Phase 5 streamlined interview flow:
    1. Loads candidate and job data (verifies org access)
    2. Creates Interview record
    3. Returns Vapi configuration with job-enriched prompts
    4. Updates candidate status to in_progress

    The voice agent uses the full job context (requirements, company context,
    scoring criteria) to provide a realistic candidate simulation.
    """
    job_repo = get_job_repo()
    candidate_repo = CandidateRepository()
    interview_repo = InterviewRepository()

    # Load job (with org verification)
    job = job_repo.get_by_id_for_org_sync(job_id, current_user.organization_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Load candidate and verify it belongs to this job
    candidate = candidate_repo.get_by_id_sync(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if str(candidate.job_id) != str(job_id):
        raise HTTPException(
            status_code=400,
            detail="Candidate does not belong to this job"
        )

    # Check Vapi configuration
    if not VAPI_PUBLIC_KEY or not VAPI_ASSISTANT_ID:
        raise HTTPException(
            status_code=500,
            detail="Vapi not configured. Set VAPI_PUBLIC_KEY and VAPI_ASSISTANT_ID."
        )

    # Create interview record
    interview = interview_repo.create_sync(InterviewCreate(
        candidate_id=candidate_id,
        interview_type=interview_type,
    ))

    # Update interview with start time
    interview_repo.update_sync(interview.id, InterviewUpdate(
        status=InterviewSessionStatus.IN_PROGRESS,
        started_at=datetime.utcnow(),
    ))

    # Update candidate status
    candidate_repo.update_sync(candidate_id, CandidateUpdate(
        interview_status=InterviewStatus.IN_PROGRESS,
    ))

    # Build candidate persona prompt with full job context
    system_prompt = _build_candidate_interview_prompt(candidate, job)
    first_message = _build_candidate_first_message(candidate, job)
    variable_values = _build_interview_variables(candidate, job, interview)

    # Assistant overrides for Vapi
    assistant_overrides = {
        "variableValues": variable_values,
        "firstMessage": first_message,
        "metadata": {
            "interviewId": str(interview.id),
            "candidateId": str(candidate_id),
            "jobId": str(job_id),
            "candidateName": candidate.person_name,
            "jobTitle": job.title,
            "mode": "candidate_interview",
        },
        "model": {
            "provider": "openrouter",
            "model": LLM_MODEL,
            "temperature": 0.7,
            "systemPrompt": system_prompt
        },
        "voice": {
            "provider": "11labs",
            "voiceId": "nPczCjzI2devNBz1zQrb",  # Brian - professional male voice
            "stability": 0.5,
            "similarityBoost": 0.75,
        }
    }

    logger.info(f"Started interview {interview.id} for candidate {candidate_id} on job {job_id}")

    return VapiInterviewResponse(
        interview_id=str(interview.id),
        vapi_public_key=VAPI_PUBLIC_KEY,
        assistant_id=VAPI_ASSISTANT_ID,
        candidate_id=str(candidate_id),
        job_id=str(job_id),
        assistant_overrides=assistant_overrides,
    )


def _build_candidate_interview_prompt(candidate, job) -> str:
    """Build a rich persona prompt for the AI candidate with full job context."""
    # Company context
    company_context = ""
    if job.company_context:
        cc = job.company_context
        company_context = f"""
COMPANY CONTEXT (what you know about the company):
- Company: {cc.company_name or 'Not specified'}
- Team Size: {cc.team_size or 'Not specified'}
- Culture: {cc.team_culture or 'Not specified'}
- Growth Stage: {cc.growth_stage or 'Not specified'}
- Reporting To: {cc.reporting_to or 'Not specified'}
"""

    # Job requirements
    requirements = ""
    if job.extracted_requirements:
        req = job.extracted_requirements
        requirements = f"""
JOB REQUIREMENTS (what the role needs):
- Experience: {req.years_experience or 'Not specified'}
- Required Skills: {', '.join(req.required_skills) if req.required_skills else 'Not specified'}
- Preferred Skills: {', '.join(req.preferred_skills) if req.preferred_skills else 'Not specified'}
- Work Type: {req.work_type or 'Not specified'}
- Location: {req.location or 'Not specified'}
"""

    # Scoring criteria awareness
    scoring_hints = ""
    if job.scoring_criteria:
        sc = job.scoring_criteria
        scoring_hints = f"""
WHAT THE INTERVIEWER IS LOOKING FOR (use this to tailor your answers):
- Must-haves: {', '.join(sc.must_haves[:3]) if sc.must_haves else 'General competence'}
- Nice-to-haves: {', '.join(sc.nice_to_haves[:3]) if sc.nice_to_haves else 'Additional skills'}
"""

    prompt = f"""You are {candidate.person_name or 'a candidate'}, a job candidate being interviewed for the position of {job.title}.

YOUR PROFESSIONAL BACKGROUND:
{candidate.bio_summary or 'You are an experienced professional with a strong background in your field.'}

YOUR KEY SKILLS:
{', '.join(candidate.skills[:10]) if candidate.skills else 'Various relevant skills for this role'}

CURRENT ROLE:
{f'{candidate.current_title} at {candidate.current_company}' if candidate.current_title else 'Currently exploring new opportunities'}

YEARS OF EXPERIENCE: {candidate.years_experience or 'Several years'}

{company_context}

{requirements}

{scoring_hints}

JOB DESCRIPTION SUMMARY:
{job.raw_description[:1500] if job.raw_description else 'A challenging role in a growing company.'}

---

INTERVIEW GUIDELINES:

1. STAY IN CHARACTER
   - You ARE {candidate.person_name or 'this candidate'}
   - Speak in first person ("I have experience in...")
   - Draw from your background naturally

2. ANSWER AUTHENTICALLY
   - Give specific examples from your experience
   - Show enthusiasm for the role and company
   - Be honest about areas where you're still growing

3. DEMONSTRATE FIT
   - Connect your experience to the job requirements
   - Show you understand the company culture
   - Ask thoughtful questions about the role

4. BE CONVERSATIONAL
   - Listen carefully to questions
   - Give concise but complete answers (30-60 seconds per response)
   - Don't monologue - leave room for follow-ups

5. SHOW PERSONALITY
   - Be professional but personable
   - Show genuine interest in the opportunity
   - Let your communication style shine through

Remember: You want this job, but you're also evaluating if it's right for you."""

    return prompt


def _build_candidate_first_message(candidate, job) -> str:
    """Build opening message for the candidate interview."""
    name = candidate.person_name or "there"
    title = job.title

    return f"""Hi, thank you for taking the time to meet with me today. I'm {name}, and I'm really excited about this {title} opportunity. I've been looking forward to learning more about the role and the team. How would you like to begin?"""


def _build_interview_variables(candidate, job, interview) -> Dict[str, str]:
    """Build variable values for the interview Vapi session."""
    return {
        "interview_id": str(interview.id),
        "candidate_id": str(candidate.id),
        "candidate_name": candidate.person_name or "Candidate",
        "job_id": str(job.id),
        "job_title": job.title,
        "years_experience": str(candidate.years_experience or "N/A"),
        "current_company": candidate.current_company or "N/A",
        "current_title": candidate.current_title or "N/A",
    }


@router.post("/interviews/{interview_id}/end", response_model=InterviewEndResponse)
async def end_interview(
    interview_id: UUID,
    background_tasks: BackgroundTasks,
) -> InterviewEndResponse:
    """
    End an interview session.

    1. Updates interview status to completed
    2. Calculates duration
    3. Updates candidate status to completed
    4. Triggers analytics generation (Phase 6)
    """
    interview_repo = InterviewRepository()
    candidate_repo = CandidateRepository()

    # Get interview
    interview = interview_repo.get_by_id_sync(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Calculate duration
    duration_seconds = None
    if interview.started_at:
        # Handle both timezone-aware and naive datetimes
        now = datetime.utcnow()
        started_at = interview.started_at
        if started_at.tzinfo is not None:
            started_at = started_at.replace(tzinfo=None)
        duration = now - started_at
        duration_seconds = int(duration.total_seconds())

    # Update interview
    interview_repo.update_sync(interview_id, InterviewUpdate(
        status=InterviewSessionStatus.COMPLETED,
        ended_at=datetime.utcnow(),
        duration_seconds=duration_seconds,
    ))

    # Update candidate status
    candidate_repo.update_sync(interview.candidate_id, CandidateUpdate(
        interview_status=InterviewStatus.COMPLETED,
    ))

    # Trigger analytics generation in background (Phase 6)
    background_tasks.add_task(
        _trigger_analytics_generation,
        str(interview_id)
    )

    logger.info(f"Ended interview {interview_id}, duration: {duration_seconds}s")

    return InterviewEndResponse(
        interview_id=str(interview_id),
        status="completed",
        duration_seconds=duration_seconds,
        message="Interview ended. Analytics will be generated shortly."
    )


async def _trigger_analytics_generation(interview_id: str):
    """Trigger analytics generation for a completed interview."""
    from services.analytics_generator import generate_analytics_background

    logger.info(f"Analytics generation triggered for interview {interview_id}")

    # Use synchronous version to avoid event loop issues in background tasks
    generate_analytics_background(interview_id)


@router.post("/interviews/webhook")
async def interview_webhook(request: Dict[str, Any]):
    """
    Webhook endpoint for Vapi events during candidate interviews.

    Handles:
    - transcript updates (saves to interview record)
    - end-of-call events (marks interview as completed)
    """
    import json

    message_type = request.get("message", {}).get("type")

    logger.info(f"Interview webhook received: {message_type}")

    if message_type == "end-of-call-report":
        # Extract interview ID from metadata
        message = request.get("message", {})
        call_data = message.get("call", {})
        metadata = call_data.get("assistantOverrides", {}).get("metadata", {})

        interview_id = metadata.get("interviewId")
        if interview_id:
            # Get transcript from the report
            transcript = message.get("transcript", "")

            interview_repo = InterviewRepository()
            candidate_repo = CandidateRepository()

            # Update interview with transcript
            interview = interview_repo.get_by_id_sync(UUID(interview_id))
            if interview:
                # Calculate duration (handle timezone-aware vs naive datetimes)
                duration_seconds = None
                if interview.started_at:
                    now = datetime.utcnow()
                    started_at = interview.started_at
                    if started_at.tzinfo is not None:
                        started_at = started_at.replace(tzinfo=None)
                    duration = now - started_at
                    duration_seconds = int(duration.total_seconds())

                interview_repo.update_sync(UUID(interview_id), InterviewUpdate(
                    status=InterviewSessionStatus.COMPLETED,
                    ended_at=datetime.utcnow(),
                    duration_seconds=duration_seconds,
                    transcript=transcript,
                ))

                # Update candidate status
                candidate_repo.update_sync(interview.candidate_id, CandidateUpdate(
                    interview_status=InterviewStatus.COMPLETED,
                ))

                logger.info(f"Interview {interview_id} completed via webhook")

    return {"status": "ok"}


@router.get("/interviews/{interview_id}")
async def get_interview(interview_id: UUID):
    """Get interview details including transcript."""
    interview_repo = InterviewRepository()
    interview = interview_repo.get_by_id_sync(interview_id)

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    return {
        "id": str(interview.id),
        "candidate_id": str(interview.candidate_id),
        "candidate_name": interview.candidate_name,
        "job_id": str(interview.job_id) if interview.job_id else None,
        "job_title": interview.job_title,
        "interview_type": interview.interview_type.value,
        "status": interview.status.value,
        "transcript": interview.transcript,
        "started_at": interview.started_at.isoformat() if interview.started_at else None,
        "ended_at": interview.ended_at.isoformat() if interview.ended_at else None,
        "duration_seconds": interview.duration_seconds,
        "created_at": interview.created_at.isoformat() if interview.created_at else None,
    }


@router.get("/{job_id}/candidates/{candidate_id}/interviews")
async def get_candidate_interviews(
    job_id: UUID,
    candidate_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get all interviews for a candidate on a specific job."""
    job_repo = get_job_repo()
    candidate_repo = CandidateRepository()
    interview_repo = InterviewRepository()

    # Validate job (with org verification)
    job = job_repo.get_by_id_for_org_sync(job_id, current_user.organization_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Validate candidate belongs to job
    candidate = candidate_repo.get_by_id_sync(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if str(candidate.job_id) != str(job_id):
        raise HTTPException(
            status_code=400,
            detail="Candidate does not belong to this job"
        )

    # Get interviews
    interviews = interview_repo.list_by_candidate_sync(candidate_id)

    return {
        "job_id": str(job_id),
        "job_title": job.title,
        "candidate_id": str(candidate_id),
        "candidate_name": candidate.person_name,
        "interviews": [
            {
                "id": str(i.id),
                "interview_type": i.interview_type.value,
                "status": i.status.value,
                "started_at": i.started_at.isoformat() if i.started_at else None,
                "ended_at": i.ended_at.isoformat() if i.ended_at else None,
                "duration_seconds": i.duration_seconds,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in interviews
        ],
        "total": len(interviews),
    }


# =============================================================================
# Phase 6: Analytics with Job-Specific Scoring
# =============================================================================

from models.streamlined.analytics import (
    Analytics, AnalyticsSummary, Recommendation
)
from repositories.streamlined.analytics_repo import AnalyticsRepository


class AnalyticsResponse(BaseModel):
    """Response containing analytics data."""
    id: str
    interview_id: str
    candidate_id: Optional[str] = None
    candidate_name: Optional[str] = None
    job_id: Optional[str] = None
    job_title: Optional[str] = None
    overall_score: float
    competency_scores: List[Dict[str, Any]]
    strengths: List[str]
    concerns: List[str]
    red_flags_detected: List[str]
    recommendation: str
    recommendation_reasoning: Optional[str] = None
    summary: str
    created_at: Optional[str] = None
    model_used: Optional[str] = None


class RegenerateAnalyticsResponse(BaseModel):
    """Response after regenerating analytics."""
    message: str
    analytics_id: str
    interview_id: str
    overall_score: float
    recommendation: str


@router.get("/interviews/{interview_id}/analytics", response_model=AnalyticsResponse)
async def get_interview_analytics(interview_id: UUID) -> AnalyticsResponse:
    """
    Get analytics for a specific interview.

    Returns the full analytics including:
    - Overall score
    - Competency scores with evidence
    - Strengths and concerns
    - Red flags detected
    - Recommendation with reasoning
    """
    analytics_repo = AnalyticsRepository()
    interview_repo = InterviewRepository()

    # Verify interview exists
    interview = interview_repo.get_by_id_sync(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Get analytics
    analytics = analytics_repo.get_by_interview_sync(interview_id)
    if not analytics:
        raise HTTPException(
            status_code=404,
            detail="Analytics not found. Interview may still be processing."
        )

    return AnalyticsResponse(
        id=str(analytics.id),
        interview_id=str(analytics.interview_id),
        candidate_id=str(analytics.candidate_id) if analytics.candidate_id else None,
        candidate_name=analytics.candidate_name,
        job_id=str(analytics.job_id) if analytics.job_id else None,
        job_title=analytics.job_title,
        overall_score=analytics.overall_score,
        competency_scores=[
            {
                "name": cs.name,
                "score": cs.score,
                "evidence": cs.evidence,
                "notes": cs.notes,
            }
            for cs in analytics.competency_scores
        ],
        strengths=analytics.strengths,
        concerns=analytics.concerns,
        red_flags_detected=analytics.red_flags_detected,
        recommendation=analytics.recommendation.value if hasattr(analytics.recommendation, 'value') else str(analytics.recommendation),
        recommendation_reasoning=analytics.recommendation_reasoning,
        summary=analytics.summary,
        created_at=analytics.created_at.isoformat() if analytics.created_at else None,
        model_used=analytics.model_used,
    )


@router.get("/{job_id}/candidates/{candidate_id}/analytics")
async def get_candidate_analytics(
    job_id: UUID,
    candidate_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get all analytics for a candidate on a specific job.

    Returns analytics from all interviews the candidate has had for this job.
    """
    job_repo = get_job_repo()
    candidate_repo = CandidateRepository()
    interview_repo = InterviewRepository()
    analytics_repo = AnalyticsRepository()

    # Validate job (with org verification)
    job = job_repo.get_by_id_for_org_sync(job_id, current_user.organization_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Validate candidate belongs to job
    candidate = candidate_repo.get_by_id_sync(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if str(candidate.job_id) != str(job_id):
        raise HTTPException(
            status_code=400,
            detail="Candidate does not belong to this job"
        )

    # Get all interviews for this candidate
    interviews = interview_repo.list_by_candidate_sync(candidate_id)

    # Get analytics for each interview
    analytics_list = []
    for interview in interviews:
        analytics = analytics_repo.get_by_interview_sync(interview.id)
        if analytics:
            analytics_list.append({
                "id": str(analytics.id),
                "interview_id": str(interview.id),
                "interview_type": interview.interview_type.value,
                "overall_score": analytics.overall_score,
                "recommendation": analytics.recommendation.value if hasattr(analytics.recommendation, 'value') else str(analytics.recommendation),
                "summary": analytics.summary,
                "strengths": analytics.strengths,
                "concerns": analytics.concerns,
                "red_flags_detected": analytics.red_flags_detected,
                "created_at": analytics.created_at.isoformat() if analytics.created_at else None,
            })

    # Calculate aggregate if multiple analytics
    avg_score = 0.0
    if analytics_list:
        scores = [a["overall_score"] for a in analytics_list]
        avg_score = sum(scores) / len(scores)

    return {
        "job_id": str(job_id),
        "job_title": job.title,
        "candidate_id": str(candidate_id),
        "candidate_name": candidate.person_name,
        "analytics": analytics_list,
        "total_interviews": len(interviews),
        "total_analytics": len(analytics_list),
        "average_score": round(avg_score, 1),
    }


@router.post("/interviews/{interview_id}/analytics/regenerate", response_model=RegenerateAnalyticsResponse)
async def regenerate_interview_analytics(
    interview_id: UUID,
    background_tasks: BackgroundTasks,
) -> RegenerateAnalyticsResponse:
    """
    Regenerate analytics for an interview.

    Useful when:
    - Job scoring criteria has been updated
    - Initial analytics generation failed
    - You want a fresh evaluation

    Note: This creates a new analytics record, not updates the old one.
    """
    from services.analytics_generator import generate_analytics_sync

    interview_repo = InterviewRepository()
    analytics_repo = AnalyticsRepository()

    # Verify interview exists and is completed
    interview = interview_repo.get_by_id_sync(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview.status.value != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Interview is not completed (status: {interview.status.value})"
        )

    if not interview.transcript:
        raise HTTPException(
            status_code=400,
            detail="Interview has no transcript. Cannot generate analytics."
        )

    # Delete existing analytics if any
    existing = analytics_repo.get_by_interview_sync(interview_id)
    if existing:
        analytics_repo.delete_sync(existing.id)

    # Generate new analytics (synchronous for immediate feedback)
    try:
        analytics = generate_analytics_sync(interview_id)

        return RegenerateAnalyticsResponse(
            message="Analytics regenerated successfully",
            analytics_id=str(analytics.id),
            interview_id=str(interview_id),
            overall_score=analytics.overall_score,
            recommendation=analytics.recommendation.value if hasattr(analytics.recommendation, 'value') else str(analytics.recommendation),
        )
    except Exception as e:
        logger.error(f"Failed to regenerate analytics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate analytics: {str(e)}"
        )


@router.get("/{job_id}/analytics")
async def get_all_job_analytics(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get analytics for all candidates in a job.

    Returns a list of analytics summaries sorted by score (highest first).
    """
    job_repo = get_job_repo()
    analytics_repo = AnalyticsRepository()

    # Validate job (with org verification)
    job = job_repo.get_by_id_for_org_sync(job_id, current_user.organization_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get all analytics for this job
    try:
        analytics_list = analytics_repo.list_by_job_sync(job_id)
    except Exception as e:
        logger.error(f"Error fetching job analytics: {e}")
        analytics_list = []

    # Format response
    formatted = []
    for a in analytics_list:
        formatted.append({
            "id": str(a.id),
            "interview_id": str(a.interview_id),
            "candidate_name": a.candidate_name,
            "overall_score": a.overall_score,
            "recommendation": a.recommendation.value if hasattr(a.recommendation, 'value') else str(a.recommendation),
            "summary": a.summary,
            "strengths_count": len(a.strengths),
            "concerns_count": len(a.concerns),
            "red_flags_count": len(a.red_flags_detected),
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    # Sort by score (highest first)
    formatted.sort(key=lambda x: x["overall_score"], reverse=True)

    return {
        "job_id": str(job_id),
        "job_title": job.title,
        "analytics": formatted,
        "total": len(formatted),
    }


# ============================================================================
# BULK ACTIONS
# ============================================================================


class BulkActionType(str, Enum):
    """Types of bulk actions that can be performed on candidates."""
    MOVE_STAGE = "move_stage"
    REJECT = "reject"
    ACCEPT = "accept"


class BulkUpdateRequest(BaseModel):
    """Request body for bulk candidate updates."""
    candidate_ids: List[UUID] = Field(..., min_length=1, description="List of candidate IDs to update")
    action: BulkActionType = Field(..., description="The bulk action to perform")
    target_stage: Optional[str] = Field(
        None,
        description="Target pipeline stage (required for move_stage action)"
    )


class BulkUpdateResult(BaseModel):
    """Result of a bulk update operation."""
    success_count: int
    failed_count: int
    updated_ids: List[str]
    failed_ids: List[str]
    errors: List[str]


@router.post("/{job_id}/candidates/bulk-update", response_model=BulkUpdateResult)
async def bulk_update_candidates(
    job_id: UUID,
    request: BulkUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> BulkUpdateResult:
    """
    Perform bulk actions on multiple candidates.

    Supported actions:
    - move_stage: Move candidates to a specific pipeline stage (requires target_stage)
    - reject: Mark candidates as rejected
    - accept: Mark candidates as accepted

    All candidates must belong to the specified job.
    """
    from enum import Enum as PyEnum

    job_repo = get_job_repo()
    candidate_repo = CandidateRepository()

    # Validate job exists and belongs to user's organization
    job = job_repo.get_by_id_for_org_sync(job_id, current_user.organization_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Validate target_stage for move_stage action
    if request.action == BulkActionType.MOVE_STAGE:
        if not request.target_stage:
            raise HTTPException(
                status_code=400,
                detail="target_stage is required for move_stage action"
            )
        valid_stages = ["new", "round_1", "round_2", "round_3", "decision_pending"]
        if request.target_stage not in valid_stages:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid target_stage. Must be one of: {', '.join(valid_stages)}"
            )

    updated_ids = []
    failed_ids = []
    errors = []

    for candidate_id in request.candidate_ids:
        try:
            # Verify candidate belongs to this job
            candidate = candidate_repo.get_by_id_sync(candidate_id)
            if not candidate:
                failed_ids.append(str(candidate_id))
                errors.append(f"Candidate {candidate_id} not found")
                continue

            if candidate.job_id != job_id:
                failed_ids.append(str(candidate_id))
                errors.append(f"Candidate {candidate_id} does not belong to this job")
                continue

            # Determine update based on action
            update_data = {}

            if request.action == BulkActionType.MOVE_STAGE:
                update_data["pipeline_status"] = request.target_stage
            elif request.action == BulkActionType.REJECT:
                update_data["pipeline_status"] = "rejected"
                update_data["interview_status"] = "completed"
            elif request.action == BulkActionType.ACCEPT:
                update_data["pipeline_status"] = "accepted"
                update_data["interview_status"] = "completed"

            # Apply the update
            from models.streamlined.candidate import CandidateUpdate
            candidate_update = CandidateUpdate(**update_data)
            updated = candidate_repo.update_sync(candidate_id, candidate_update)

            if updated:
                updated_ids.append(str(candidate_id))
            else:
                failed_ids.append(str(candidate_id))
                errors.append(f"Failed to update candidate {candidate_id}")

        except Exception as e:
            failed_ids.append(str(candidate_id))
            errors.append(f"Error updating candidate {candidate_id}: {str(e)}")
            logger.error(f"Bulk update error for candidate {candidate_id}: {e}")

    logger.info(
        f"Bulk update completed for job {job_id}: "
        f"{len(updated_ids)} updated, {len(failed_ids)} failed"
    )

    return BulkUpdateResult(
        success_count=len(updated_ids),
        failed_count=len(failed_ids),
        updated_ids=updated_ids,
        failed_ids=failed_ids,
        errors=errors,
    )
