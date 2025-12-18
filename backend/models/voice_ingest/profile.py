"""
Job Profile model.
The complete output of voice ingest - everything needed to hire for a role.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

from .enums import ExtractionSource
from .company import CompanyIntelligence
from .requirements import HardRequirements
from .traits import CandidateTrait
from .interview import InterviewStage
from .nuance import NuanceCapture
from .outreach import OutreachConfig


class FieldConfidence(BaseModel):
    """Confidence score for an extracted field"""

    field_name: str = Field(..., description="Name of the field")
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score from 0.0 to 1.0"
    )
    source: ExtractionSource = Field(
        ...,
        description="Where this data was extracted from"
    )
    needs_confirmation: bool = Field(
        False,
        description="Whether this field should be confirmed with user"
    )

    @classmethod
    def high_confidence(cls, field_name: str, source: ExtractionSource) -> "FieldConfidence":
        """Create a high confidence field (explicitly stated)"""
        return cls(
            field_name=field_name,
            confidence=1.0,
            source=source,
            needs_confirmation=False
        )

    @classmethod
    def medium_confidence(cls, field_name: str, source: ExtractionSource) -> "FieldConfidence":
        """Create a medium confidence field (clearly implied)"""
        return cls(
            field_name=field_name,
            confidence=0.7,
            source=source,
            needs_confirmation=True
        )

    @classmethod
    def low_confidence(cls, field_name: str, source: ExtractionSource) -> "FieldConfidence":
        """Create a low confidence field (inferred/guessed)"""
        return cls(
            field_name=field_name,
            confidence=0.4,
            source=source,
            needs_confirmation=True
        )


class JobProfile(BaseModel):
    """
    Complete job profile - the output of voice ingest.

    This model represents everything we know about a job and the
    ideal candidate. It's the bridge between voice onboarding
    and the existing Briefing Room candidate flow.
    """

    # Identity
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When the profile was created"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When the profile was last updated"
    )

    # User info
    recruiter_first_name: str = Field(..., description="Recruiter's first name")
    recruiter_last_name: str = Field(..., description="Recruiter's last name")

    # Company (enriched by Parallel.ai)
    company: CompanyIntelligence = Field(
        ...,
        description="Company information"
    )

    # Structured requirements
    requirements: HardRequirements = Field(
        default_factory=HardRequirements,
        description="Hard job requirements"
    )

    # Candidate profile
    traits: List[CandidateTrait] = Field(
        default_factory=list,
        description="Candidate traits to evaluate"
    )

    # Interview process
    interview_stages: List[InterviewStage] = Field(
        default_factory=list,
        description="Interview stages"
    )

    # Qualitative insights
    nuances: List[NuanceCapture] = Field(
        default_factory=list,
        description="Qualitative insights from conversation"
    )

    # Outreach
    outreach: OutreachConfig = Field(
        default_factory=OutreachConfig,
        description="Email outreach configuration"
    )

    # Metadata
    extraction_source: ExtractionSource = Field(
        ExtractionSource.CONVERSATION,
        description="Primary source of data"
    )
    field_confidence: List[FieldConfidence] = Field(
        default_factory=list,
        description="Confidence scores for extracted fields"
    )

    # Status
    is_complete: bool = Field(
        False,
        description="Whether all required fields are filled"
    )
    missing_required_fields: List[str] = Field(
        default_factory=list,
        description="List of missing required fields"
    )

    # Research status
    parallel_research_status: str = Field(
        "pending",
        description="Status of Parallel.ai research: pending, in_progress, complete, failed"
    )

    # Skipped fields (user chose to skip these)
    skipped_fields: List[str] = Field(
        default_factory=list,
        description="Fields the user explicitly skipped during onboarding"
    )

    def get_missing_fields(self) -> List[str]:
        """Calculate which required fields are still missing"""
        missing = []

        # Phase 1: Role Basics (Hard Requirements)
        if not self.requirements.job_title:
            missing.append("job_title")
        if self.requirements.location_type is None:
            missing.append("location_type")
        if self.requirements.experience_min_years is None:
            missing.append("experience_min_years")
        if self.requirements.salary_min is None:
            missing.append("compensation")
        if self.requirements.visa_sponsorship is None:
            missing.append("visa_sponsorship")
        if self.requirements.equity_offered is None:
            missing.append("equity")

        # Phase 2: Team Context
        if self.requirements.team_size is None and self.requirements.reporting_to is None:
            missing.append("team_context")

        # Phase 3: Candidate Traits - Must have at least one trait
        if len(self.traits) == 0:
            missing.append("traits")

        # Phase 4: Interview Process - Must have at least one interview stage
        if len(self.interview_stages) == 0:
            missing.append("interview_stages")

        # Phase 5: Deeper Context (role_context)
        # At least one of: hiring_urgency, success_metrics, deal_breakers, or ideal_background
        has_role_context = (
            self.requirements.hiring_urgency is not None or
            self.requirements.success_metrics_30_day or
            self.requirements.success_metrics_90_day or
            len(self.requirements.deal_breakers) > 0 or
            self.requirements.ideal_background
        )
        if not has_role_context:
            missing.append("role_context")

        return missing

    def calculate_completion_percentage(self) -> float:
        """Calculate overall profile completion percentage"""
        # Total required fields (10 total across all phases)
        required_fields = [
            # Phase 1: Role Basics
            "job_title",
            "location_type",
            "experience_min_years",
            "compensation",
            "visa_sponsorship",
            "equity",
            # Phase 2: Team Context
            "team_context",
            # Phase 3: Traits
            "traits",
            # Phase 4: Interview Process
            "interview_stages",
            # Phase 5: Deeper Context
            "role_context"
        ]

        missing = self.get_missing_fields()
        completed = len(required_fields) - len(missing)

        return round((completed / len(required_fields)) * 100, 1)

    def update_completion_status(self) -> None:
        """Update the is_complete and missing_required_fields properties"""
        self.missing_required_fields = self.get_missing_fields()
        self.is_complete = len(self.missing_required_fields) == 0
        self.updated_at = datetime.utcnow()

    def get_must_have_traits(self) -> List[CandidateTrait]:
        """Get all must-have traits"""
        from .enums import TraitPriority
        return [t for t in self.traits if t.priority == TraitPriority.MUST_HAVE]

    def get_nice_to_have_traits(self) -> List[CandidateTrait]:
        """Get all nice-to-have traits"""
        from .enums import TraitPriority
        return [t for t in self.traits if t.priority == TraitPriority.NICE_TO_HAVE]

    def get_ordered_interview_stages(self) -> List[InterviewStage]:
        """Get interview stages in order"""
        return sorted(self.interview_stages, key=lambda s: s.order)

    def get_confidence_for_field(self, field_name: str) -> Optional[float]:
        """Get confidence score for a specific field"""
        for fc in self.field_confidence:
            if fc.field_name == field_name:
                return fc.confidence
        return None

    def get_fields_needing_confirmation(self) -> List[str]:
        """Get fields that need user confirmation"""
        return [fc.field_name for fc in self.field_confidence if fc.needs_confirmation]

    def add_trait(self, trait: CandidateTrait) -> None:
        """Add a trait to the profile"""
        self.traits.append(trait)
        self.update_completion_status()

    def remove_trait(self, trait_identifier: str) -> bool:
        """Remove a trait by ID or name"""
        for i, trait in enumerate(self.traits):
            # Match by ID first, then by name
            if trait.id == trait_identifier or trait.name.lower() == trait_identifier.lower():
                self.traits.pop(i)
                self.update_completion_status()
                return True
        return False

    def add_interview_stage(self, stage: InterviewStage) -> None:
        """Add an interview stage"""
        # Auto-assign order
        if stage.order is None or stage.order == 0:
            stage.order = len(self.interview_stages) + 1
        self.interview_stages.append(stage)
        self.update_completion_status()

    def remove_interview_stage(self, stage_identifier: str) -> bool:
        """Remove an interview stage by ID or name"""
        for i, stage in enumerate(self.interview_stages):
            # Match by ID first, then by name
            if stage.id == stage_identifier or stage.name.lower() == stage_identifier.lower():
                self.interview_stages.pop(i)
                # Reorder remaining stages
                for j, remaining in enumerate(self.get_ordered_interview_stages()):
                    remaining.order = j + 1
                self.update_completion_status()
                return True
        return False

    def reorder_interview_stages(self, ordered_names: list[str]) -> bool:
        """Reorder interview stages based on a list of stage names in desired order"""
        if not ordered_names:
            return False

        # Build a map of stage names (case-insensitive) to stages
        stage_map = {s.name.lower(): s for s in self.interview_stages}

        # Create new ordered list
        new_order = []
        for i, name in enumerate(ordered_names):
            stage = stage_map.get(name.lower())
            if stage:
                stage.order = i + 1
                new_order.append(stage)
                del stage_map[name.lower()]

        # Append any remaining stages that weren't in the ordered list
        for stage in stage_map.values():
            stage.order = len(new_order) + 1
            new_order.append(stage)

        self.interview_stages = new_order
        self.update_completion_status()
        return True

    def add_nuance(self, nuance: NuanceCapture) -> None:
        """Add a nuance to the profile"""
        self.nuances.append(nuance)
        self.updated_at = datetime.utcnow()

    def to_job_description(self) -> str:
        """Generate human-readable job description from profile"""
        sections = []

        # Title
        title = self.requirements.job_title or "Untitled Role"
        sections.append(f"# {title} at {self.company.name}")

        # Company overview
        if self.company.product_description:
            sections.append(f"\n## About {self.company.name}")
            sections.append(self.company.product_description)
            if self.company.problem_solved:
                sections.append(f"\n{self.company.problem_solved}")

        # Role details
        sections.append("\n## The Role")
        role_details = []

        if self.requirements.location_type:
            role_details.append(f"- **Location:** {self.requirements.format_location()}")

        if self.requirements.experience_min_years is not None:
            role_details.append(f"- **Experience:** {self.requirements.format_experience()}")

        if self.requirements.salary_min:
            role_details.append(f"- **Compensation:** {self.requirements.format_compensation()}")

        if self.requirements.visa_sponsorship is not None:
            visa = "Available" if self.requirements.visa_sponsorship else "Not available"
            role_details.append(f"- **Visa Sponsorship:** {visa}")

        if role_details:
            sections.append("\n".join(role_details))

        # Traits
        if self.traits:
            sections.append("\n## What We're Looking For")

            must_haves = self.get_must_have_traits()
            nice_to_haves = self.get_nice_to_have_traits()

            if must_haves:
                sections.append("\n### Must Have")
                for trait in must_haves:
                    sections.append(f"- **{trait.name}:** {trait.description}")

            if nice_to_haves:
                sections.append("\n### Nice to Have")
                for trait in nice_to_haves:
                    sections.append(f"- **{trait.name}:** {trait.description}")

        # Interview process
        if self.interview_stages:
            sections.append("\n## Interview Process")
            for stage in self.get_ordered_interview_stages():
                sections.append(f"{stage.order}. **{stage.name}** - {stage.description}")

        return "\n".join(sections)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        json_schema_extra = {
            "example": {
                "id": "profile-123",
                "recruiter_first_name": "Sarah",
                "recruiter_last_name": "Chen",
                "company": {
                    "name": "Acme Inc",
                    "website": "https://acme.dev"
                },
                "requirements": {
                    "job_title": "Senior Backend Engineer",
                    "location_type": "hybrid",
                    "location_city": "San Francisco",
                    "experience_min_years": 5,
                    "salary_min": 150000,
                    "salary_max": 200000,
                    "equity_offered": True
                },
                "traits": [
                    {
                        "name": "Distributed Systems",
                        "description": "Experience with large-scale distributed systems",
                        "priority": "must_have"
                    }
                ],
                "interview_stages": [
                    {
                        "name": "Phone Screen",
                        "description": "Initial recruiter call",
                        "order": 1
                    }
                ],
                "is_complete": False
            }
        }
