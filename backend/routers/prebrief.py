"""
Pre-Interview Brief router - generates comprehensive candidate analysis
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import json

from config import OPENROUTER_API_KEY, GEMINI_ANALYTICS_MODEL
from models.prebrief import PreInterviewBrief

router = APIRouter(prefix="/prebrief", tags=["prebrief"])


class PreBriefRequest(BaseModel):
    job_description: str
    resume: str
    company_context: Optional[str] = None  # Optional company culture info


PREBRIEF_SYSTEM_PROMPT = """You are an expert hiring analyst and interview coach. Your job is to analyze a candidate's resume against a job description and provide a comprehensive briefing for the interviewer.

Your analysis should be:
1. ACTIONABLE - Everything you say should help the interviewer
2. EVIDENCE-BASED - Cite specific things from the resume
3. BALANCED - Show both strengths and concerns
4. SPECIFIC - Give exact questions to ask, not generic advice

You are briefing someone who has 5 minutes to prepare. Make every word count."""


PREBRIEF_USER_PROMPT = """## Job Description:
{job_description}

## Candidate Resume:
{resume}

{company_context}

Analyze this candidate thoroughly and provide a pre-interview briefing as JSON:

{{
  "candidate_name": "Name from resume",
  "current_role": "Their current/most recent position",
  "years_experience": 5.5,
  
  "overall_fit_score": 0-100,
  "fit_summary": "One sentence: why they might/might not be a good fit",
  
  "score_breakdown": {{
    "technical_skills": 0-100,
    "experience_relevance": 0-100,
    "leadership_potential": 0-100,
    "communication_signals": 0-100,
    "culture_fit_signals": 0-100,
    "growth_trajectory": 0-100
  }},
  
  "skill_matches": [
    {{
      "skill": "Python",
      "required_level": "Expert",
      "candidate_level": "expert|proficient|competent|beginner|not_found",
      "evidence": "Led Python team at X, built Y system",
      "is_match": true
    }}
  ],
  
  "experience_highlights": [
    {{
      "company": "TechCorp",
      "role": "Senior Engineer",
      "duration": "2.5 years",
      "key_achievement": "Scaled system from 10K to 1M users",
      "relevance": "Directly applicable to our scaling challenges"
    }}
  ],
  
  "strengths": [
    {{
      "strength": "Strong distributed systems background",
      "evidence": "Built microservices handling 100K req/sec at X",
      "how_to_verify": "Ask about their architecture decisions and tradeoffs"
    }}
  ],
  
  "concerns": [
    {{
      "concern": "Limited leadership experience",
      "evidence": "Only 1 year managing a team of 2",
      "suggested_question": "Tell me about a time you had to influence without authority",
      "severity": "medium"
    }}
  ],
  
  "suggested_questions": [
    {{
      "question": "Walk me through the architecture of the system you built at X",
      "category": "technical",
      "purpose": "Assess system design depth and decision-making",
      "follow_up": "What would you do differently if you rebuilt it today?"
    }},
    {{
      "question": "Tell me about a time you disagreed with your manager's technical decision",
      "category": "behavioral",
      "purpose": "Assess communication and conflict resolution",
      "follow_up": "How did you handle it when they didn't change their mind?"
    }}
  ],
  
  "topics_to_avoid": ["Recent layoff at previous company might be sensitive"],
  
  "tldr": "Strong technical candidate with relevant distributed systems experience. Main gap is leadership - has only managed small teams. Worth probing on system design depth and growth trajectory.",
  
  "key_things_to_remember": [
    "They scaled a system 100x - ask for specifics",
    "Short tenure at last job (8 months) - understand why",
    "Claims ML experience but resume is light on details",
    "Strong open source contributions - genuine passion signal"
  ]
}}

Provide 4-6 skill_matches, 2-3 experience_highlights, 3-4 strengths, 2-4 concerns, 5-7 suggested_questions.
Return ONLY valid JSON, no markdown."""


MAX_RETRIES = 2


def normalize_prebrief_data(data: dict) -> dict:
    """Handle common LLM output issues"""
    # Ensure all required lists exist
    for field in ["skill_matches", "experience_highlights", "strengths", "concerns", "suggested_questions", "topics_to_avoid", "key_things_to_remember"]:
        if field not in data or data[field] is None:
            data[field] = []
    
    # Ensure score_breakdown exists
    if "score_breakdown" not in data or data["score_breakdown"] is None:
        data["score_breakdown"] = {
            "technical_skills": 50,
            "experience_relevance": 50,
            "leadership_potential": 50,
            "communication_signals": 50,
            "culture_fit_signals": 50,
            "growth_trajectory": 50
        }
    
    return data


@router.post("/{room_name}")
async def generate_pre_brief(room_name: str, request: PreBriefRequest) -> PreInterviewBrief:
    """
    Generate a comprehensive pre-interview briefing for the interviewer
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured")
    
    if not request.resume or len(request.resume.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume is too short for analysis")
    
    if not request.job_description or len(request.job_description.strip()) < 50:
        raise HTTPException(status_code=400, detail="Job description is too short for analysis")
    
    company_context = ""
    if request.company_context:
        company_context = f"## Company Context:\n{request.company_context}"
    
    user_prompt = PREBRIEF_USER_PROMPT.format(
        job_description=request.job_description,
        resume=request.resume,
        company_context=company_context
    )
    
    last_error = None
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "Briefing Room Pre-Brief"
                    },
                    json={
                        "model": GEMINI_ANALYTICS_MODEL,
                        "messages": [
                            {"role": "system", "content": PREBRIEF_SYSTEM_PROMPT},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.3 + (attempt * 0.1),
                        "response_format": {"type": "json_object"}
                    }
                )
                
                if response.status_code != 200:
                    print(f"[PreBrief] OpenRouter error: {response.status_code} - {response.text}")
                    raise HTTPException(status_code=500, detail=f"Pre-brief API error: {response.status_code}")
                
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                
                try:
                    prebrief_data = json.loads(content)
                    prebrief_data = normalize_prebrief_data(prebrief_data)
                    prebrief = PreInterviewBrief(**prebrief_data)
                    print(f"[PreBrief] Successfully generated brief for {prebrief.candidate_name} (score: {prebrief.overall_fit_score})")
                    return prebrief
                    
                except json.JSONDecodeError as e:
                    print(f"[PreBrief] JSON parse error (attempt {attempt + 1}): {e}")
                    last_error = f"Failed to parse pre-brief response"
                    if attempt < MAX_RETRIES:
                        continue
                    raise HTTPException(status_code=500, detail=last_error)
                    
                except Exception as e:
                    print(f"[PreBrief] Validation error (attempt {attempt + 1}): {e}")
                    last_error = f"Pre-brief validation error: {str(e)}"
                    if attempt < MAX_RETRIES:
                        continue
                    raise HTTPException(status_code=500, detail=last_error)
                    
        except httpx.TimeoutException:
            last_error = "Pre-brief request timed out"
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=504, detail=last_error)
        except HTTPException:
            raise
        except Exception as e:
            print(f"[PreBrief] Unexpected error (attempt {attempt + 1}): {e}")
            last_error = f"Pre-brief failed: {str(e)}"
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=500, detail=last_error)
    
    raise HTTPException(status_code=500, detail=last_error or "Pre-brief failed after retries")
