"""
Company Extractor service.
Extracts structured CompanyIntelligence from raw Parallel.ai search results.
Uses Gemini 2.5 Flash via OpenRouter for extraction.
"""
import httpx
import json
import logging
from typing import Dict, Any, Optional

from config import OPENROUTER_API_KEY, LLM_MODEL
from models.voice_ingest import CompanyIntelligence
from models.voice_ingest.enums import FundingStage

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class CompanyExtractor:
    """Extract structured company info from raw Parallel.ai results."""

    def __init__(self):
        self.api_key = OPENROUTER_API_KEY
        self.model = LLM_MODEL
        self.timeout = 30.0

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers for OpenRouter."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://briefingroom.ai",
            "X-Title": "Briefing Room Voice Ingest",
        }

    async def extract(
        self,
        raw_results: Dict[str, Any]
    ) -> CompanyIntelligence:
        """
        Extract structured CompanyIntelligence from raw search results.

        Args:
            raw_results: Raw results from ParallelAIService.research_company()

        Returns:
            Structured CompanyIntelligence model
        """
        company_name = raw_results.get("company_name", "Unknown")
        website = raw_results.get("website", "")

        if not self.api_key:
            logger.warning("OpenRouter API key not configured, returning minimal data")
            return CompanyIntelligence(
                name=company_name,
                website=website,
            )

        # Prepare search results for the prompt (truncate to avoid token limits)
        search_results = raw_results.get("search_results", [])
        search_content = json.dumps(search_results, indent=2)[:15000]  # Limit to ~15k chars

        # Check if search results are empty - use knowledge-based extraction instead
        if not search_results or len(search_results) == 0:
            logger.info(f"No search results for {company_name}, using LLM knowledge-based extraction")
            prompt = self._build_knowledge_extraction_prompt(company_name, website)
        else:
            prompt = self._build_extraction_prompt(
                company_name=company_name,
                website=website,
                search_content=search_content
            )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    OPENROUTER_URL,
                    headers=self._get_headers(),
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.3,  # Low temp for extraction
                    }
                )
                response.raise_for_status()
                result = response.json()

            # Parse the response
            content = result["choices"][0]["message"]["content"]
            data = json.loads(content)

            # Build and return CompanyIntelligence
            return self._build_company_intelligence(data, company_name, website)

        except httpx.TimeoutException:
            logger.error("Timeout extracting company data")
            return self._fallback_company(company_name, website)

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in extraction: {e}")
            return self._fallback_company(company_name, website)

        except Exception as e:
            logger.error(f"Error extracting company data: {e}")
            return self._fallback_company(company_name, website)

    def _build_knowledge_extraction_prompt(
        self,
        company_name: str,
        website: str
    ) -> str:
        """
        Build a prompt that asks the LLM to use its training knowledge
        about the company (for when web search fails).
        """
        return f"""
You are providing information about a company based on your training knowledge.
This is for a recruiting tool to help build job profiles.

Company: {company_name}
Website: {website}

Based on your knowledge of this company (from your training data), provide information.
If you genuinely know facts about this company from your training, include them.
If you don't have specific knowledge about this company, provide reasonable inferences
based on the website domain and company name, but mark uncertain items clearly.

IMPORTANT: For well-known companies (like Ramp, Stripe, Airbnb, etc.), you likely have
substantial knowledge - please share it! For lesser-known companies, be honest about
what you don't know.

Return a JSON object with this exact structure:
{{
    "name": "{company_name}",
    "website": "{website}",
    "tagline": "One-liner describing the company or null",
    "funding_stage": "pre_seed/seed/series_a/series_b/series_c/series_d_plus/public/bootstrapped/unknown or null",
    "total_raised": "$XM format or null",
    "last_round_date": "Month Year format or null",
    "investors": ["List", "of", "investors"] or [],
    "product_description": "What they build (1-2 sentences) or null",
    "problem_solved": "Why it matters (1 sentence) or null",
    "target_customers": "Who buys their product or null",
    "industry": "Industry category like 'Dev tools', 'Fintech', 'Healthcare' or null",
    "founders": ["Founder names"] or [],
    "founder_backgrounds": "Notable backgrounds like 'Ex-Google, Ex-Stripe' or null",
    "team_size": "Estimate like '50-100' or null",
    "headquarters": "City, State or City, Country or null",
    "office_locations": ["List of cities with offices"] or [],
    "competitors": ["Competitor company names"] or [],
    "differentiators": "What makes them unique vs competitors or null",
    "recent_news": ["Up to 3 headlines you know about"] or [],
    "hiring_signals": "Signals like 'Hiring aggressively', 'Opened new office' or null",
    "tech_stack_hints": ["Technologies they likely use"] or [],
    "culture_keywords": ["Culture indicators"] or [],
    "glassdoor_sentiment": null,
    "interesting_facts": ["2-3 interesting facts that would impress someone in conversation"] or [],
    "potential_selling_points": ["2-3 reasons candidates would want to work here"] or []
}}

Important:
- Use your actual knowledge about well-known companies
- For companies you know well, be specific and detailed
- For unknown companies, use null rather than making things up
- interesting_facts should be genuinely interesting conversation starters
- This data will be used to make a voice agent sound knowledgeable
"""

    def _build_extraction_prompt(
        self,
        company_name: str,
        website: str,
        search_content: str
    ) -> str:
        """Build the extraction prompt for the LLM."""
        return f"""
You are extracting structured company information from web search results.

Company: {company_name}
Website: {website}

Search Results:
{search_content}

Extract the following information. If not found, use null.
Be conservative - only include information that is clearly stated.
Do NOT make up or infer information that isn't in the search results.

Return a JSON object with this exact structure:
{{
    "name": "Company name",
    "website": "{website}",
    "tagline": "One-liner describing the company or null",
    "funding_stage": "pre_seed/seed/series_a/series_b/series_c/series_d_plus/public/bootstrapped/unknown or null",
    "total_raised": "$XM format or null",
    "last_round_date": "Month Year format or null",
    "investors": ["List", "of", "investors"] or [],
    "product_description": "What they build (1-2 sentences) or null",
    "problem_solved": "Why it matters (1 sentence) or null",
    "target_customers": "Who buys their product or null",
    "industry": "Industry category like 'Dev tools', 'Fintech', 'Healthcare' or null",
    "founders": ["Founder names"] or [],
    "founder_backgrounds": "Notable backgrounds like 'Ex-Google, Ex-Stripe' or null",
    "team_size": "Estimate like '50-100' or null",
    "headquarters": "City, State or City, Country or null",
    "office_locations": ["List of cities with offices"] or [],
    "competitors": ["Competitor company names"] or [],
    "differentiators": "What makes them unique vs competitors or null",
    "recent_news": ["Up to 3 recent headlines or announcements"] or [],
    "hiring_signals": "Signals like 'Hiring aggressively', 'Opened new office' or null",
    "tech_stack_hints": ["Technologies mentioned in job posts or blog"] or [],
    "culture_keywords": ["Culture indicators like 'Remote-first', 'Move fast', 'Engineering-driven'"] or [],
    "glassdoor_sentiment": "Positive/Mixed/Negative based on reviews or null",
    "interesting_facts": ["2-3 interesting facts useful for conversation"] or [],
    "potential_selling_points": ["2-3 reasons candidates would want to work here"] or []
}}

Important:
- Extract ONLY what is clearly stated in the search results
- Use null for fields with no information, not empty strings
- Keep descriptions concise (1-2 sentences max)
- For funding_stage, map to the closest enum value
- interesting_facts and potential_selling_points should be conversation starters
"""

    def _build_company_intelligence(
        self,
        data: Dict[str, Any],
        company_name: str,
        website: str
    ) -> CompanyIntelligence:
        """Build CompanyIntelligence from extracted data."""
        # Parse funding stage
        funding_stage = None
        if data.get("funding_stage"):
            try:
                funding_stage = FundingStage(data["funding_stage"])
            except ValueError:
                funding_stage = FundingStage.UNKNOWN

        return CompanyIntelligence(
            name=data.get("name") or company_name,
            website=data.get("website") or website,
            tagline=data.get("tagline"),
            funding_stage=funding_stage,
            total_raised=data.get("total_raised"),
            last_round_date=data.get("last_round_date"),
            investors=data.get("investors") or [],
            product_description=data.get("product_description"),
            problem_solved=data.get("problem_solved"),
            target_customers=data.get("target_customers"),
            industry=data.get("industry"),
            founders=data.get("founders") or [],
            founder_backgrounds=data.get("founder_backgrounds"),
            team_size=data.get("team_size"),
            headquarters=data.get("headquarters"),
            office_locations=data.get("office_locations") or [],
            competitors=data.get("competitors") or [],
            differentiators=data.get("differentiators"),
            recent_news=data.get("recent_news") or [],
            hiring_signals=data.get("hiring_signals"),
            tech_stack_hints=data.get("tech_stack_hints") or [],
            culture_keywords=data.get("culture_keywords") or [],
            glassdoor_sentiment=data.get("glassdoor_sentiment"),
            interesting_facts=data.get("interesting_facts") or [],
            potential_selling_points=data.get("potential_selling_points") or [],
        )

    def _fallback_company(
        self,
        company_name: str,
        website: str
    ) -> CompanyIntelligence:
        """Return minimal company data on extraction failure."""
        return CompanyIntelligence(
            name=company_name,
            website=website,
            interesting_facts=[f"Visit {website} for more information"],
            potential_selling_points=["Growing company with exciting opportunities"],
        )


# Global instance
company_extractor = CompanyExtractor()
