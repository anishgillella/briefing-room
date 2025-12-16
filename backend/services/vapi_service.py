"""
Vapi Service for Voice AI Calls.
Creates and manages Vapi web calls with dynamic assistant configuration.
"""
import httpx
import logging
from typing import Dict, Any, Optional

from config import VAPI_API_KEY
from models.voice_ingest import CompanyIntelligence, JobProfile
from models.voice_ingest.context import build_opening_hook

logger = logging.getLogger(__name__)

VAPI_API_URL = "https://api.vapi.ai"


class VapiService:
    """Service for creating Vapi voice calls with dynamic context."""

    def __init__(self):
        self.api_key = VAPI_API_KEY
        self.timeout = 30.0

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers for Vapi API."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_system_prompt(
        self,
        user_name: str,
        company_intel: Optional[CompanyIntelligence],
        job_profile: Optional[JobProfile],
    ) -> str:
        """Build the system prompt for the Vapi assistant."""

        # Company context section
        company_context = ""
        if company_intel:
            ci = company_intel
            company_context = f"""
## Company Context: {ci.name}
- Website: {ci.website or 'N/A'}
- Tagline: {ci.tagline or 'N/A'}
- Industry: {ci.industry or 'N/A'}
- Product: {ci.product_description or 'N/A'}
- Problem Solved: {ci.problem_solved or 'N/A'}
- Funding: {ci.total_raised or 'Unknown'} ({ci.funding_stage.value if ci.funding_stage else 'Unknown stage'})
- Investors: {', '.join(ci.investors[:3]) if ci.investors else 'N/A'}
- Team Size: {ci.team_size or 'Unknown'}
- Headquarters: {ci.headquarters or 'Unknown'}
- Tech Stack: {', '.join(ci.tech_stack_hints[:5]) if ci.tech_stack_hints else 'N/A'}
- Culture: {', '.join(ci.culture_keywords[:3]) if ci.culture_keywords else 'N/A'}
- Recent News: {ci.recent_news[0] if ci.recent_news else 'N/A'}
- Interesting Facts: {'; '.join(ci.interesting_facts[:2]) if ci.interesting_facts else 'N/A'}
- Selling Points: {'; '.join(ci.potential_selling_points[:2]) if ci.potential_selling_points else 'N/A'}
"""

        # Job profile context section
        job_context = ""
        if job_profile:
            jp = job_profile
            req = jp.requirements
            job_context = f"""
## Current Job Profile Data
- Job Title: {req.job_title or 'Not set'}
- Location: {req.location_city or 'Not set'}
- Remote Policy: {req.location_type.value if req.location_type else 'Not set'}
- Salary Range: {(req.salary_min // 1000) if req.salary_min else '?'}k - {(req.salary_max // 1000) if req.salary_max else '?'}k {req.salary_currency or 'USD'}
- Experience: {req.experience_min_years or '?'}+ years
"""
            # Get must-have traits
            must_have_traits = jp.get_must_have_traits()
            if must_have_traits:
                job_context += f"- Must-Have Skills: {', '.join([t.name for t in must_have_traits[:5]])}\n"
            # Get nice-to-have traits
            nice_to_have_traits = jp.get_nice_to_have_traits()
            if nice_to_have_traits:
                job_context += f"- Nice-to-Have Skills: {', '.join([t.name for t in nice_to_have_traits[:5]])}\n"

        return f"""You are a friendly, professional recruiting assistant helping {user_name} build out a job profile for their company.

{company_context}
{job_context}

## Your Objectives
1. Help fill in missing information about the role
2. Ask smart, contextual questions based on what you know about the company
3. Gather details about: job title, requirements, compensation, interview process
4. Be conversational and natural - this is a voice call, not a form

## Conversation Guidelines
- Keep responses concise (2-3 sentences max for voice)
- Ask ONE question at a time
- Use the company context to make intelligent suggestions
- When they mention something, confirm and move to the next topic
- Be enthusiastic but professional

## Information to Gather (if not already known)
- Job title and level
- Must-have skills/requirements
- Nice-to-have skills
- Salary range
- Remote/hybrid/onsite policy
- Interview process stages
- Team size and reporting structure
- Start date urgency

When you have gathered enough information, summarize what you've captured and ask if there's anything else to add."""

    async def create_web_call(
        self,
        session_id: str,
        user_name: str,
        company_intel: Optional[CompanyIntelligence] = None,
        job_profile: Optional[JobProfile] = None,
    ) -> Dict[str, Any]:
        """
        Create a Vapi web call with an inline assistant configuration.

        Args:
            session_id: The voice ingest session ID
            user_name: User's first name
            company_intel: Company research data
            job_profile: Current job profile data

        Returns:
            Dict with webCallUrl and other call details
        """
        if not self.api_key:
            logger.error("VAPI_API_KEY not configured")
            return {"error": "Vapi API key not configured"}

        # Build the system prompt with all context
        system_prompt = self._build_system_prompt(user_name, company_intel, job_profile)

        # Build the opening message
        first_message = build_opening_hook(user_name, company_intel)

        # Create the assistant configuration inline
        assistant_config = {
            "model": {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "temperature": 0.7,
                "systemPrompt": system_prompt,
            },
            "voice": {
                "provider": "11labs",
                "voiceId": "21m00Tcm4TlvDq8ikWAM",  # Rachel voice
                "stability": 0.5,
                "similarityBoost": 0.75,
            },
            "transcriber": {
                "provider": "deepgram",
                "model": "nova-2",
                "language": "en",
            },
            "firstMessage": first_message,
            "firstMessageMode": "assistant-speaks-first",
            "silenceTimeoutSeconds": 30,
            "maxDurationSeconds": 600,  # 10 minute max
            "backgroundSound": "off",
            "backchannelingEnabled": True,
            "metadata": {
                "sessionId": session_id,
                "userName": user_name,
                "companyName": company_intel.name if company_intel else None,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{VAPI_API_URL}/call/web",
                    headers=self._get_headers(),
                    json={
                        "assistant": assistant_config,
                    }
                )
                response.raise_for_status()
                result = response.json()

                logger.info(f"Created Vapi web call for session {session_id}: {result.get('id')}")
                return result

        except httpx.HTTPStatusError as e:
            logger.error(f"Vapi API error: {e.response.status_code} - {e.response.text}")
            return {"error": f"Vapi API error: {e.response.status_code}"}

        except Exception as e:
            logger.error(f"Error creating Vapi call: {e}")
            return {"error": str(e)}

    async def end_call(self, call_id: str) -> Dict[str, Any]:
        """End an active Vapi call."""
        if not self.api_key:
            return {"error": "Vapi API key not configured"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.patch(
                    f"{VAPI_API_URL}/call/{call_id}",
                    headers=self._get_headers(),
                    json={"status": "ended"}
                )
                response.raise_for_status()
                return response.json()

        except Exception as e:
            logger.error(f"Error ending Vapi call: {e}")
            return {"error": str(e)}

    async def get_call(self, call_id: str) -> Dict[str, Any]:
        """Get details of a Vapi call."""
        if not self.api_key:
            return {"error": "Vapi API key not configured"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{VAPI_API_URL}/call/{call_id}",
                    headers=self._get_headers(),
                )
                response.raise_for_status()
                return response.json()

        except Exception as e:
            logger.error(f"Error getting Vapi call: {e}")
            return {"error": str(e)}


# Global instance
vapi_service = VapiService()
