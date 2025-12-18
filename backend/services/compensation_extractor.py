"""
Compensation Extractor service.
Extracts structured CompensationData from raw Parallel.ai search results.
Uses LLM via OpenRouter for extraction.
"""
import httpx
import json
import logging
from typing import Dict, Any, Optional

from config import OPENROUTER_API_KEY, LLM_MODEL
from models.compensation import CompensationData

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class CompensationExtractor:
    """Extract structured compensation data from raw search results."""

    def __init__(self):
        self.api_key = OPENROUTER_API_KEY
        self.model = LLM_MODEL
        self.timeout = 45.0

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers for OpenRouter."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://briefingroom.ai",
            "X-Title": "Briefing Room Compensation Research",
        }

    async def extract(
        self,
        raw_results: Dict[str, Any]
    ) -> CompensationData:
        """
        Extract structured CompensationData from raw search results.

        Args:
            raw_results: Raw results from ParallelAIService.research_compensation()

        Returns:
            Structured CompensationData model
        """
        role_title = raw_results.get("role_title", "Unknown")
        location = raw_results.get("location", "Unknown")
        company_stage = raw_results.get("company_stage")
        industry = raw_results.get("industry")

        if not self.api_key:
            logger.warning("OpenRouter API key not configured, returning minimal data")
            return CompensationData(
                role_title=role_title,
                location=location,
                company_stage=company_stage,
                industry=industry,
            )

        # Prepare search results for the prompt
        search_results = raw_results.get("search_results", [])
        search_content = json.dumps(search_results, indent=2)[:20000]  # Limit to ~20k chars

        # Check if search results are empty - use LLM knowledge
        if not search_results or len(search_results) == 0:
            logger.info(f"No search results for {role_title}, using LLM knowledge")
            prompt = self._build_knowledge_extraction_prompt(
                role_title=role_title,
                location=location,
                company_stage=company_stage,
                industry=industry
            )
        else:
            prompt = self._build_extraction_prompt(
                role_title=role_title,
                location=location,
                company_stage=company_stage,
                industry=industry,
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
                        "temperature": 0.3,
                    }
                )
                response.raise_for_status()
                result = response.json()

            # Parse the response
            content = result["choices"][0]["message"]["content"]
            data = json.loads(content)

            # Build and return CompensationData
            return self._build_compensation_data(data, role_title, location, company_stage, industry)

        except httpx.TimeoutException:
            logger.error("Timeout extracting compensation data")
            return self._fallback_data(role_title, location, company_stage, industry)

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in extraction: {e}")
            return self._fallback_data(role_title, location, company_stage, industry)

        except Exception as e:
            logger.error(f"Error extracting compensation data: {e}")
            return self._fallback_data(role_title, location, company_stage, industry)

    def _build_knowledge_extraction_prompt(
        self,
        role_title: str,
        location: str,
        company_stage: Optional[str],
        industry: Optional[str]
    ) -> str:
        """Build prompt for LLM knowledge-based extraction."""
        stage_context = f" at {company_stage} companies" if company_stage else ""
        industry_context = f" in the {industry} industry" if industry else ""

        return f"""
You are a compensation expert providing market salary data based on your training knowledge.
This is for a recruiting tool to help with offer negotiation.

Role: {role_title}
Location: {location}
Company Stage: {company_stage or "Not specified"}
Industry: {industry or "Not specified"}

Based on your knowledge of compensation trends (as of 2024-2025), provide salary data for
{role_title} roles{stage_context}{industry_context} in {location}.

Return a JSON object with this exact structure:
{{
    "salary_min": <integer in USD or null>,
    "salary_median": <integer in USD or null>,
    "salary_max": <integer in USD or null>,
    "salary_percentile_25": <integer in USD or null>,
    "salary_percentile_75": <integer in USD or null>,
    "equity_min_percent": <float like 0.05 for 0.05% or null>,
    "equity_max_percent": <float or null>,
    "equity_typical_percent": <float or null>,
    "vesting_standard": "4 years with 1 year cliff" or other standard,
    "bonus_target_percent": <float like 10 for 10% or null>,
    "signing_bonus_range": "$10K - $30K" format or null,
    "market_trend": "rising" / "stable" / "declining" or null,
    "talent_availability": "scarce" / "competitive" / "abundant" or null,
    "confidence_level": "high" / "medium" / "low",
    "data_sources": ["LLM knowledge - 2024 training data"]
}}

Important:
- Use realistic numbers based on actual market data
- For tech roles in SF/NYC, salaries are typically higher
- Startups (Seed/Series A) typically offer more equity but lower base
- Public/late-stage companies offer higher base but less equity upside
- If uncertain, err on the side of conservative estimates
"""

    def _build_extraction_prompt(
        self,
        role_title: str,
        location: str,
        company_stage: Optional[str],
        industry: Optional[str],
        search_content: str
    ) -> str:
        """Build prompt for extraction from search results."""
        return f"""
You are extracting structured compensation data from web search results.

Role: {role_title}
Location: {location}
Company Stage: {company_stage or "Not specified"}
Industry: {industry or "Not specified"}

Search Results:
{search_content}

Extract compensation information from these results. Look for:
- Salary ranges and medians
- Equity percentages for different company stages
- Bonus structures
- Market trends

Return a JSON object with this exact structure:
{{
    "salary_min": <integer in USD or null>,
    "salary_median": <integer in USD or null>,
    "salary_max": <integer in USD or null>,
    "salary_percentile_25": <integer in USD or null>,
    "salary_percentile_75": <integer in USD or null>,
    "equity_min_percent": <float like 0.05 for 0.05% or null>,
    "equity_max_percent": <float or null>,
    "equity_typical_percent": <float or null>,
    "vesting_standard": "4 years with 1 year cliff" or other standard or null,
    "bonus_target_percent": <float like 10 for 10% or null>,
    "signing_bonus_range": "$10K - $30K" format or null,
    "market_trend": "rising" / "stable" / "declining" or null,
    "talent_availability": "scarce" / "competitive" / "abundant" or null,
    "confidence_level": "high" / "medium" / "low",
    "sample_size_estimate": "based on X data points" or null,
    "data_sources": ["levels.fyi", "glassdoor", etc. - list sources found]
}}

Important:
- Extract ONLY what is stated in the search results
- Convert all salaries to annual USD amounts
- Use null for fields with no clear data
- For percentiles, estimate based on ranges if not explicitly stated
- confidence_level should reflect how much data was available
"""

    def _build_compensation_data(
        self,
        data: Dict[str, Any],
        role_title: str,
        location: str,
        company_stage: Optional[str],
        industry: Optional[str]
    ) -> CompensationData:
        """Build CompensationData from extracted data."""
        return CompensationData(
            role_title=role_title,
            location=location,
            company_stage=company_stage,
            industry=industry,
            salary_min=data.get("salary_min"),
            salary_median=data.get("salary_median"),
            salary_max=data.get("salary_max"),
            salary_percentile_25=data.get("salary_percentile_25"),
            salary_percentile_75=data.get("salary_percentile_75"),
            equity_min_percent=data.get("equity_min_percent"),
            equity_max_percent=data.get("equity_max_percent"),
            equity_typical_percent=data.get("equity_typical_percent"),
            vesting_standard=data.get("vesting_standard"),
            bonus_target_percent=data.get("bonus_target_percent"),
            signing_bonus_range=data.get("signing_bonus_range"),
            market_trend=data.get("market_trend"),
            talent_availability=data.get("talent_availability"),
            data_sources=data.get("data_sources") or [],
            confidence_level=data.get("confidence_level"),
            sample_size_estimate=data.get("sample_size_estimate"),
        )

    def _fallback_data(
        self,
        role_title: str,
        location: str,
        company_stage: Optional[str],
        industry: Optional[str]
    ) -> CompensationData:
        """Return minimal data on extraction failure."""
        return CompensationData(
            role_title=role_title,
            location=location,
            company_stage=company_stage,
            industry=industry,
            confidence_level="low",
            data_sources=["extraction_failed"],
        )


# Global instance
compensation_extractor = CompensationExtractor()
