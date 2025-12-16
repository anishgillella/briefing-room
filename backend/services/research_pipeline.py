"""
Research Pipeline service.
Orchestrates the full company research flow as a background task.
"""
import logging
from typing import Optional

from services.parallel_ai import parallel_service
from services.company_extractor import company_extractor
from repositories import job_profile_repo
from models.voice_ingest import CompanyIntelligence

logger = logging.getLogger(__name__)


async def research_company(
    session_id: str,
    company_name: str,
    website: str
) -> Optional[CompanyIntelligence]:
    """
    Full research pipeline: Parallel.ai search -> LLM extraction -> Save to DB.

    This function is designed to run as a background task.
    It updates the job profile's research status as it progresses.

    Args:
        session_id: Job profile session ID
        company_name: Company name to research
        website: Company website URL

    Returns:
        CompanyIntelligence if successful, None on failure
    """
    logger.info(f"Starting research pipeline for session {session_id}: {company_name}")

    try:
        # Step 1: Mark research as in-progress
        await job_profile_repo.update_research_status(session_id, "in_progress")

        # Step 2: Search via Parallel.ai
        logger.info(f"Searching Parallel.ai for {company_name}")
        raw_results = await parallel_service.research_company(
            company_name=company_name,
            website=website
        )

        # Check for complete failure
        if not raw_results.get("search_results") and raw_results.get("errors"):
            logger.warning(f"All Parallel.ai searches failed for {company_name}")
            # Continue with empty results - extraction will return fallback

        # Step 3: Extract structured data via LLM
        logger.info(f"Extracting structured data for {company_name}")
        company_intel = await company_extractor.extract(raw_results)

        # Step 4: Update job profile with enriched company data
        logger.info(f"Saving company intel for session {session_id}")
        success = await job_profile_repo.update_company_intel(session_id, company_intel)

        if success:
            logger.info(f"Research pipeline complete for session {session_id}")
            return company_intel
        else:
            logger.error(f"Failed to save company intel for session {session_id}")
            await job_profile_repo.update_research_status(session_id, "failed")
            return None

    except Exception as e:
        logger.error(f"Research pipeline failed for session {session_id}: {e}")
        await job_profile_repo.update_research_status(session_id, "failed")
        return None


async def research_company_with_fallback(
    session_id: str,
    company_name: str,
    website: str
) -> CompanyIntelligence:
    """
    Research with graceful degradation.
    Always returns a CompanyIntelligence, even on failure.

    Args:
        session_id: Job profile session ID
        company_name: Company name to research
        website: Company website URL

    Returns:
        CompanyIntelligence (possibly minimal on failure)
    """
    try:
        result = await research_company(session_id, company_name, website)
        if result:
            return result

    except Exception as e:
        logger.error(f"Research with fallback failed: {e}")

    # Fallback: minimal company intel
    logger.info(f"Using fallback company intel for {company_name}")
    fallback_intel = CompanyIntelligence(
        name=company_name,
        website=website,
        interesting_facts=[f"Visit {website} for more information"],
        potential_selling_points=["Growing company with exciting opportunities"]
    )

    # Try to save the fallback
    try:
        await job_profile_repo.update_company_intel(session_id, fallback_intel)
        await job_profile_repo.update_research_status(session_id, "partial")
    except Exception:
        pass

    return fallback_intel


async def quick_research(
    session_id: str,
    company_name: str,
    website: str
) -> Optional[CompanyIntelligence]:
    """
    Quick research using fewer searches.
    Use when speed is more important than comprehensiveness.

    Args:
        session_id: Job profile session ID
        company_name: Company name to research
        website: Company website URL

    Returns:
        CompanyIntelligence if successful
    """
    logger.info(f"Starting quick research for {company_name}")

    try:
        await job_profile_repo.update_research_status(session_id, "in_progress")

        # Use quick search instead of full research
        raw_results = await parallel_service.quick_search(
            company_name=company_name,
            website=website
        )

        company_intel = await company_extractor.extract(raw_results)

        await job_profile_repo.update_company_intel(session_id, company_intel)

        logger.info(f"Quick research complete for {company_name}")
        return company_intel

    except Exception as e:
        logger.error(f"Quick research failed: {e}")
        await job_profile_repo.update_research_status(session_id, "failed")
        return None
