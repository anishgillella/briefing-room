"""
JD Analyzer Service
Analyzes a job description and extracts suggested extraction criteria.
"""
import json
import logging
from openai import OpenAI
from pydantic import BaseModel
from typing import Optional
from config import OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

# Use same client config as pluto_processor
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

ANALYZER_MODEL = "google/gemini-2.5-flash"


class ExtractionField(BaseModel):
    """A single field to extract from candidate profiles."""
    field_name: str  # e.g., "sold_to_finance"
    field_type: str  # "boolean", "number", "string", "string_list"
    description: str  # Human-readable description
    is_required: bool  # Whether this is a must-have
    

class JDAnalysisResult(BaseModel):
    """Result of analyzing a job description."""
    role_type: str  # e.g., "Sales AE", "Backend Engineer", "Product Manager"
    suggested_fields: list[ExtractionField]
    scoring_criteria: list[str]  # Key criteria for scoring
    red_flag_indicators: list[str]  # Things to watch for


# Baseline fields always extracted (common across all roles)
BASELINE_FIELDS = [
    ExtractionField(
        field_name="years_experience",
        field_type="number",
        description="Total years of relevant work experience",
        is_required=True
    ),
    ExtractionField(
        field_name="industries",
        field_type="string_list",
        description="Industries the candidate has worked in",
        is_required=False
    ),
    ExtractionField(
        field_name="skills",
        field_type="string_list",
        description="Key skills mentioned in profile",
        is_required=False
    ),
    ExtractionField(
        field_name="is_founder",
        field_type="boolean",
        description="Has the candidate founded a company",
        is_required=False
    ),
    ExtractionField(
        field_name="startup_experience",
        field_type="boolean",
        description="Has experience working at startups",
        is_required=False
    ),
    ExtractionField(
        field_name="enterprise_experience",
        field_type="boolean",
        description="Has experience with enterprise companies/deals",
        is_required=False
    ),
]


async def analyze_job_description(job_description: str) -> JDAnalysisResult:
    """
    Analyze a job description and return suggested extraction fields.
    
    Args:
        job_description: The full text of the job description
        
    Returns:
        JDAnalysisResult with role type and suggested extraction fields
    """
    
    prompt = f"""Analyze this job description and identify:
1. The type of role (e.g., "Sales Account Executive", "Backend Engineer", "Product Manager")
2. Key criteria to extract from candidate profiles
3. Scoring criteria (what makes a good candidate)
4. Red flags to watch for

JOB DESCRIPTION:
{job_description}

Return a JSON object with:
- role_type: string describing the role
- suggested_fields: array of objects with:
  - field_name: snake_case name (e.g., "sold_to_cfo", "python_experience")
  - field_type: one of "boolean", "number", "string", "string_list"
  - description: what this field measures
  - is_required: whether this is a must-have
- scoring_criteria: array of strings describing what to look for
- red_flag_indicators: array of strings describing warning signs

Focus on role-specific fields. For example:
- Sales roles: quota_attainment, sold_to_[persona], deal_size, sales_methodologies
- Engineering roles: programming_languages, system_design_experience, open_source_contributions
- Product roles: product_launches, user_research_experience, technical_background

Return 5-10 role-specific fields that would help evaluate candidates for THIS specific role.
"""

    try:
        response = client.chat.completions.create(
            model=ANALYZER_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert recruiter analyzing job descriptions. Return valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        
        result_text = response.choices[0].message.content
        result_data = json.loads(result_text)
        
        # Parse suggested fields
        suggested_fields = []
        for field_data in result_data.get("suggested_fields", []):
            try:
                field = ExtractionField(
                    field_name=field_data.get("field_name", "unknown"),
                    field_type=field_data.get("field_type", "boolean"),
                    description=field_data.get("description", ""),
                    is_required=field_data.get("is_required", False)
                )
                suggested_fields.append(field)
            except Exception as e:
                logger.warning(f"Failed to parse field: {field_data}, error: {e}")
        
        return JDAnalysisResult(
            role_type=result_data.get("role_type", "Unknown Role"),
            suggested_fields=suggested_fields,
            scoring_criteria=result_data.get("scoring_criteria", []),
            red_flag_indicators=result_data.get("red_flag_indicators", [])
        )
        
    except Exception as e:
        logger.error(f"JD analysis failed: {e}")
        # Return empty result on failure
        return JDAnalysisResult(
            role_type="Unknown",
            suggested_fields=[],
            scoring_criteria=[],
            red_flag_indicators=[]
        )


def get_full_extraction_schema(jd_fields: list[ExtractionField]) -> list[ExtractionField]:
    """
    Combine baseline fields with JD-specific fields.
    
    Args:
        jd_fields: Fields suggested by JD analysis
        
    Returns:
        Combined list of all extraction fields
    """
    # Start with baseline
    all_fields = list(BASELINE_FIELDS)
    
    # Add JD-specific fields (avoid duplicates by field_name)
    baseline_names = {f.field_name for f in BASELINE_FIELDS}
    for field in jd_fields:
        if field.field_name not in baseline_names:
            all_fields.append(field)
    
    return all_fields
