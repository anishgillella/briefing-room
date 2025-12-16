"""
Enums for Voice Ingest models.
Centralized enum definitions used across all voice ingest models.
"""

from enum import Enum


class FundingStage(str, Enum):
    """Company funding stage"""
    PRE_SEED = "pre_seed"
    SEED = "seed"
    SERIES_A = "series_a"
    SERIES_B = "series_b"
    SERIES_C = "series_c"
    SERIES_D_PLUS = "series_d_plus"
    PUBLIC = "public"
    BOOTSTRAPPED = "bootstrapped"
    UNKNOWN = "unknown"


class LocationType(str, Enum):
    """Work location type"""
    ONSITE = "onsite"
    HYBRID = "hybrid"
    REMOTE = "remote"


class TraitPriority(str, Enum):
    """Priority level for candidate traits"""
    MUST_HAVE = "must_have"
    NICE_TO_HAVE = "nice_to_have"


class NuanceCategory(str, Enum):
    """Categories for qualitative nuance capture"""
    CULTURE_FIT = "culture_fit"          # "They want someone scrappy, not corporate"
    HIDDEN_PREF = "hidden_pref"          # "Prefers candidates who've built from scratch"
    RED_FLAG = "red_flag"                # "Avoid people who need a lot of direction"
    SELLING_POINT = "selling_point"      # "The CTO mentors everyone directly"
    TEAM_DYNAMIC = "team_dynamic"        # "Small team, everyone wears multiple hats"
    GROWTH_PATH = "growth_path"          # "This could become a VP role in 2 years"
    URGENCY = "urgency"                  # "Need someone in 2 weeks, backfill"
    OTHER = "other"


class OutreachTone(str, Enum):
    """Tone for outreach emails"""
    FORMAL = "formal"
    CASUAL = "casual"
    DIRECT = "direct"
    ENTHUSIASTIC = "enthusiastic"


class ExtractionSource(str, Enum):
    """Source of extracted data"""
    JD_PASTE = "jd_paste"
    CONVERSATION = "conversation"
    MIXED = "mixed"
    PARALLEL_AI = "parallel_ai"
