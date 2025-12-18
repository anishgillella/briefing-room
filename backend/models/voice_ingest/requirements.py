"""
Hard Requirements model.
Non-negotiable job requirements like location, compensation, experience.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

from .enums import LocationType, HiringUrgency, TeamSeniority


class HardRequirements(BaseModel):
    """
    Non-negotiable job requirements.

    These are the "deal-breaker" requirements that filter candidates
    before any qualitative evaluation happens.
    """

    # Role basics
    job_title: str = Field("", description="Job title, e.g., 'Senior Backend Engineer'")

    # Location
    location_type: Optional[LocationType] = Field(
        None,
        description="Work location type: onsite, hybrid, or remote"
    )
    location_city: Optional[str] = Field(
        None,
        description="City name if onsite/hybrid, e.g., 'San Francisco'"
    )
    onsite_days_per_week: Optional[int] = Field(
        None,
        ge=0,
        le=5,
        description="Days per week in office for hybrid roles"
    )
    timezone_requirements: Optional[str] = Field(
        None,
        description="Timezone constraints, e.g., 'PST hours required'"
    )

    # Work authorization
    visa_sponsorship: Optional[bool] = Field(
        None,
        description="Whether visa sponsorship is available"
    )
    work_authorization_notes: Optional[str] = Field(
        None,
        description="Additional notes about work authorization"
    )

    # Experience
    experience_min_years: Optional[int] = Field(
        None,
        ge=0,
        description="Minimum years of experience required"
    )
    experience_max_years: Optional[int] = Field(
        None,
        ge=0,
        description="Maximum years of experience (optional ceiling)"
    )

    # Compensation
    salary_min: Optional[int] = Field(
        None,
        description="Minimum salary in USD (annual)"
    )
    salary_max: Optional[int] = Field(
        None,
        description="Maximum salary in USD (annual)"
    )
    salary_currency: str = Field(
        "USD",
        description="Salary currency code"
    )
    equity_offered: Optional[bool] = Field(
        None,
        description="Whether equity is offered"
    )
    equity_range: Optional[str] = Field(
        None,
        description="Equity range, e.g., '0.1-0.25%'"
    )
    bonus_structure: Optional[str] = Field(
        None,
        description="Bonus structure description"
    )

    # Team Context
    team_size: Optional[int] = Field(
        None,
        ge=1,
        description="Size of the immediate team they'll join"
    )
    team_composition: Optional[str] = Field(
        None,
        description="Team makeup, e.g., '3 seniors, 2 mid-level, 1 junior'"
    )
    team_seniority: Optional[TeamSeniority] = Field(
        None,
        description="Overall seniority level of the team"
    )
    reporting_to: Optional[str] = Field(
        None,
        description="Who this role reports to, e.g., 'VP of Engineering'"
    )
    direct_reports: Optional[int] = Field(
        None,
        ge=0,
        description="Number of direct reports if a management role"
    )

    # Role Context
    hiring_urgency: Optional[HiringUrgency] = Field(
        None,
        description="How urgently the role needs to be filled"
    )
    backfill_reason: Optional[str] = Field(
        None,
        description="If backfill, why the previous person left"
    )
    success_metrics_30_day: Optional[str] = Field(
        None,
        description="What success looks like in first 30 days"
    )
    success_metrics_90_day: Optional[str] = Field(
        None,
        description="What success looks like in first 90 days"
    )
    growth_path: Optional[str] = Field(
        None,
        description="Where this role could lead in 1-2 years"
    )

    # Deal Breakers & Preferences
    deal_breakers: List[str] = Field(
        default_factory=list,
        description="Explicit disqualifiers, e.g., 'No job hoppers', 'Must have startup experience'"
    )
    ideal_background: Optional[str] = Field(
        None,
        description="Dream candidate background, e.g., 'Ex-Stripe, Ex-Plaid fintech engineers'"
    )
    interview_turnaround: Optional[str] = Field(
        None,
        description="How fast they can move, e.g., 'Can do full loop in 1 week'"
    )

    @field_validator("experience_max_years")
    @classmethod
    def max_must_be_gte_min(cls, v, info):
        """Ensure max experience is greater than or equal to min"""
        if v is not None and info.data.get("experience_min_years") is not None:
            if v < info.data["experience_min_years"]:
                raise ValueError("experience_max_years must be >= experience_min_years")
        return v

    @field_validator("salary_max")
    @classmethod
    def salary_max_must_be_gte_min(cls, v, info):
        """Ensure max salary is greater than or equal to min"""
        if v is not None and info.data.get("salary_min") is not None:
            if v < info.data["salary_min"]:
                raise ValueError("salary_max must be >= salary_min")
        return v

    def format_location(self) -> str:
        """Format location for display"""
        if not self.location_type:
            return "Not specified"

        loc = self.location_type.value.title()
        if self.location_city:
            loc = f"{self.location_city} ({loc})"
        if self.onsite_days_per_week and self.location_type == LocationType.HYBRID:
            loc += f" - {self.onsite_days_per_week}d/week in office"
        return loc

    def format_experience(self) -> str:
        """Format experience range for display"""
        if self.experience_min_years is None:
            return "Not specified"

        if self.experience_max_years:
            return f"{self.experience_min_years}-{self.experience_max_years} years"
        return f"{self.experience_min_years}+ years"

    def format_experience_spoken(self) -> str:
        """Format experience range for TTS/voice output"""
        if self.experience_min_years is None:
            return "Not specified"

        if self.experience_max_years:
            return f"{self.experience_min_years} to {self.experience_max_years} years"
        return f"{self.experience_min_years} plus years"

    def format_compensation(self) -> str:
        """Format compensation for display"""
        if self.salary_min is None:
            return "Not specified"

        min_k = self.salary_min // 1000
        max_k = (self.salary_max or self.salary_min) // 1000

        comp = f"${min_k}k - ${max_k}k"
        if self.equity_range:
            comp += f" + {self.equity_range} equity"
        elif self.equity_offered:
            comp += " + equity"
        return comp

    def format_compensation_spoken(self) -> str:
        """Format compensation for TTS/voice output"""
        if self.salary_min is None:
            return "Not specified"

        min_k = self.salary_min // 1000
        max_k = (self.salary_max or self.salary_min) // 1000

        if min_k == max_k:
            comp = f"{min_k} thousand dollars"
        else:
            comp = f"{min_k} to {max_k} thousand dollars"

        if self.equity_range:
            # Convert "0.1-0.25%" to spoken form
            equity_spoken = self.equity_range.replace("-", " to ").replace("%", " percent")
            comp += f" plus {equity_spoken} equity"
        elif self.equity_offered:
            comp += " plus equity"
        return comp

    class Config:
        json_schema_extra = {
            "example": {
                "job_title": "Senior Backend Engineer",
                "location_type": "hybrid",
                "location_city": "San Francisco",
                "onsite_days_per_week": 3,
                "visa_sponsorship": True,
                "experience_min_years": 5,
                "experience_max_years": 10,
                "salary_min": 150000,
                "salary_max": 200000,
                "equity_offered": True,
                "equity_range": "0.1-0.25%"
            }
        }
