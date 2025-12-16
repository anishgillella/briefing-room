"""
Smart Question Generator service.
Generates contextual questions for the voice agent based on company intelligence
and missing fields.
"""
from typing import List, Optional, Dict

from models.voice_ingest import CompanyIntelligence
from models.voice_ingest.context import SmartQuestion


def generate_smart_questions(
    company: Optional[CompanyIntelligence],
    missing_fields: List[str],
    confidence_scores: Optional[Dict[str, float]] = None
) -> List[SmartQuestion]:
    """
    Generate contextual questions based on company intelligence and gaps.

    Args:
        company: Company intelligence from Parallel.ai
        missing_fields: List of required fields still missing
        confidence_scores: Optional confidence scores for low-confidence fields

    Returns:
        List of SmartQuestion objects for the voice agent
    """
    questions = []

    # Add questions for missing required fields
    questions.extend(
        _generate_required_field_questions(missing_fields, company)
    )

    # Add context-aware questions based on company research
    if company:
        questions.extend(
            _generate_company_context_questions(company, missing_fields)
        )

    # Add questions for low-confidence fields
    if confidence_scores:
        questions.extend(
            _generate_confirmation_questions(confidence_scores, company)
        )

    # Sort by priority and limit
    questions.sort(key=lambda q: q.priority)
    return questions[:10]  # Limit to 10 questions


def _generate_required_field_questions(
    missing_fields: List[str],
    company: Optional[CompanyIntelligence]
) -> List[SmartQuestion]:
    """Generate questions for required missing fields."""
    questions = []

    # Question templates with context awareness
    templates = {
        "job_title": SmartQuestion(
            field="job_title",
            question="What's the exact title for this role?",
            why="Required for job posting and candidate search",
            priority=1
        ),
        "location_type": SmartQuestion(
            field="location_type",
            question="Is this role onsite, hybrid, or fully remote?",
            why="Location flexibility is a top candidate filter",
            priority=1
        ),
        "experience_min_years": SmartQuestion(
            field="experience_min_years",
            question="What's the minimum years of experience you're looking for?",
            why="Experience level sets candidate expectations",
            priority=1
        ),
        "compensation": SmartQuestion(
            field="compensation",
            question="What's the compensation range for this role?",
            why="Comp is required for candidate conversations",
            priority=1
        ),
        "visa_sponsorship": SmartQuestion(
            field="visa_sponsorship",
            question="Do you sponsor work visas for this role?",
            why="Visa policy affects candidate pool significantly",
            priority=1
        ),
        "equity": SmartQuestion(
            field="equity",
            question="Is equity part of the compensation? If so, what range?",
            why="Equity expectations vary widely by candidate",
            priority=1
        ),
        "traits": SmartQuestion(
            field="traits",
            question="What are the key skills and traits you're looking for? What would make someone exceptional in this role?",
            why="Traits are the core of candidate evaluation",
            priority=1
        ),
        "interview_stages": SmartQuestion(
            field="interview_stages",
            question="What does your interview process look like? Walk me through the stages.",
            why="Interview process helps set candidate expectations",
            priority=2
        ),
    }

    for field in missing_fields:
        if field in templates:
            question = templates[field]

            # Enhance with company context
            if company:
                question = _enhance_question_with_context(question, company)

            questions.append(question)

    return questions


def _enhance_question_with_context(
    question: SmartQuestion,
    company: CompanyIntelligence
) -> SmartQuestion:
    """Enhance a question with company-specific context."""

    # Location question enhancement
    if question.field == "location_type":
        if company.office_locations:
            locations = ", ".join(company.office_locations[:2])
            question.question = f"I see you have offices in {locations}. Is this role tied to a location, or remote-friendly?"

    # Compensation question enhancement
    if question.field == "compensation":
        if company.funding_stage:
            stage = company.funding_stage.value.replace("_", " ").title()
            question.question = f"For a {stage} company in this space, what's the compensation range? And is there equity on top?"

    # Traits question enhancement
    if question.field == "traits":
        if company.tech_stack_hints:
            tech = ", ".join(company.tech_stack_hints[:3])
            question.question = f"I noticed you use {tech}. Is experience with these required, or what skills matter most for this role?"

    return question


def _generate_company_context_questions(
    company: CompanyIntelligence,
    missing_fields: List[str]
) -> List[SmartQuestion]:
    """Generate additional questions based on company context."""
    questions = []

    # Stage-based questions
    if company.funding_stage:
        stage = company.funding_stage.value

        if stage in ["seed", "series_a"]:
            questions.append(SmartQuestion(
                field="role_scope",
                question="At this stage, roles often evolve fast. Is this a well-defined position or someone who'll shape their own scope?",
                why="Early stage = ambiguity, good to surface expectations",
                priority=2
            ))

        if stage in ["series_b", "series_c", "series_d_plus"]:
            questions.append(SmartQuestion(
                field="team_structure",
                question="With the company's growth, what's the team structure? Who would this person work with day-to-day?",
                why="Growth stage = team complexity questions",
                priority=2
            ))

    # Competitor-based questions
    if company.competitors:
        competitor = company.competitors[0]
        questions.append(SmartQuestion(
            field="competitor_hires",
            question=f"Would someone from {competitor} or similar companies be a good fit, or are you looking for different backgrounds?",
            why="Surfaces hidden preferences about candidate sources",
            priority=3
        ))

    # Remote/culture questions
    if "remote" in [k.lower() for k in company.culture_keywords]:
        questions.append(SmartQuestion(
            field="remote_collaboration",
            question="I see you're remote-friendly. Any timezone constraints or async work expectations?",
            why="Remote nuance matters for candidate fit",
            priority=3
        ))

    # Growth trajectory question
    if company.recent_news:
        questions.append(SmartQuestion(
            field="role_growth",
            question="With the company's recent growth, where could this role go in a year? Could it turn into a lead position?",
            why="Growth trajectory helps attract ambitious candidates",
            priority=3
        ))

    # Tech stack depth question
    if company.tech_stack_hints and len(company.tech_stack_hints) > 2:
        questions.append(SmartQuestion(
            field="tech_flexibility",
            question="For the tech stack, do you need deep expertise in specific tools, or are you open to strong engineers who can learn?",
            why="Distinguishes must-have vs learnable skills",
            priority=2
        ))

    return questions


def _generate_confirmation_questions(
    confidence_scores: Dict[str, float],
    company: Optional[CompanyIntelligence]
) -> List[SmartQuestion]:
    """Generate questions to confirm low-confidence extractions."""
    questions = []

    low_confidence_fields = [
        (field, score) for field, score in confidence_scores.items()
        if 0.3 <= score < 0.7  # Medium-low confidence
    ]

    confirmation_templates = {
        "job_title": "I extracted the title as '{value}' - is that right, or should it be something else?",
        "location": "It sounds like this is {value} - did I get that right?",
        "experience": "I gathered you're looking for around {value} years - is that the right range?",
        "compensation": "Based on what I saw, comp seems to be around {value} - is that accurate?",
    }

    for field, score in low_confidence_fields[:3]:  # Limit confirmations
        if field in confirmation_templates:
            questions.append(SmartQuestion(
                field=f"confirm_{field}",
                question=f"Just to confirm - {confirmation_templates[field]}",
                why=f"Low confidence ({score:.0%}) extraction needs verification",
                priority=2
            ))

    return questions


def generate_gap_fill_questions(
    missing_required: List[str],
    missing_optional: List[str],
    company: Optional[CompanyIntelligence] = None
) -> List[str]:
    """
    Generate simple question strings for gap filling.
    Use this for the API response, not the agent context.

    Args:
        missing_required: Required fields still missing
        missing_optional: Optional fields that would be nice to have
        company: Optional company context

    Returns:
        List of question strings
    """
    smart_questions = generate_smart_questions(
        company=company,
        missing_fields=missing_required + missing_optional[:3]
    )

    return [q.question for q in smart_questions]
