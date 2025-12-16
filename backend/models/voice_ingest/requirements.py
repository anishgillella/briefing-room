"""
Hard Requirements model.
Non-negotiable job requirements like location, compensation, experience.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional

from .enums import LocationType


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
