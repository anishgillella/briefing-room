"""
Nuance Capture model.
Qualitative insights that don't fit into structured fields.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

from .enums import NuanceCategory


class NuanceCapture(BaseModel):
    """
    Qualitative insights that don't fit into structured fields.

    These are the valuable pieces of context that come out in conversation
    but aren't captured by standard job posting fields.

    Categories:
    - culture_fit: "They want someone scrappy, not corporate"
    - hidden_pref: "Prefers candidates who've built from scratch"
    - red_flag: "Avoid people who need a lot of direction"
    - selling_point: "The CTO mentors everyone directly"
    - team_dynamic: "Small team, everyone wears multiple hats"
    - growth_path: "This could become a VP role in 2 years"
    - urgency: "Need someone in 2 weeks, backfill"
    - other: Anything else valuable
    """

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier"
    )
    category: NuanceCategory = Field(
        ...,
        description="Category of this insight"
    )
    insight: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="The insight in plain language"
    )
    verbatim_quote: Optional[str] = Field(
        None,
        max_length=300,
        description="Exact user words if particularly useful"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="When this insight was captured"
    )

    def is_actionable_for_sourcing(self) -> bool:
        """Check if this nuance affects candidate sourcing"""
        return self.category in [
            NuanceCategory.HIDDEN_PREF,
            NuanceCategory.RED_FLAG,
            NuanceCategory.CULTURE_FIT
        ]

    def is_selling_point(self) -> bool:
        """Check if this should be highlighted to candidates"""
        return self.category == NuanceCategory.SELLING_POINT

    class Config:
        json_schema_extra = {
            "example": {
                "id": "nuance-123",
                "category": "hidden_pref",
                "insight": "Strongly prefers candidates who have built systems from scratch rather than just maintaining existing code",
                "verbatim_quote": "I want someone who's built something from zero, not just added features to existing code",
                "timestamp": "2024-01-15T10:30:00Z"
            }
        }


class NuanceCollection(BaseModel):
    """Collection of nuances with utility methods"""

    nuances: List[NuanceCapture] = Field(default_factory=list)

    def get_by_category(self, category: NuanceCategory) -> List[NuanceCapture]:
        """Get all nuances in a specific category"""
        return [n for n in self.nuances if n.category == category]

    def get_culture_insights(self) -> List[NuanceCapture]:
        """Get all culture-related insights"""
        return self.get_by_category(NuanceCategory.CULTURE_FIT)

    def get_hidden_preferences(self) -> List[NuanceCapture]:
        """Get all hidden preferences"""
        return self.get_by_category(NuanceCategory.HIDDEN_PREF)

    def get_red_flags(self) -> List[NuanceCapture]:
        """Get all red flags to avoid"""
        return self.get_by_category(NuanceCategory.RED_FLAG)

    def get_selling_points(self) -> List[NuanceCapture]:
        """Get all selling points for candidates"""
        return self.get_by_category(NuanceCategory.SELLING_POINT)

    def get_team_dynamics(self) -> List[NuanceCapture]:
        """Get all team dynamic insights"""
        return self.get_by_category(NuanceCategory.TEAM_DYNAMIC)

    def get_growth_paths(self) -> List[NuanceCapture]:
        """Get all career growth insights"""
        return self.get_by_category(NuanceCategory.GROWTH_PATH)

    def get_urgency_notes(self) -> List[NuanceCapture]:
        """Get all urgency-related notes"""
        return self.get_by_category(NuanceCategory.URGENCY)

    def get_sourcing_relevant(self) -> List[NuanceCapture]:
        """Get all nuances relevant for candidate sourcing"""
        return [n for n in self.nuances if n.is_actionable_for_sourcing()]

    def add_nuance(self, nuance: NuanceCapture) -> None:
        """Add a nuance to the collection"""
        self.nuances.append(nuance)

    def format_for_agent_context(self) -> str:
        """Format nuances for inclusion in agent context"""
        if not self.nuances:
            return "No additional context captured yet."

        sections = []

        culture = self.get_culture_insights()
        if culture:
            sections.append("Culture notes: " + "; ".join(n.insight for n in culture))

        hidden = self.get_hidden_preferences()
        if hidden:
            sections.append("Hidden preferences: " + "; ".join(n.insight for n in hidden))

        red_flags = self.get_red_flags()
        if red_flags:
            sections.append("Red flags to avoid: " + "; ".join(n.insight for n in red_flags))

        selling = self.get_selling_points()
        if selling:
            sections.append("Selling points: " + "; ".join(n.insight for n in selling))

        return "\n".join(sections)
