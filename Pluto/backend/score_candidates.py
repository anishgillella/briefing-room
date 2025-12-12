"""
Phase 2: Dual Parallel Scoring System

Scores candidates using:
1. Algorithmic scoring (0-100) - Pure Python logic
2. AI evaluation (0-100) - GPT-4o-mini via OpenRouter

Output: ranked_candidates.json with final rankings

Usage:
    python -m backend.score_candidates
"""

import json
import asyncio
import logging
from typing import List

import pandas as pd
from openai import AsyncOpenAI

from backend.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    RESULT_CSV_PATH,
    RANKED_OUTPUT_PATH,
    SCORING_MODEL,
    BATCH_SIZE,
    MAX_RETRIES,
    validate_config,
)
from backend.models import (
    Evaluation,
    InterviewQuestions,
    ScoredCandidate,
    Prompts,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Initialize OpenRouter client
client = AsyncOpenAI(
    base_url=OPENROUTER_BASE_URL,
    api_key=OPENROUTER_API_KEY,
)


# ============================================================================
# Data Completeness Tracking
# ============================================================================

# REQUIRED fields (critical for the Founding AE role) - from Job Description
REQUIRED_FIELDS = [
    ("years_sales_experience", "Years Experience"),  # "1+ years closing experience"
    ("sold_to_finance", "CFO/Finance Sales"),        # "selling to CFOs, Controllers"
    ("bio_summary", "Bio Summary"),                  # Need profile context
    ("job_title", "Job Title"),                      # Need role context
]

# PREFERRED fields (nice-to-have) - from Job Description
PREFERRED_FIELDS = [
    ("max_acv_mentioned", "Deal Size/ACV"),          # "2+ years" preferred
    ("quota_attainment", "Quota %"),                 # Evidence of success
    ("enterprise_experience", "Enterprise Sales"),   # Preferred qualification
    ("industries", "Industry Background"),           # "fintech, SaaS"
    ("startup_experience", "Startup Experience"),    # "Startup experience"
    ("skills", "Skills/Methodologies"),              # Sales skills
]


def get_missing_fields(candidate: dict) -> tuple[list[str], list[str], int]:
    """
    Check which fields are missing or empty.
    Returns (missing_required, missing_preferred, completeness percentage).
    """
    missing_required = []
    missing_preferred = []
    
    def is_missing(value, field_key: str) -> bool:
        if value is None:
            return True
        if isinstance(value, str) and (value.strip() == "" or value == "[]"):
            return True
        if isinstance(value, (int, float)) and value == 0:
            if field_key in ["years_sales_experience", "max_acv_mentioned", "quota_attainment"]:
                return True
        return False
    
    # Check required fields
    for field_key, field_name in REQUIRED_FIELDS:
        value = candidate.get(field_key)
        if is_missing(value, field_key):
            missing_required.append(field_name)
    
    # Check preferred fields
    for field_key, field_name in PREFERRED_FIELDS:
        value = candidate.get(field_key)
        if is_missing(value, field_key):
            missing_preferred.append(field_name)
    
    # Calculate completeness (required fields weighted 2x)
    total_weight = len(REQUIRED_FIELDS) * 2 + len(PREFERRED_FIELDS)
    present_weight = (len(REQUIRED_FIELDS) - len(missing_required)) * 2 + \
                     (len(PREFERRED_FIELDS) - len(missing_preferred))
    completeness = round((present_weight / total_weight) * 100)
    
    return missing_required, missing_preferred, completeness


# ============================================================================
# Algorithmic Scoring (0-100)
# ============================================================================

def calculate_algo_score(candidate: dict) -> int:
    """
    Calculate algorithmic score based on objective criteria.
    
    Scoring breakdown (max 100):
    - Closing Experience: 30 pts (10 per year, max 3 years)
    - Finance Sales Fit: 25 pts (CRITICAL requirement)
    - Startup/Founder DNA: 20 pts (founder) or 10 pts (startup exp)
    - Deal Size/ACV: 15 pts
    - Enterprise Experience: 10 pts
    - Red flag penalty: -5 per flag
    """
    score = 0
    
    # 1. Closing Experience (max 30 pts)
    years = float(candidate.get("years_sales_experience", 0) or 0)
    score += min(int(years * 10), 30)
    
    # 2. Finance Sales Fit (max 25 pts) - CRITICAL
    if candidate.get("sold_to_finance"):
        score += 25
    
    # 3. Startup/Founder DNA (max 20 pts)
    if candidate.get("is_founder"):
        score += 20
    elif candidate.get("startup_experience"):
        score += 10
    
    # 4. Deal Size/ACV (max 15 pts)
    acv = candidate.get("max_acv_mentioned") or 0
    if acv >= 100000:
        score += 15
    elif acv >= 50000:
        score += 10
    elif acv > 0:
        score += 5
    
    # 5. Enterprise Experience (max 10 pts)
    if candidate.get("enterprise_experience"):
        score += 10
    
    # Penalty for red flags
    red_flag_count = int(candidate.get("red_flag_count", 0) or 0)
    score -= red_flag_count * 5
    
    return max(0, min(score, 100))


# ============================================================================
# AI Evaluation
# ============================================================================

async def evaluate_candidate(candidate: dict) -> tuple[Evaluation, List[str]]:
    """
    Get AI evaluation and interview questions for a candidate.
    Returns (Evaluation, interview_questions).
    """
    prompt = Prompts.evaluation_prompt(candidate)
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            # Get evaluation
            response = await client.chat.completions.create(
                model=SCORING_MODEL,
                messages=[
                    {"role": "system", "content": Prompts.SCORING_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            
            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response")
            
            evaluation = Evaluation.model_validate_json(content)
            
            # Get interview questions
            interview_prompt = Prompts.interview_prompt(
                candidate['name'],
                evaluation.score,
                evaluation.cons
            )
            
            interview_response = await client.chat.completions.create(
                model=SCORING_MODEL,
                messages=[
                    {"role": "system", "content": Prompts.SCORING_SYSTEM},
                    {"role": "user", "content": interview_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.5,
            )
            
            interview_content = interview_response.choices[0].message.content or "{}"
            interview_data = json.loads(interview_content)
            questions = interview_data.get("questions", [])
            
            return evaluation, questions
            
        except Exception as e:
            logger.warning(f"Attempt {attempt + 1} failed for {candidate['name']}: {e}")
            if attempt == MAX_RETRIES:
                return _fallback_evaluation(), []
            await asyncio.sleep(1)
    
    return _fallback_evaluation(), []


def _fallback_evaluation() -> Evaluation:
    """Return fallback evaluation when API fails."""
    return Evaluation(
        score=50,
        one_line_summary="Evaluation incomplete - manual review needed",
        pros=["Profile available for review"],
        cons=["Automated evaluation failed"],
        reasoning="AI evaluation failed after retries. Manual review recommended.",
    )


# ============================================================================
# Scoring Pipeline
# ============================================================================

def calculate_final_score(algo: int, ai: int) -> int:
    """Simple average of both scores."""
    return round((algo + ai) / 2)


def assign_tier(score: int) -> str:
    """Assign tier based on final score."""
    if score >= 80:
        return "🔥 Top Match"
    elif score >= 65:
        return "✅ Strong Fit"
    elif score >= 50:
        return "⚠️ Consider"
    else:
        return "❌ Not a Fit"


async def process_batch(batch: List[dict]) -> List[ScoredCandidate]:
    """Process a batch of candidates concurrently."""
    tasks = [evaluate_candidate(c) for c in batch]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    scored_candidates = []
    for candidate, result in zip(batch, results):
        if isinstance(result, Exception):
            logger.error(f"Scoring failed: {candidate['name']}: {result}")
            evaluation, questions = _fallback_evaluation(), []
        else:
            evaluation, questions = result
        
        algo_score = calculate_algo_score(candidate)
        final_score = calculate_final_score(algo_score, evaluation.score)
        
        # Handle NaN values for optional fields
        max_acv = candidate.get("max_acv_mentioned")
        if pd.isna(max_acv):
            max_acv = None
        else:
            max_acv = int(max_acv) if max_acv else None
            
        quota = candidate.get("quota_attainment")
        if pd.isna(quota):
            quota = None
        else:
            quota = float(quota) if quota else None
        
        # Track missing fields
        missing_required, missing_preferred, data_completeness = get_missing_fields(candidate)
        
        scored = ScoredCandidate(
            rank=0,
            tier=assign_tier(final_score),
            algo_score=algo_score,
            ai_score=evaluation.score,
            final_score=final_score,
            one_line_summary=evaluation.one_line_summary,
            pros=evaluation.pros,
            cons=evaluation.cons,
            reasoning=evaluation.reasoning,
            interview_questions=questions,
            id=str(candidate.get("id", "")),
            name=str(candidate.get("name", "")),
            job_title=str(candidate.get("job_title", "")),
            location_city=str(candidate.get("location_city", "")),
            location_state=str(candidate.get("location_state", "")),
            years_sales_experience=float(candidate.get("years_sales_experience", 0) or 0),
            bio_summary=str(candidate.get("bio_summary", "")),
            industries=str(candidate.get("industries", "")),
            skills=str(candidate.get("skills", "")),
            sold_to_finance=bool(candidate.get("sold_to_finance")),
            is_founder=bool(candidate.get("is_founder")),
            startup_experience=bool(candidate.get("startup_experience")),
            enterprise_experience=bool(candidate.get("enterprise_experience")),
            max_acv_mentioned=max_acv,
            quota_attainment=quota,
            red_flag_count=int(candidate.get("red_flag_count", 0) or 0),
            red_flag_concerns=str(candidate.get("red_flag_concerns", "") or ""),
            missing_required=missing_required,
            missing_preferred=missing_preferred,
            data_completeness=data_completeness,
        )
        scored_candidates.append(scored)
    
    return scored_candidates
