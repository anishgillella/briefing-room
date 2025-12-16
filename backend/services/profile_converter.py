"""
Job Profile to Scoring Criteria Converter.
Converts voice ingest job profiles into the format expected by the pluto processor.
"""
from typing import List, Dict, Any, Tuple
from models.voice_ingest import JobProfile, CandidateTrait
from models.voice_ingest.enums import TraitPriority


def convert_profile_to_scoring_context(profile: JobProfile) -> Tuple[str, List[str], List[str], List[Dict]]:
    """
    Convert a JobProfile into scoring context for the pluto processor.

    Returns:
        Tuple of:
        - job_description: Generated JD text
        - scoring_criteria: List of criteria to prioritize
        - red_flag_indicators: List of red flags to watch for
        - extraction_fields: List of dynamic extraction field definitions
    """
    # Generate job description from profile
    job_description = profile.to_job_description()

    # Convert traits to scoring criteria
    scoring_criteria = _traits_to_scoring_criteria(profile.traits)

    # Extract red flags from traits and nuances
    red_flag_indicators = _extract_red_flags(profile)

    # Generate extraction fields from traits
    extraction_fields = _traits_to_extraction_fields(profile.traits)

    return job_description, scoring_criteria, red_flag_indicators, extraction_fields


def _traits_to_scoring_criteria(traits: List[CandidateTrait]) -> List[str]:
    """
    Convert candidate traits to scoring criteria strings.
    Prioritizes must_have traits.
    """
    criteria = []

    # Sort by priority (must_have first)
    priority_order = {
        TraitPriority.MUST_HAVE: 0,
        TraitPriority.NICE_TO_HAVE: 1,
    }

    sorted_traits = sorted(
        traits,
        key=lambda t: priority_order.get(t.priority, 1)
    )

    for trait in sorted_traits:
        # Build criterion string
        priority_label = ""
        if trait.priority == TraitPriority.MUST_HAVE:
            priority_label = "[MUST HAVE] "
        elif trait.priority == TraitPriority.NICE_TO_HAVE:
            priority_label = "[NICE TO HAVE] "

        criterion = f"{priority_label}{trait.name}: {trait.description}"

        # Add signals if available
        if trait.signals:
            signals_str = ", ".join(trait.signals[:5])
            criterion += f" (Look for: {signals_str})"

        criteria.append(criterion)

    return criteria


def _extract_red_flags(profile: JobProfile) -> List[str]:
    """
    Extract red flag indicators from profile.
    """
    red_flags = []

    # Add red flags from nuances
    for nuance in profile.nuances:
        if nuance.category.value == "red_flag":
            red_flags.append(nuance.insight)

    # Add experience-related red flags based on requirements
    req = profile.requirements
    if req.experience_min_years and req.experience_min_years >= 5:
        red_flags.append(f"Less than {req.experience_min_years} years of relevant experience")

    if req.experience_max_years:
        red_flags.append(f"More than {req.experience_max_years} years (may be overqualified)")

    # Add default red flags if none specified
    if not red_flags:
        red_flags = [
            "Frequent job changes (less than 1 year at multiple positions)",
            "No relevant industry experience",
            "Skills mismatch with role requirements",
        ]

    return red_flags[:10]  # Limit to 10


def _traits_to_extraction_fields(traits: List[CandidateTrait]) -> List[Dict[str, Any]]:
    """
    Convert traits to extraction field definitions.
    Creates dynamic fields to extract from candidate profiles.
    """
    fields = []

    for trait in traits:
        if trait.priority == TraitPriority.MUST_HAVE:
            # Create a boolean field to check if candidate has this trait
            field = {
                "field_name": _slugify(trait.name),
                "field_type": "boolean",
                "description": f"Does the candidate demonstrate {trait.name.lower()}? {trait.description}",
                "is_required": trait.priority == TraitPriority.MUST_HAVE,
            }
            fields.append(field)

            # If signals are defined, create a list field to capture them
            if trait.signals and len(trait.signals) >= 3:
                signals_field = {
                    "field_name": f"{_slugify(trait.name)}_signals",
                    "field_type": "string_list",
                    "description": f"Which of these does the candidate have: {', '.join(trait.signals)}",
                    "is_required": False,
                }
                fields.append(signals_field)

    return fields[:15]  # Limit to 15 custom fields


def _slugify(text: str) -> str:
    """Convert text to snake_case field name."""
    import re
    # Remove special characters and convert to lowercase
    slug = re.sub(r'[^a-zA-Z0-9\s]', '', text.lower())
    # Replace spaces with underscores
    slug = re.sub(r'\s+', '_', slug)
    # Remove consecutive underscores
    slug = re.sub(r'_+', '_', slug)
    return slug.strip('_')


def build_enhanced_jd(profile: JobProfile) -> str:
    """
    Build an enhanced job description that includes trait details and requirements.
    More detailed than profile.to_job_description() for better AI scoring context.
    """
    sections = []

    # Header
    req = profile.requirements
    if req.job_title:
        sections.append(f"# {req.job_title}")
        sections.append("")

    # Company context
    if profile.company and profile.company.name:
        company_info = [f"## About {profile.company.name}"]
        if profile.company.tagline:
            company_info.append(f'"{profile.company.tagline}"')
        if profile.company.product_description:
            company_info.append(f"\n{profile.company.product_description}")
        if profile.company.funding_stage:
            company_info.append(f"\nStage: {profile.company.funding_stage.value.replace('_', ' ').title()}")
        if profile.company.team_size:
            company_info.append(f"Team Size: {profile.company.team_size}")
        sections.append("\n".join(company_info))
        sections.append("")

    # Requirements section
    req_lines = ["## Requirements"]
    if req.location_type:
        location = req.format_location() if hasattr(req, 'format_location') else req.location_type.value
        req_lines.append(f"- Location: {location}")
    if req.experience_min_years is not None:
        exp = req.format_experience() if hasattr(req, 'format_experience') else f"{req.experience_min_years}+ years"
        req_lines.append(f"- Experience: {exp}")
    if req.salary_min:
        comp = req.format_compensation() if hasattr(req, 'format_compensation') else f"${req.salary_min:,}+"
        req_lines.append(f"- Compensation: {comp}")
    if req.visa_sponsorship is not None:
        req_lines.append(f"- Visa Sponsorship: {'Yes' if req.visa_sponsorship else 'No'}")
    sections.append("\n".join(req_lines))
    sections.append("")

    # Must-have traits
    must_haves = [t for t in profile.traits if t.priority == TraitPriority.MUST_HAVE]
    if must_haves:
        mh_lines = ["## Must-Have Qualifications"]
        for trait in must_haves:
            mh_lines.append(f"- **{trait.name}**: {trait.description}")
            if trait.signals:
                mh_lines.append(f"  - Look for: {', '.join(trait.signals[:5])}")
        sections.append("\n".join(mh_lines))
        sections.append("")

    # Nice-to-have traits
    nice_to_haves = [t for t in profile.traits if t.priority == TraitPriority.NICE_TO_HAVE]
    if nice_to_haves:
        nth_lines = ["## Preferred Qualifications"]
        for trait in nice_to_haves:
            nth_lines.append(f"- {trait.name}: {trait.description}")
        sections.append("\n".join(nth_lines))
        sections.append("")

    # Interview process
    if profile.interview_stages:
        int_lines = ["## Interview Process"]
        for stage in sorted(profile.interview_stages, key=lambda s: s.order):
            duration = f" ({stage.duration_minutes} min)" if stage.duration_minutes else ""
            int_lines.append(f"{stage.order}. **{stage.name}**{duration}: {stage.description}")
        sections.append("\n".join(int_lines))
        sections.append("")

    # Selling points
    if profile.company and profile.company.potential_selling_points:
        sp_lines = ["## Why Join Us"]
        for point in profile.company.potential_selling_points[:5]:
            sp_lines.append(f"- {point}")
        sections.append("\n".join(sp_lines))

    return "\n".join(sections)


def get_profile_summary_for_display(profile: JobProfile) -> Dict[str, Any]:
    """
    Get a summary of the profile suitable for display in the UI.
    """
    req = profile.requirements

    return {
        "id": profile.id,
        "job_title": req.job_title or "Untitled Role",
        "company_name": profile.company.name if profile.company else None,
        "location": req.location_type.value if req.location_type else None,
        "experience_range": f"{req.experience_min_years or 0}+ years",
        "traits_count": len(profile.traits),
        "must_have_count": len([t for t in profile.traits if t.priority == TraitPriority.MUST_HAVE]),
        "interview_stages_count": len(profile.interview_stages),
        "completion_percentage": profile.calculate_completion_percentage(),
        "is_complete": profile.is_complete,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
    }
