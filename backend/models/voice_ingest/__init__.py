"""
Voice Ingest Models

Pydantic models for the voice-based job profile onboarding flow.
These models support structured extraction from JD paste, voice conversation,
and Parallel.ai company research.
"""

from .enums import (
    FundingStage,
    LocationType,
    TraitPriority,
    NuanceCategory,
    OutreachTone,
    ExtractionSource,
)
from .company import CompanyIntelligence
from .requirements import HardRequirements
from .traits import CandidateTrait
from .interview import InterviewStage
from .nuance import NuanceCapture
from .outreach import OutreachConfig
from .profile import JobProfile, FieldConfidence
from .context import ConversationContext, SmartQuestion

__all__ = [
    # Enums
    "FundingStage",
    "LocationType",
    "TraitPriority",
    "NuanceCategory",
    "OutreachTone",
    "ExtractionSource",
    # Models
    "CompanyIntelligence",
    "HardRequirements",
    "CandidateTrait",
    "InterviewStage",
    "NuanceCapture",
    "OutreachConfig",
    "JobProfile",
    "FieldConfidence",
    "ConversationContext",
    "SmartQuestion",
]
