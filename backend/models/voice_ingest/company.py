"""
Company Intelligence model.
Structured extraction from Parallel.ai web search results.
"""

from pydantic import BaseModel, Field
from typing import Optional, List

from .enums import FundingStage


class CompanyIntelligence(BaseModel):
    """
    Structured company information extracted from Parallel.ai web search.

    This model captures everything we can learn about a company before
    the voice conversation starts, making the agent sound informed.
    """

    # Basic Info
    name: str = Field(..., description="Company name")
    website: str = Field(..., description="Company website URL")
    tagline: Optional[str] = Field(None, description="One-liner from website")

    # Funding & Stage
    funding_stage: Optional[FundingStage] = Field(None, description="Current funding stage")
    total_raised: Optional[str] = Field(None, description="Total funding raised, e.g., '$25M'")
    last_round_date: Optional[str] = Field(None, description="Date of last funding round")
    investors: List[str] = Field(default_factory=list, description="List of investors")

    # Product & Market
    product_description: Optional[str] = Field(
        None,
        description="What they build (1-2 sentences)"
    )
    problem_solved: Optional[str] = Field(
        None,
        description="Why it matters (1 sentence)"
    )
    target_customers: Optional[str] = Field(
        None,
        description="Who buys their product"
    )
    industry: Optional[str] = Field(
        None,
        description="Industry category, e.g., 'Dev tools', 'Fintech'"
    )

    # Team & Culture
    founders: List[str] = Field(default_factory=list, description="Founder names")
    founder_backgrounds: Optional[str] = Field(
        None,
        description="Notable backgrounds, e.g., 'Ex-Google, Ex-Stripe'"
    )
    team_size: Optional[str] = Field(
        None,
        description="Team size estimate, e.g., '50-100'"
    )
    headquarters: Optional[str] = Field(
        None,
        description="HQ location, e.g., 'San Francisco, CA'"
    )
    office_locations: List[str] = Field(
        default_factory=list,
        description="List of office locations"
    )

    # Competitive Landscape
    competitors: List[str] = Field(
        default_factory=list,
        description="Known competitors"
    )
    differentiators: Optional[str] = Field(
        None,
        description="What makes them unique"
    )

    # Recent News & Signals
    recent_news: List[str] = Field(
        default_factory=list,
        description="Recent headlines (max 3)"
    )
    hiring_signals: Optional[str] = Field(
        None,
        description="Hiring activity signals, e.g., 'Hiring aggressively'"
    )
    tech_stack_hints: List[str] = Field(
        default_factory=list,
        description="Technologies mentioned in job posts or engineering blog"
    )

    # Culture Signals
    culture_keywords: List[str] = Field(
        default_factory=list,
        description="Culture indicators, e.g., 'Remote-first', 'Move fast'"
    )
    glassdoor_sentiment: Optional[str] = Field(
        None,
        description="Overall sentiment, e.g., 'Positive', 'Mixed'"
    )

    # Conversation Hooks (for agent)
    interesting_facts: List[str] = Field(
        default_factory=list,
        description="Interesting facts the agent can reference in conversation"
    )
    potential_selling_points: List[str] = Field(
        default_factory=list,
        description="Reasons candidates would want to work here"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Acme Inc",
                "website": "https://acme.dev",
                "tagline": "Observability for distributed systems",
                "funding_stage": "series_b",
                "total_raised": "$45M",
                "investors": ["Sequoia", "Index Ventures"],
                "product_description": "Real-time monitoring and debugging platform for microservices",
                "team_size": "80-100",
                "headquarters": "San Francisco",
                "tech_stack_hints": ["Kafka", "Rust", "Kubernetes"],
                "competitors": ["Datadog", "Honeycomb"],
                "interesting_facts": ["Founded by ex-Google SREs", "Open source core"],
                "potential_selling_points": ["Well-funded", "Technical founders", "Interesting problems"]
            }
        }
