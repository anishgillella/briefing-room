"""
Compensation data models for market research.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CompensationData(BaseModel):
    """Market compensation data for a role."""

    # Role context
    role_title: str
    location: str
    company_stage: Optional[str] = None  # e.g., "Series B", "Public"
    industry: Optional[str] = None

    # Salary range
    salary_min: Optional[int] = None
    salary_median: Optional[int] = None
    salary_max: Optional[int] = None
    salary_percentile_25: Optional[int] = None
    salary_percentile_75: Optional[int] = None
    salary_currency: str = "USD"

    # Equity benchmarks
    equity_min_percent: Optional[float] = None
    equity_max_percent: Optional[float] = None
    equity_typical_percent: Optional[float] = None
    vesting_standard: Optional[str] = None  # e.g., "4 years with 1 year cliff"

    # Bonus/other comp
    bonus_target_percent: Optional[float] = None
    signing_bonus_range: Optional[str] = None

    # Market context
    market_trend: Optional[str] = None  # "rising", "stable", "declining"
    talent_availability: Optional[str] = None  # "scarce", "competitive", "abundant"

    # Data quality
    data_sources: List[str] = Field(default_factory=list)
    confidence_level: Optional[str] = None  # "high", "medium", "low"
    sample_size_estimate: Optional[str] = None

    # Metadata
    retrieved_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class CompensationComparison(BaseModel):
    """Comparison of an offer against market data."""

    # Offer details
    offered_base: int
    offered_equity_percent: Optional[float] = None
    offered_bonus_percent: Optional[float] = None

    # Market data
    market_data: CompensationData

    # Analysis
    base_percentile: Optional[int] = None  # 0-100
    equity_assessment: Optional[str] = None  # "below", "at", "above" market
    total_comp_assessment: Optional[str] = None

    # Recommendations
    competitive_base_range: Optional[str] = None  # e.g., "$180K - $200K"
    room_to_negotiate: Optional[int] = None  # How much more could reasonably be offered
    negotiation_risk: Optional[str] = None  # "low", "medium", "high"


class CompensationResearchRequest(BaseModel):
    """Request for compensation research."""
    role_title: str
    location: str
    company_stage: Optional[str] = None
    years_experience: Optional[int] = None
    industry: Optional[str] = None
    specific_company: Optional[str] = None  # If researching a specific company's pay


class CompensationResearchResponse(BaseModel):
    """Response from compensation research."""
    status: str  # "success", "partial", "failed"
    data: Optional[CompensationData] = None
    raw_search_results: Optional[List[dict]] = None
    errors: List[str] = Field(default_factory=list)
