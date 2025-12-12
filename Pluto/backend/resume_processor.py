"""
Resume processing and gap analysis.
Extracts structured data from PDF and identifies missing fields.
"""

import json
import logging
import io
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber
from openai import AsyncOpenAI
from pydantic import ValidationError

from backend.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    EXTRACTION_MODEL,
)
from backend.voice_models import (
    ResumeExtraction,
    GapAnalysisResult,
    CandidateAnalysis,
    VoiceQuestion,
    VoiceSessionConfig,
    JobRole,
    Education,
    Project,
)

logger = logging.getLogger(__name__)

# Initialize OpenRouter client
client = AsyncOpenAI(
    base_url=OPENROUTER_BASE_URL,
    api_key=OPENROUTER_API_KEY,
)


# ============================================================================
# PDF Text Extraction
# ============================================================================

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text content from PDF bytes."""
    text_parts = []
    
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    
    return "\n\n".join(text_parts)


# ============================================================================
# COMPREHENSIVE Resume Extraction
# ============================================================================

RESUME_EXTRACTION_PROMPT = """You are an expert technical recruiter. Extract EVERY detail from this resume.

RESUME TEXT:
{resume_text}

CRITICAL INSTRUCTIONS:
1. SUMMARY: Write a 2-3 sentence executive summary of the candidate. If none exists, generate one based on their experience.
2. WORK HISTORY: Extract ALL jobs with company, title, dates, and key achievements (quantified where possible).
3. EDUCATION: Extract ALL degrees with institution, degree name, graduation date, GPA if available.
4. PROJECTS: Extract ALL projects with name, description, and tech stack.
5. SKILLS: Categorize into languages, frameworks, and tools.
6. YEARS EXPERIENCE: Calculate total years from work history dates.
7. LOCATION: Extract from contact info or most recent job.

RETURN COMPLETE JSON:
{{
  "name": "Full Name",
  "email": "email or null",
  "phone": "phone or null",
  "location": "City, State (MUST extract if anywhere in resume)",
  "linkedin_url": "url or null",
  "github_url": "url or null",
  "website_url": "url or null",
  
  "summary": "2-3 sentence executive summary (REQUIRED - generate if not explicit)",
  "years_experience": <float - calculate from work history>,
  
  "work_history": [
    {{
      "company": "Company Name",
      "title": "Job Title",
      "start_date": "MM/YYYY or YYYY",
      "end_date": "MM/YYYY or Present",
      "location": "City, State",
      "key_achievements": ["Achievement 1 with metrics", "Achievement 2"],
      "tech_used": ["Tech1", "Tech2"]
    }}
  ],
  
  "education": [
    {{
      "institution": "University Name",
      "degree": "Full Degree Name (e.g., Master of Science in Computer Science)",
      "graduation_date": "Year",
      "gpa": "X.X/4.0 or null",
      "highlights": ["Honors", "Relevant Coursework", "Activities"]
    }}
  ],
  
  "projects": [
    {{
      "name": "Project Name",
      "description": "What it does and its impact",
      "tech_stack": ["All", "Technologies", "Used"],
      "url": "url or null"
    }}
  ],
  
  "languages": ["Python", "TypeScript", "SQL", etc.],
  "frameworks": ["React", "FastAPI", "PyTorch", etc.],
  "tools": ["Docker", "AWS", "GCP", "Git", etc.],
  
  "awards": ["Award 1", "Award 2"],
  "certifications": ["Cert 1"],
  "publications": ["Pub 1"],
  
  "is_technical": true/false,
  "is_sales": true/false,
  "sold_to_finance": true/false,
  "is_founder": true/false,
  "startup_experience": true/false,
  "enterprise_experience": true/false,
  "quota_attainment": "percentage or null (if sales)",
  "deal_size": "amount or null (if sales)",
  "industries": ["list", "of", "industries"],
  
  "confidence_scores": {{
    "summary": <0-100>,
    "years_experience": <0-100>,
    "location": <0-100>,
    "work_history": <0-100>,
    "education": <0-100>,
    "projects": <0-100>
  }}
}}

IMPORTANT: Extract EVERYTHING. Do not skip or truncate any information."""


async def extract_from_resume(pdf_bytes: bytes) -> ResumeExtraction:
    """Extract comprehensive structured data from a PDF resume."""
    
    resume_text = extract_text_from_pdf(pdf_bytes)
    if not resume_text.strip():
        return ResumeExtraction(name="Unknown")
    
    logger.info(f"Extracted {len(resume_text)} chars from resume")
    prompt = RESUME_EXTRACTION_PROMPT.format(resume_text=resume_text[:16000])
    
    try:
        response = await client.chat.completions.create(
            model="google/gemini-2.5-flash",
            messages=[
                {"role": "system", "content": "You are an expert recruiter. Extract ALL information from the resume. Be thorough and complete."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        
        # Parse nested objects properly
        if "work_history" in data and data["work_history"]:
            data["work_history"] = [JobRole(**job) if isinstance(job, dict) else job for job in data["work_history"]]
        if "education" in data and data["education"]:
            data["education"] = [Education(**edu) if isinstance(edu, dict) else edu for edu in data["education"]]
        if "projects" in data and data["projects"]:
            data["projects"] = [Project(**proj) if isinstance(proj, dict) else proj for proj in data["projects"]]
        
        extraction = ResumeExtraction(**data)
        logger.info(f"Extracted: {extraction.name} | {len(extraction.work_history)} jobs | {len(extraction.projects)} projects")
        return extraction
        
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        return ResumeExtraction(
            name="Unknown",
            summary="Resume extraction failed. Please try again.",
            email=None,
            phone=None,
            location=None,
            years_experience=None,
            work_history=[],
            education=[],
            projects=[],
            languages=[],
            frameworks=[],
            tools=[],
            awards=[],
            certifications=[],
            publications=[],
            urls=[],
            is_technical=False,
            confidence_scores={},
        )


# ============================================================================
# Candidate Analysis Generation
# ============================================================================

ANALYSIS_PROMPT = """Analyze this candidate profile and provide insights.

CANDIDATE:
Name: {name}
Summary: {summary}
Experience: {years_experience} years
Location: {location}

Work History:
{work_history}

Projects:
{projects}

Skills: {skills}

Provide a JSON analysis:
{{
  "strengths": ["3-5 key strengths based on resume"],
  "weaknesses": ["2-3 potential concerns or gaps"],
  "red_flags": ["Any red flags to probe (job hopping, gaps, etc.)"],
  "why_consider": "1-2 sentences on why this candidate could be valuable",
  "suggested_questions": ["5 specific interview questions based on their background"]
}}"""


async def generate_candidate_analysis(extracted: ResumeExtraction) -> CandidateAnalysis:
    """Generate AI-powered candidate analysis."""
    
    work_str = "\n".join([
        f"- {job.title} at {job.company} ({job.start_date} - {job.end_date})"
        for job in extracted.work_history
    ]) or "No work history"
    
    proj_str = "\n".join([
        f"- {p.name}: {p.description[:100]}..."
        for p in extracted.projects
    ]) or "No projects"
    
    skills_str = ", ".join(extracted.languages + extracted.frameworks + extracted.tools)
    
    prompt = ANALYSIS_PROMPT.format(
        name=extracted.name,
        summary=extracted.summary or "N/A",
        years_experience=extracted.years_experience or "Unknown",
        location=extracted.location or "Unknown",
        work_history=work_str,
        projects=proj_str,
        skills=skills_str or "None listed"
    )
    
    try:
        response = await client.chat.completions.create(
            model="google/gemini-2.5-flash",
            messages=[
                {"role": "system", "content": "You are a senior recruiter. Provide honest, actionable candidate analysis."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        return CandidateAnalysis(**data)
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return CandidateAnalysis()


# ============================================================================
# Gap Analysis (Enhanced)
# ============================================================================

def analyze_gaps(extracted: ResumeExtraction, analysis: Optional[CandidateAnalysis] = None) -> GapAnalysisResult:
    """Identify gaps and generate comprehensive analysis."""
    
    missing_critical = []
    missing_nice = []
    deep_questions = []
    
    scores = extracted.confidence_scores or {}
    
    # Critical Checks
    if not extracted.location or scores.get("location", 100) < 50:
        missing_critical.append("location")
        
    if not extracted.years_experience or scores.get("years_experience", 100) < 50:
        missing_critical.append("total_experience")
    
    if not extracted.work_history:
        missing_critical.append("work_history")
        
    if extracted.is_technical:
        if not extracted.projects and len(extracted.work_history) < 2:
            missing_critical.append("projects_portfolio")
        if not extracted.languages:
            missing_critical.append("core_languages")
    
    if extracted.is_sales:
        if not extracted.quota_attainment or scores.get("sales_metrics", 100) < 50:
            missing_critical.append("quota_attainment")
    
    # Generate deep dive questions based on profile
    if extracted.projects:
        top_proj = extracted.projects[0]
        deep_questions.append(f"For your project '{top_proj.name}', what was the most difficult technical challenge you faced?")
    
    if extracted.work_history:
        top_role = extracted.work_history[0]
        deep_questions.append(f"At {top_role.company}, what was your biggest impact or achievement?")
        if len(extracted.work_history) > 1:
            deep_questions.append(f"Why did you leave {extracted.work_history[1].company}?")
    
    if extracted.is_technical:
        deep_questions.append("Describe a system you designed from scratch. What were the key architectural decisions?")
    else:
        deep_questions.append("Tell me about a time you had to influence someone without direct authority.")
    
    deep_questions.append("What are you looking for in your next role?")
    
    # Calculate score
    score = 40
    if extracted.work_history: score += 15
    if extracted.projects: score += 15
    if extracted.summary: score += 10
    if extracted.education: score += 10
    if not missing_critical: score += 10
    
    avg_conf = sum(scores.values()) / len(scores) if scores else 100
    if avg_conf < 50: score -= 10
    
    score = min(100, max(0, int(score)))
    
    return GapAnalysisResult(
        missing_critical=missing_critical,
        missing_nice_to_have=missing_nice,
        suggested_deep_dive_questions=deep_questions,
        completeness_score=score,
        candidate_analysis=analysis,
    )


# ============================================================================
# Dynamic Voice Prompt Generation
# ============================================================================

FIELD_TO_QUESTION_MAP = {
    "location": "Where are you currently based, and are you open to relocation?",
    "total_experience": "How many total years of professional experience do you have?",
    "projects_portfolio": "Tell me about a significant project you've built. What was your role?",
    "core_languages": "What programming languages are you most proficient in?",
    "quota_attainment": "What was your quota attainment in your most recent sales role?",
    "work_history": "Walk me through your recent work experience briefly.",
}

def generate_voice_session_config(
    extracted: ResumeExtraction,
    gaps: GapAnalysisResult,
) -> VoiceSessionConfig:
    """Generate comprehensive voice agent configuration."""
    
    questions = []
    
    # 1. Fill Critical Gaps
    for field in gaps.missing_critical:
        q_text = FIELD_TO_QUESTION_MAP.get(field)
        if q_text:
            questions.append(VoiceQuestion(field_key=field, question_text=q_text))
    
    # 2. Add Deep Dive Questions (from analysis or default)
    if gaps.candidate_analysis and gaps.candidate_analysis.suggested_questions:
        for i, q in enumerate(gaps.candidate_analysis.suggested_questions[:3]):
            questions.append(VoiceQuestion(field_key=f"analysis_q_{i}", question_text=q))
    else:
        for i, q_text in enumerate(gaps.suggested_deep_dive_questions[:3]):
            questions.append(VoiceQuestion(field_key=f"deep_dive_{i}", question_text=q_text))
    
    first_name = extracted.name.split()[0] if extracted.name else "there"
    
    # Build question list for reference
    q_list_str = "\n".join([f"{i+1}. {q.question_text}" for i, q in enumerate(questions)])
    
    # First message only asks the FIRST question - agent will handle the rest
    first_question = questions[0].question_text if questions else "tell me a bit about yourself"
    first_msg = f"Hi {first_name}! I've reviewed your resume and I'm really impressed with your background. I just have a few quick questions to complete your profile. Let's start - {first_question}"
    
    system_prompt = f"""You are Pluto, a senior technical recruiter at Pluto.

CANDIDATE: {extracted.name}
BACKGROUND: {extracted.summary or 'Technical professional'}
EXPERIENCE: {extracted.years_experience or 'Unknown'} years
LOCATION: {extracted.location or 'Unknown'}

KNOWN DATA (DO NOT ASK):
- Work History: {len(extracted.work_history)} roles
- Education: {len(extracted.education)} degrees
- Skills: {len(extracted.languages) + len(extracted.frameworks)} items

YOUR INTERVIEW QUESTIONS (Ask ONLY these):
{q_list_str}

INTERVIEW STYLE:
- Be warm but professional
- Ask ONE question at a time
- Listen actively and ask follow-up questions if the answer is vague
- If they mention something interesting, probe deeper
- Keep responses concise (1-2 sentences max)

After all questions, say: "Great! I have everything I need. We'll be in touch with matching opportunities. Thanks for your time!"

Begin the interview now."""

    return VoiceSessionConfig(
        candidate_name=extracted.name,
        known_data=extracted.model_dump(),
        questions_to_ask=questions,
        first_message=first_msg,
        system_prompt=system_prompt,
    )


# ============================================================================
# Real-Time Extraction from Transcript
# ============================================================================

REALTIME_EXTRACTION_PROMPT = """Extract CANDIDATE's answers from this interview transcript.
Focus on what the CANDIDATE (not interviewer) says.

TRANSCRIPT:
{transcript}

Return JSON with these keys if the candidate provides the information:
{{
  "location": "City, State if candidate mentions where they live",
  "total_experience": "Years if candidate mentions their experience",
  "core_languages": "Languages if candidate mentions programming skills",
  "projects_portfolio": "Project name/description if candidate describes a project",
  "quota_attainment": "Percentage if candidate mentions sales quota",
  "work_history": "Brief summary if candidate describes their experience",
  "motivation": "What candidate says they're looking for",
  "achievement": "Key achievement or result candidate mentions"
}}

ONLY include fields where the CANDIDATE explicitly provides an answer. Do not infer."""


async def extract_from_transcript(transcript: str) -> Dict[str, Any]:
    """Extract structured data from conversation transcript in real-time."""
    
    if not transcript.strip():
        return {}
    
    prompt = REALTIME_EXTRACTION_PROMPT.format(transcript=transcript[-4000:])
    
    try:
        response = await client.chat.completions.create(
            model=EXTRACTION_MODEL,
            messages=[
                {"role": "system", "content": "Extract data from transcript. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        
        # Filter out null values
        return {k: v for k, v in data.items() if v is not None}
        
    except Exception as e:
        logger.error(f"Transcript extraction failed: {e}")
        return {}
