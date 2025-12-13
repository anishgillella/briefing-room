"""
Pydantic models and prompts for data extraction and scoring.
Centralized schema definitions for all LLM interactions.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# Phase 1: Extraction Models
# ============================================================================

class CandidateExtraction(BaseModel):
    """Schema for semantic data extracted by Gemini 2.5 Flash."""
    
    bio_summary: str = Field(
        description="2-sentence first-person sales-focused summary"
    )
    sold_to_finance: bool = Field(
        description="True if candidate mentions selling to CFOs, Controllers, VP Finance"
    )
    is_founder: bool = Field(
        description="True if candidate has been a Founder or Co-Founder"
    )
    startup_experience: bool = Field(
        description="True if candidate has worked at a startup (Series A/B or earlier)"
    )
    enterprise_experience: bool = Field(
        description="True if candidate has sold to enterprise companies (1000+ employees)"
    )
    max_acv_mentioned: Optional[int] = Field(
        default=None,
        description="Highest deal size/ACV mentioned in dollars, null if not found"
    )
    quota_attainment: Optional[float] = Field(
        default=None,
        description="Highest quota attainment percentage mentioned, null if not found"
    )
    industries: List[str] = Field(
        default_factory=list,
        description="Industries inferred from employers"
    )
    sales_methodologies: List[str] = Field(
        default_factory=list,
        description="Sales methodologies mentioned or inferred"
    )


class RedFlags(BaseModel):
    """Schema for potential concerns detected in candidate profile."""
    
    job_hopping: bool = Field(
        default=False,
        description="True if average tenure < 18 months across 3+ roles"
    )
    title_inflation: bool = Field(
        default=False,
        description="True if titles seem inconsistent with experience"
    )
    gaps_in_employment: bool = Field(
        default=False,
        description="True if unexplained gaps > 6 months"
    )
    overqualified: bool = Field(
        default=False,
        description="True if likely expects above $200k OTE"
    )
    concerns: List[str] = Field(
        default_factory=list,
        description="Specific concerns to probe in interview"
    )
    
    @property
    def red_flag_count(self) -> int:
        """Count of boolean red flags that are True."""
        return sum([
            self.job_hopping,
            self.title_inflation,
            self.gaps_in_employment,
            self.overqualified
        ])


class ExtractionResult(BaseModel):
    """Combined extraction result from LLM."""
    extraction: CandidateExtraction
    red_flags: RedFlags


class ProcessedCandidate(BaseModel):
    """Schema for a processed candidate ready for scoring."""
    
    # Identity
    id: str
    name: str
    
    # Deterministic fields
    job_title: str
    location_city: str
    location_state: str
    years_sales_experience: float
    skills: List[str]
    
    # Preferences
    willing_to_relocate: bool = False
    work_style_remote: bool = False
    work_style_hybrid: bool = False
    work_style_in_person: bool = False
    base_salary_min: Optional[int] = None
    ote_min: Optional[int] = None
    availability_days: Optional[int] = None
    
    # Semantic extraction
    bio_summary: str = ""
    sold_to_finance: bool = False
    is_founder: bool = False
    startup_experience: bool = False
    enterprise_experience: bool = False
    max_acv_mentioned: Optional[int] = None
    quota_attainment: Optional[float] = None
    industries: List[str] = Field(default_factory=list)
    sales_methodologies: List[str] = Field(default_factory=list)
    
    # Red flags
    red_flags: RedFlags = Field(default_factory=RedFlags)
    has_enrichment_data: bool = False


# ============================================================================
# Phase 2: Scoring Models
# ============================================================================

class Evaluation(BaseModel):
    """AI evaluation output from GPT-4o-mini."""
    score: int = Field(ge=0, le=100, description="Fit score 0-100")
    one_line_summary: str = Field(description="10-word punchy summary")
    pros: List[str] = Field(description="Top 3-5 strengths")
    cons: List[str] = Field(description="Top 3-5 gaps/concerns")
    reasoning: str = Field(description="2-3 sentence explanation")


class InterviewQuestions(BaseModel):
    """Generated interview questions for candidate."""
    questions: List[str] = Field(description="3-5 tailored interview questions")


class ScoredCandidate(BaseModel):
    """Final scored and ranked candidate."""
    
    # Ranking
    rank: int
    tier: str  # "🔥 Top Match", "✅ Strong Fit", etc.
    
    # Scores (0-100 each)
    algo_score: int
    ai_score: int
    final_score: int
    
    # AI evaluation
    one_line_summary: str
    pros: List[str]
    cons: List[str]
    reasoning: str
    interview_questions: List[str] = Field(default_factory=list)
    
    # Candidate data
    id: str
    name: str
    job_title: str
    location_city: str
    location_state: str
    years_sales_experience: float
    bio_summary: str
    industries: str
    skills: str
    sold_to_finance: bool
    is_founder: bool
    startup_experience: bool
    enterprise_experience: bool
    max_acv_mentioned: Optional[int] = None
    quota_attainment: Optional[float] = None
    red_flag_count: int = 0
    red_flag_concerns: str = ""
    
    # Data Completeness Tracking
    missing_required: List[str] = Field(
        default_factory=list,
        description="Missing REQUIRED fields (critical for role)"
    )
    missing_preferred: List[str] = Field(
        default_factory=list,
        description="Missing PREFERRED fields (nice-to-have)"
    )
    data_completeness: int = Field(
        default=100,
        description="Weighted completeness percentage (required fields 2x weight)"
    )


# ============================================================================
# Prompts
# ============================================================================

class Prompts:
    """Centralized prompt templates."""
    
    EXTRACTION_SYSTEM = "You are a precise data extraction engine. Return only valid JSON, no markdown."
    
    SCORING_SYSTEM = "You are an expert executive recruiter. Return only valid JSON."
    
    @staticmethod
    def extraction_prompt(context_str: str, candidate_name: str) -> str:
        """Build extraction prompt for Gemini."""
        return f"""Analyze this LinkedIn profile for {candidate_name} and extract structured data.

PROFILE DATA:
{context_str}

EXTRACT the following information. Return ONLY valid JSON matching this exact schema:

{{
  "extraction": {{
    "bio_summary": "WRITE IN FIRST PERSON ('I am...', 'I have...'). 2 sentences about sales achievements and career focus.",
    "sold_to_finance": true/false,
    "is_founder": true/false,
    "startup_experience": true/false,
    "enterprise_experience": true/false,
    "max_acv_mentioned": number or null,
    "quota_attainment": number or null,
    "industries": ["list", "of", "industries"],
    "sales_methodologies": ["list", "of", "methodologies"]
  }},
  "red_flags": {{
    "job_hopping": true/false,
    "title_inflation": true/false,
    "gaps_in_employment": true/false,
    "overqualified": true/false,
    "concerns": ["list of specific concerns"]
  }}
}}

RULES:
- bio_summary: MUST be in FIRST PERSON (start with "I am" or "I have"). Focus on sales achievements.
- sold_to_finance: Only true if explicitly mentions selling to CFOs, Controllers, VP Finance
- is_founder: Only true if they held a Founder/Co-Founder title
- startup_experience: True if worked at Series A/B stage companies or small startups
- enterprise_experience: True if selling to Fortune 500 or 1000+ employee companies
- max_acv_mentioned: Extract largest deal size (e.g., "$500k deal" = 500000). Null if not mentioned.
- quota_attainment: Extract highest percentage (e.g., "150% of quota" = 150). Null if not mentioned.
- industries: INFER from company names. Examples: "Fintech", "SaaS", "Healthcare", "AI/ML"
- sales_methodologies: INFER from approach. Examples: "Consultative Sales", "Full-Cycle Sales", "MEDDIC"
- job_hopping: True if average tenure under 18 months
- overqualified: True if seniority suggests >$200k OTE expectation
"""

    @staticmethod
    def evaluation_prompt(candidate: dict) -> str:
        """Build evaluation prompt for GPT-4o-mini."""
        return f"""You are an expert executive recruiter evaluating candidates for a Founding Account Executive role.

FULL JOB DESCRIPTION:
Founding Account Executive (AE) – AI SaaS Marketplace
Join a fast-growing, AI-driven SaaS marketplace at a pivotal early stage as a Founding Account
Executive. This is a unique opportunity to shape the go-to-market strategy, drive revenue, and make a
direct impact on the company’s growth trajectory. If you’re hungry, ambitious, and ready to accelerate
your career in a dynamic, high-growth environment, we want to hear from you.

About the Company:
We are an innovative, AI-powered SaaS marketplace revolutionizing how go-to-market teams connect
and grow. Backed by top investors and experiencing rapid growth, our team is cash flow positive and on
track to triple in size this year. Join us at the ground floor and help shape the future of B2B sales
technology.

Key Responsibilities:
• Own the full sales cycle: prospecting, qualifying, presenting, and closing deals with mid-market and
enterprise clients.
• Engage with finance and accounting leaders (CFOs, Controllers, etc.) to understand their needs and
deliver tailored solutions.
• Drive inbound and outbound sales calls, converting leads into long-term customers.
• Represent the company at industry events and conferences as needed.
• Collaborate closely with founders and cross-functional teams to refine sales processes and go-to-market
strategy.
• Contribute to building a high-performance sales culture and help shape the future of the organization.

Required Qualifications:
• 1+ years of closing experience as an Account Executive, ideally in SaaS, fintech, or recruiting tech.
• Proven track record of selling to finance and accounting stakeholders (CFOs, Controllers, etc.) in
mid-market or enterprise environments.
• Exceptional communication, relationship-building, and consultative selling skills.
• Demonstrated drive, ambition, and hunger to succeed in a fast-paced startup environment.
• Ability to thrive with minimal structure and proactively solve problems.
• Willingness to travel occasionally for events or client meetings.
• Open to remote candidates; preference for those able to attend key events in person.

Preferred Qualifications:
• 2+ years of closing experience as an Account Executive.
• Background in finance, accounting, or fintech sales.
• Experience selling to similar ICPs (finance leaders, payroll, fintech, SaaS).
• Startup experience and demonstrated scrappiness/hustle.
• Degree in finance or related field.

Benefits & Perks:
• Competitive base salary plus uncapped commission (typical OTE $180K–$200K, flexible for top talent).
• Health insurance coverage.
• Flexible remote work options.
• Professional development and growth opportunities.
• Collaborative, high-impact team environment.

CANDIDATE PROFILE:
Name: {candidate['name']}
Current Title: {candidate['job_title']}
Location: {candidate['location_city']}, {candidate['location_state']}
Experience: {candidate['years_sales_experience']} years in sales
Bio: {candidate['bio_summary']}
Industries: {candidate['industries']}
Key Skills: {str(candidate['skills'])[:200]}...

EXTRACTED SIGNALS:
- Sold to Finance/CFOs: {candidate['sold_to_finance']}
- Is Founder: {candidate['is_founder']}
- Startup Experience: {candidate['startup_experience']}
- Enterprise Experience: {candidate['enterprise_experience']}
- Max Deal Size: ${candidate.get('max_acv_mentioned') or 'Not mentioned'}
- Quota Attainment: {candidate.get('quota_attainment') or 'Not mentioned'}%
- Red Flags: {candidate.get('red_flag_count', 0)} (concerns: {candidate.get('red_flag_concerns', 'None')})

SCORING RUBRIC (be strict and realistic):
90-100: Exceptional - Exceeds ALL requirements, ideal fit (rare - truly outstanding)
75-89: Strong - Meets all critical requirements with minor gaps
60-74: Potential - Some gaps but coachable, worth interviewing
40-59: Weak - Missing key requirements, risky hire
0-39: Not a fit - Wrong background entirely

RETURN ONLY VALID JSON:
{{
  "score": <0-100>,
  "one_line_summary": "<10-word punchy summary>",
  "pros": ["strength 1", "strength 2", "strength 3"],
  "cons": ["concern 1", "concern 2", "concern 3"],
  "reasoning": "<2-3 sentence explanation of why this score>"
}}"""

    @staticmethod
    def interview_prompt(candidate_name: str, score: int, cons: List[str]) -> str:
        """Build interview question prompt."""
        return f"""Generate 3-5 tailored interview questions for this candidate.

CANDIDATE: {candidate_name}
SCORE: {score}/100
CONCERNS/GAPS: {', '.join(cons)}

Generate questions that:
1. Probe their weaker areas
2. Validate claimed achievements
3. Test startup culture fit

RETURN ONLY VALID JSON:
{{
  "questions": [
    "Question 1?",
    "Question 2?",
    "Question 3?"
  ]
}}"""

    @staticmethod
    def comparison_prompt(candidate_a: dict, candidate_b: dict) -> str:
        """Build head-to-head comparison prompt."""
        return f"""Compare these two candidates for the Founding Account Executive role.

CANDIDATE A: {candidate_a.get('name', 'Unknown')}
- Score: {candidate_a.get('final_score', 0)}/100 (Algo: {candidate_a.get('algo_score', 0)}, AI: {candidate_a.get('ai_score', 0)})
- Job Title: {candidate_a.get('job_title', 'N/A')}
- Experience: {candidate_a.get('years_sales_experience', 0)} years
- CFO/Finance Sales: {candidate_a.get('sold_to_finance', False)}
- Bio: {candidate_a.get('bio_summary', 'N/A')[:200]}
- Pros: {', '.join(candidate_a.get('pros', [])[:3])}
- Cons: {', '.join(candidate_a.get('cons', [])[:3])}

CANDIDATE B: {candidate_b.get('name', 'Unknown')}
- Score: {candidate_b.get('final_score', 0)}/100 (Algo: {candidate_b.get('algo_score', 0)}, AI: {candidate_b.get('ai_score', 0)})
- Job Title: {candidate_b.get('job_title', 'N/A')}
- Experience: {candidate_b.get('years_sales_experience', 0)} years
- CFO/Finance Sales: {candidate_b.get('sold_to_finance', False)}
- Bio: {candidate_b.get('bio_summary', 'N/A')[:200]}
- Pros: {', '.join(candidate_b.get('pros', [])[:3])}
- Cons: {', '.join(candidate_b.get('cons', [])[:3])}

Analyze both candidates for closing complex enterprise deals to CFOs/Controllers at a startup.

RETURN ONLY VALID JSON:
{{
  "winner": "A" or "B" or "TIE",
  "winner_name": "<name of winner>",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "summary": "<1-2 sentence comparison summary>",
  "candidate_a_strengths": ["strength 1", "strength 2"],
  "candidate_a_weaknesses": ["weakness 1", "weakness 2"],
  "candidate_b_strengths": ["strength 1", "strength 2"],
  "candidate_b_weaknesses": ["weakness 1", "weakness 2"],
  "key_differentiator": "<what separates them>",
  "recommendation": "<which to interview first and why>"
}}"""
