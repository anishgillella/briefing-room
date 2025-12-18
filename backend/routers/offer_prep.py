"""
Offer Prep Router - Endpoints for employer coaching and offer preparation.
Provides:
- Market compensation research
- Candidate intelligence aggregation
- Coaching session management
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging
import json

from services.parallel_ai import parallel_service
from services.compensation_extractor import compensation_extractor
from models.compensation import (
    CompensationData,
    CompensationResearchRequest,
    CompensationResearchResponse,
    CompensationComparison
)
from repositories.candidate_repository import CandidateRepository
from repositories.interview_repository import InterviewRepository
from repositories.analytics_repository import AnalyticsRepository

logger = logging.getLogger(__name__)

# Initialize repositories
candidate_repo = CandidateRepository()
interview_repo = InterviewRepository()
analytics_repo = AnalyticsRepository()

router = APIRouter(prefix="/api/offer-prep", tags=["offer-prep"])


# ============================================================================
# Schemas
# ============================================================================

class MarketDataRequest(BaseModel):
    """Request for market compensation data."""
    role_title: str
    location: str
    company_stage: Optional[str] = None
    years_experience: Optional[int] = None
    industry: Optional[str] = None
    specific_company: Optional[str] = None


class MarketDataResponse(BaseModel):
    """Response with market compensation data."""
    status: str
    data: Optional[CompensationData] = None
    raw_results_count: int = 0
    errors: List[str] = []


class OfferComparisonRequest(BaseModel):
    """Request to compare an offer against market data."""
    role_title: str
    location: str
    company_stage: Optional[str] = None
    industry: Optional[str] = None
    # Offer details
    offered_base: int
    offered_equity_percent: Optional[float] = None
    offered_bonus_percent: Optional[float] = None


class OfferComparisonResponse(BaseModel):
    """Response with offer comparison analysis."""
    status: str
    market_data: Optional[CompensationData] = None
    comparison: Optional[CompensationComparison] = None
    errors: List[str] = []


class CandidatePriority(BaseModel):
    """A priority extracted from interviews."""
    name: str
    importance: str  # "high", "medium", "low"
    evidence: Optional[str] = None
    source_round: Optional[str] = None


class KeyQuote(BaseModel):
    """A key quote from interviews."""
    text: str
    round: str
    context: Optional[str] = None


class RiskFactor(BaseModel):
    """A risk factor for closing the candidate."""
    description: str
    severity: str  # "high", "medium", "low"
    source: Optional[str] = None


class CandidateIntelligence(BaseModel):
    """Aggregated intelligence about a candidate for offer preparation."""
    candidate_id: str
    candidate_name: str
    role_title: Optional[str] = None
    current_company: Optional[str] = None

    # Interview insights
    priorities: List[CandidatePriority] = Field(default_factory=list)
    key_quotes: List[KeyQuote] = Field(default_factory=list)
    risk_factors: List[RiskFactor] = Field(default_factory=list)
    competing_offers: List[str] = Field(default_factory=list)

    # Scores and assessments
    close_probability: Optional[float] = None
    average_interview_score: Optional[float] = None
    recommendation: Optional[str] = None

    # Interview summary
    interviews_completed: int = 0
    total_transcript_turns: int = 0

    # Raw data for coaching
    all_transcripts: List[Dict[str, Any]] = Field(default_factory=list)
    all_analytics: List[Dict[str, Any]] = Field(default_factory=list)


class OfferPrepContext(BaseModel):
    """Full context for offer preparation."""
    candidate: CandidateIntelligence
    market_data: Optional[CompensationData] = None
    job_profile: Optional[Dict[str, Any]] = None
    ready_for_coaching: bool = False


class OfferDetails(BaseModel):
    """Offer details input by the employer."""
    base_salary: int
    equity_percent: Optional[float] = None
    equity_shares: Optional[int] = None
    vesting_schedule: Optional[str] = None
    bonus_percent: Optional[float] = None
    signing_bonus: Optional[int] = None
    start_date: Optional[str] = None
    other_benefits: Optional[str] = None


# ============================================================================
# Routes
# ============================================================================

@router.post("/market-data")
async def get_market_data(request: MarketDataRequest) -> MarketDataResponse:
    """
    Get market compensation data for a role.

    Uses web search to find salary ranges, equity benchmarks, and market trends,
    then extracts structured data using an LLM.
    """
    logger.info(f"Market data request for: {request.role_title} in {request.location}")

    errors = []

    try:
        # Step 1: Search for compensation data
        raw_results = await parallel_service.research_compensation(
            role_title=request.role_title,
            location=request.location,
            company_stage=request.company_stage,
            years_experience=request.years_experience,
            industry=request.industry,
            specific_company=request.specific_company
        )

        # Collect any search errors
        for error in raw_results.get("errors", []):
            errors.append(f"Search error: {error.get('error', 'Unknown')}")

        # Step 2: Extract structured data
        compensation_data = await compensation_extractor.extract(raw_results)

        results_count = len(raw_results.get("search_results", []))
        logger.info(f"Market data extracted from {results_count} results")

        return MarketDataResponse(
            status="success" if compensation_data.salary_median else "partial",
            data=compensation_data,
            raw_results_count=results_count,
            errors=errors
        )

    except Exception as e:
        logger.error(f"Error getting market data: {e}")
        return MarketDataResponse(
            status="failed",
            errors=[str(e)]
        )


@router.post("/compare-offer")
async def compare_offer(request: OfferComparisonRequest) -> OfferComparisonResponse:
    """
    Compare an offer against market data.

    Returns market data plus analysis of how the offer compares.
    """
    logger.info(f"Offer comparison request for: {request.role_title}")

    errors = []

    try:
        # Get market data first
        raw_results = await parallel_service.research_compensation(
            role_title=request.role_title,
            location=request.location,
            company_stage=request.company_stage,
            industry=request.industry
        )

        for error in raw_results.get("errors", []):
            errors.append(f"Search error: {error.get('error', 'Unknown')}")

        market_data = await compensation_extractor.extract(raw_results)

        # Calculate comparison
        comparison = _calculate_comparison(
            market_data=market_data,
            offered_base=request.offered_base,
            offered_equity_percent=request.offered_equity_percent,
            offered_bonus_percent=request.offered_bonus_percent
        )

        return OfferComparisonResponse(
            status="success",
            market_data=market_data,
            comparison=comparison,
            errors=errors
        )

    except Exception as e:
        logger.error(f"Error comparing offer: {e}")
        return OfferComparisonResponse(
            status="failed",
            errors=[str(e)]
        )


@router.get("/market-data/{role_title}")
async def get_market_data_simple(
    role_title: str,
    location: str = "San Francisco",
    company_stage: Optional[str] = None,
    industry: Optional[str] = None
) -> MarketDataResponse:
    """
    Simple GET endpoint for market data.
    Useful for quick lookups.
    """
    request = MarketDataRequest(
        role_title=role_title,
        location=location,
        company_stage=company_stage,
        industry=industry
    )
    return await get_market_data(request)


# ============================================================================
# Helper Functions
# ============================================================================

def _calculate_comparison(
    market_data: CompensationData,
    offered_base: int,
    offered_equity_percent: Optional[float],
    offered_bonus_percent: Optional[float]
) -> CompensationComparison:
    """Calculate how an offer compares to market data."""

    # Calculate base percentile
    base_percentile = None
    if market_data.salary_min and market_data.salary_max:
        salary_range = market_data.salary_max - market_data.salary_min
        if salary_range > 0:
            position = offered_base - market_data.salary_min
            base_percentile = int((position / salary_range) * 100)
            base_percentile = max(0, min(100, base_percentile))

    # Assess equity
    equity_assessment = None
    if offered_equity_percent and market_data.equity_typical_percent:
        if offered_equity_percent < market_data.equity_typical_percent * 0.8:
            equity_assessment = "below"
        elif offered_equity_percent > market_data.equity_typical_percent * 1.2:
            equity_assessment = "above"
        else:
            equity_assessment = "at"

    # Calculate competitive range
    competitive_base_range = None
    if market_data.salary_percentile_25 and market_data.salary_percentile_75:
        competitive_base_range = f"${market_data.salary_percentile_25:,} - ${market_data.salary_percentile_75:,}"
    elif market_data.salary_min and market_data.salary_max:
        # Use 25th to 75th of the range as estimate
        p25 = market_data.salary_min + int((market_data.salary_max - market_data.salary_min) * 0.25)
        p75 = market_data.salary_min + int((market_data.salary_max - market_data.salary_min) * 0.75)
        competitive_base_range = f"${p25:,} - ${p75:,}"

    # Estimate room to negotiate
    room_to_negotiate = None
    if market_data.salary_percentile_75 and offered_base < market_data.salary_percentile_75:
        room_to_negotiate = market_data.salary_percentile_75 - offered_base
    elif market_data.salary_max and offered_base < market_data.salary_max:
        room_to_negotiate = int((market_data.salary_max - offered_base) * 0.5)  # Conservative estimate

    # Assess negotiation risk
    negotiation_risk = None
    if base_percentile is not None:
        if base_percentile < 30:
            negotiation_risk = "high"
        elif base_percentile < 60:
            negotiation_risk = "medium"
        else:
            negotiation_risk = "low"

    # Total comp assessment
    total_comp_assessment = None
    if base_percentile is not None and equity_assessment:
        if base_percentile >= 50 and equity_assessment in ["at", "above"]:
            total_comp_assessment = "competitive"
        elif base_percentile >= 70 or equity_assessment == "above":
            total_comp_assessment = "strong"
        elif base_percentile < 40 and equity_assessment == "below":
            total_comp_assessment = "below_market"
        else:
            total_comp_assessment = "average"

    return CompensationComparison(
        offered_base=offered_base,
        offered_equity_percent=offered_equity_percent,
        offered_bonus_percent=offered_bonus_percent,
        market_data=market_data,
        base_percentile=base_percentile,
        equity_assessment=equity_assessment,
        total_comp_assessment=total_comp_assessment,
        competitive_base_range=competitive_base_range,
        room_to_negotiate=room_to_negotiate,
        negotiation_risk=negotiation_risk
    )


# ============================================================================
# Candidate Intelligence Routes
# ============================================================================

@router.get("/candidate/{candidate_id}/intelligence")
async def get_candidate_intelligence(candidate_id: str) -> CandidateIntelligence:
    """
    Get aggregated intelligence about a candidate for offer preparation.

    Combines data from:
    - Candidate profile
    - All interview transcripts
    - All interview analytics
    """
    # Get candidate
    candidate = candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Get all interviews with analytics
    interviews = interview_repo.get_candidate_interviews(candidate_id)

    # Aggregate data
    all_transcripts = []
    all_analytics = []
    total_turns = 0
    scores = []

    for interview in interviews:
        if interview.get("status") != "completed":
            continue

        # Get transcript
        transcript = analytics_repo.get_transcript_by_interview(interview["id"])
        if transcript:
            all_transcripts.append({
                "stage": interview["stage"],
                "turns": transcript.get("turns", []),
                "full_text": transcript.get("full_text", "")
            })
            total_turns += len(transcript.get("turns", []))

        # Get analytics
        analytics = interview.get("analytics")
        if analytics:
            if isinstance(analytics, list) and analytics:
                analytics = analytics[0]
            all_analytics.append({
                "stage": interview["stage"],
                **analytics
            })
            if analytics.get("overall_score"):
                scores.append(analytics["overall_score"])

    # Calculate close probability based on scores and recommendation
    close_probability = None
    if scores:
        avg_score = sum(scores) / len(scores)
        # Simple heuristic: score/100 * base probability (0.7)
        close_probability = round(min(0.95, (avg_score / 100) * 0.85 + 0.1), 2)

    # Extract latest recommendation
    recommendation = None
    if all_analytics:
        latest = all_analytics[-1]
        recommendation = latest.get("recommendation")

    return CandidateIntelligence(
        candidate_id=candidate_id,
        candidate_name=candidate.get("name", "Unknown"),
        role_title=candidate.get("job_title"),
        current_company=candidate.get("current_company"),
        priorities=[],  # Will be populated by LLM analysis
        key_quotes=[],  # Will be populated by LLM analysis
        risk_factors=[],  # Will be populated by LLM analysis
        competing_offers=[],  # Will be populated by LLM analysis
        close_probability=close_probability,
        average_interview_score=round(sum(scores) / len(scores), 1) if scores else None,
        recommendation=recommendation,
        interviews_completed=len([i for i in interviews if i.get("status") == "completed"]),
        total_transcript_turns=total_turns,
        all_transcripts=all_transcripts,
        all_analytics=all_analytics
    )


@router.get("/candidate/{candidate_id}/context")
async def get_offer_prep_context(
    candidate_id: str,
    include_market_data: bool = True,
    role_title: Optional[str] = None,
    location: Optional[str] = None,
    company_stage: Optional[str] = None
) -> OfferPrepContext:
    """
    Get full context for offer preparation including candidate intelligence
    and optionally market data.

    This is the main endpoint for the Offer Prep page.
    """
    # Get candidate intelligence
    intelligence = await get_candidate_intelligence(candidate_id)

    # Get market data if requested
    market_data = None
    if include_market_data and (role_title or intelligence.role_title):
        try:
            raw_results = await parallel_service.research_compensation(
                role_title=role_title or intelligence.role_title or "Software Engineer",
                location=location or "San Francisco",
                company_stage=company_stage
            )
            market_data = await compensation_extractor.extract(raw_results)
        except Exception as e:
            logger.error(f"Error fetching market data: {e}")

    # Check if ready for coaching (all 3 interviews complete)
    ready = intelligence.interviews_completed >= 3

    return OfferPrepContext(
        candidate=intelligence,
        market_data=market_data,
        ready_for_coaching=ready
    )


@router.get("/candidate/{candidate_id}/check-ready")
async def check_offer_prep_ready(candidate_id: str) -> Dict[str, Any]:
    """
    Quick check if a candidate is ready for offer preparation.
    """
    # Verify candidate exists
    candidate = candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Check interview completion
    all_complete = interview_repo.all_stages_complete(candidate_id)
    completed_stages = interview_repo.get_completed_stages(candidate_id)

    return {
        "candidate_id": candidate_id,
        "candidate_name": candidate.get("name"),
        "ready_for_offer_prep": all_complete,
        "stages_completed": len(completed_stages),
        "total_stages": 3,
        "pipeline_status": candidate.get("pipeline_status")
    }


# ============================================================================
# Coaching Session Routes
# ============================================================================

class CoachingSessionRequest(BaseModel):
    """Request to start a coaching session."""
    candidate_id: str
    offer_base: Optional[int] = None
    offer_equity: Optional[float] = None
    offer_bonus: Optional[float] = None
    role_title: Optional[str] = None
    location: Optional[str] = None


class CoachingVariables(BaseModel):
    """Variables to pass to the VAPI assistant."""
    candidate_name: str
    role_title: str
    interview_summary: str
    candidate_priorities: str
    key_quotes: str
    risk_factors: str
    market_data: str
    offer_base: str
    offer_equity: str
    close_probability: str


@router.post("/coaching/prepare")
async def prepare_coaching_session(request: CoachingSessionRequest) -> Dict[str, Any]:
    """
    Prepare context for a coaching session.
    Returns variables to pass to the VAPI assistant.
    """
    # Get candidate intelligence
    intelligence = await get_candidate_intelligence(request.candidate_id)

    # Build interview summary from transcripts
    interview_summary = _build_interview_summary(intelligence.all_transcripts, intelligence.all_analytics)

    # Build candidate priorities string
    priorities_str = _extract_priorities_from_analytics(intelligence.all_analytics)

    # Build key quotes string
    quotes_str = _extract_key_quotes(intelligence.all_analytics)

    # Build risk factors string
    risks_str = _extract_risk_factors(intelligence.all_analytics)

    # Get market data if we have role info
    market_str = "Market data not available"
    if request.role_title or intelligence.role_title:
        try:
            raw_results = await parallel_service.research_compensation(
                role_title=request.role_title or intelligence.role_title or "Software Engineer",
                location=request.location or "San Francisco"
            )
            market_data = await compensation_extractor.extract(raw_results)
            if market_data.salary_median:
                market_str = (
                    f"Market salary range: ${market_data.salary_min:,} - ${market_data.salary_max:,} "
                    f"(median ${market_data.salary_median:,}). "
                    f"Typical equity: {market_data.equity_typical_percent or 'N/A'}%. "
                    f"Market trend: {market_data.market_trend or 'stable'}."
                )
        except Exception as e:
            logger.error(f"Error fetching market data for coaching: {e}")

    # Build coaching variables
    variables = CoachingVariables(
        candidate_name=intelligence.candidate_name,
        role_title=request.role_title or intelligence.role_title or "the role",
        interview_summary=interview_summary,
        candidate_priorities=priorities_str,
        key_quotes=quotes_str,
        risk_factors=risks_str,
        market_data=market_str,
        offer_base=f"${request.offer_base:,}" if request.offer_base else "Not specified",
        offer_equity=f"{request.offer_equity}%" if request.offer_equity else "Not specified",
        close_probability=f"{int(intelligence.close_probability * 100)}%" if intelligence.close_probability else "Unknown"
    )

    return {
        "status": "ready",
        "candidate_id": request.candidate_id,
        "variables": variables.model_dump(),
        "interviews_completed": intelligence.interviews_completed,
        "ready_for_coaching": intelligence.interviews_completed >= 3
    }


def _build_interview_summary(transcripts: List[Dict], analytics: List[Dict]) -> str:
    """Build a summary of all interviews for the coaching prompt."""
    if not transcripts and not analytics:
        return "No interview data available."

    summary_parts = []

    for i, (transcript, analytic) in enumerate(zip(
        transcripts or [{}] * 3,
        analytics or [{}] * 3
    )):
        stage = transcript.get("stage") or analytic.get("stage") or f"round_{i+1}"
        stage_name = stage.replace("_", " ").title()

        # Get synthesis from analytics
        synthesis = analytic.get("synthesis", "")
        score = analytic.get("overall_score", "")
        rec = analytic.get("recommendation", "")

        if synthesis or score:
            summary_parts.append(
                f"{stage_name}: {synthesis or 'No synthesis'} "
                f"(Score: {score or 'N/A'}, Recommendation: {rec or 'N/A'})"
            )
        elif transcript.get("turns"):
            # Summarize from transcript if no analytics
            turn_count = len(transcript.get("turns", []))
            summary_parts.append(f"{stage_name}: {turn_count} conversation turns recorded.")

    return " | ".join(summary_parts) if summary_parts else "Interview summaries not available."


def _extract_priorities_from_analytics(analytics: List[Dict]) -> str:
    """Extract candidate priorities from analytics."""
    # Look for topics, highlights, and behavioral indicators
    priorities = set()

    for analytic in analytics:
        # From highlights
        for highlight in analytic.get("highlights", []):
            if isinstance(highlight, str) and len(highlight) < 100:
                priorities.add(highlight)

        # From behavioral profile
        profile = analytic.get("behavioral_profile", {})
        if profile:
            for trait, score in profile.items():
                if isinstance(score, (int, float)) and score > 7:
                    priorities.add(f"Strong {trait}")

    if priorities:
        return "; ".join(list(priorities)[:5])
    return "Priorities will be discussed during coaching based on transcript review."


def _extract_key_quotes(analytics: List[Dict]) -> str:
    """Extract key quotes from analytics."""
    quotes = []

    for analytic in analytics:
        stage = analytic.get("stage", "interview")
        # From quotable moments
        for quote in analytic.get("quotable_moments", [])[:2]:
            if isinstance(quote, str):
                quotes.append(f'"{quote}" - {stage}')
            elif isinstance(quote, dict):
                quotes.append(f'"{quote.get("quote", "")}" - {stage}')

    if quotes:
        return " | ".join(quotes[:4])
    return "Key quotes will be identified during coaching session."


def _extract_risk_factors(analytics: List[Dict]) -> str:
    """Extract risk factors from analytics."""
    risks = []

    for analytic in analytics:
        # From red flags
        for flag in analytic.get("red_flags", []):
            if isinstance(flag, str):
                risks.append(flag)
            elif isinstance(flag, dict):
                risks.append(flag.get("description", str(flag)))

        # From concerns in synthesis
        synthesis = analytic.get("synthesis", "")
        if "concern" in synthesis.lower() or "risk" in synthesis.lower():
            risks.append(f"Note from synthesis: Check interview {analytic.get('stage', '')}")

    if risks:
        return "; ".join(risks[:4])
    return "No major risk factors identified. Discuss during coaching."


# ============================================================================
# Coaching Summary Routes
# ============================================================================

from services.coaching_summary_generator import coaching_summary_generator
from models.coaching_summary import (
    CoachingSummary,
    CoachingSummaryCreate,
    CoachingSummaryResponse
)

# In-memory storage for summaries (replace with DB in production)
_coaching_summaries: Dict[str, CoachingSummary] = {}


class SaveCoachingTranscriptRequest(BaseModel):
    """Request to save coaching transcript and generate summary."""
    candidate_id: str
    transcript_turns: List[Dict[str, str]]
    session_duration_seconds: Optional[int] = None
    offer_base: Optional[int] = None
    offer_equity: Optional[float] = None


@router.post("/coaching/save-summary")
async def save_coaching_summary(request: SaveCoachingTranscriptRequest) -> CoachingSummaryResponse:
    """
    Save coaching transcript and generate a summary.

    Takes the transcript from a coaching session and generates:
    - Offer script (opening, equity explanation, closing)
    - Key reminders
    - Objection responses
    - Strategy recommendations
    """
    logger.info(f"Generating coaching summary for candidate {request.candidate_id}")

    # Get candidate name
    candidate = candidate_repo.get_by_id(request.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate_name = candidate.get("name", "Unknown")

    try:
        # Generate summary
        summary = await coaching_summary_generator.generate(
            candidate_id=request.candidate_id,
            candidate_name=candidate_name,
            transcript_turns=request.transcript_turns,
            session_duration_seconds=request.session_duration_seconds,
            offer_base=request.offer_base,
            offer_equity=request.offer_equity
        )

        # Store summary (in production, save to DB)
        summary.id = f"summary_{request.candidate_id}_{int(summary.created_at.timestamp())}"
        _coaching_summaries[request.candidate_id] = summary

        logger.info(f"Coaching summary generated: {len(summary.key_reminders)} reminders, {len(summary.objection_responses)} objection responses")

        return CoachingSummaryResponse(
            status="success",
            summary=summary
        )

    except Exception as e:
        logger.error(f"Error generating coaching summary: {e}")
        return CoachingSummaryResponse(
            status="failed",
            errors=[str(e)]
        )


@router.get("/coaching/summary/{candidate_id}")
async def get_coaching_summary(candidate_id: str) -> CoachingSummaryResponse:
    """
    Get the coaching summary for a candidate.
    """
    # Check if we have a saved summary
    summary = _coaching_summaries.get(candidate_id)

    if not summary:
        return CoachingSummaryResponse(
            status="not_found",
            errors=["No coaching summary found for this candidate"]
        )

    return CoachingSummaryResponse(
        status="success",
        summary=summary
    )


@router.delete("/coaching/summary/{candidate_id}")
async def delete_coaching_summary(candidate_id: str) -> Dict[str, str]:
    """
    Delete the coaching summary for a candidate.
    """
    if candidate_id in _coaching_summaries:
        del _coaching_summaries[candidate_id]
        return {"status": "deleted", "candidate_id": candidate_id}

    return {"status": "not_found", "candidate_id": candidate_id}
