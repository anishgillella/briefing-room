"""
Parallel.ai service for company research.
Uses Parallel.ai's v1beta Search API to gather company information.

API Documentation: https://docs.parallel.ai/
"""
import httpx
import logging
from typing import Optional, Dict, Any, List

from config import PARALLEL_API_KEY, PARALLEL_API_URL

logger = logging.getLogger(__name__)

# Parallel.ai v1beta API endpoint
PARALLEL_V1BETA_URL = "https://api.parallel.ai/v1beta"


class ParallelAIService:
    """Service for company research via Parallel.ai web search."""

    def __init__(self):
        self.api_key = PARALLEL_API_KEY
        self.timeout = 60.0  # 60 second timeout for web searches

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with correct authentication format."""
        return {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,  # Correct auth header
            "parallel-beta": "search-extract-2025-10-10",  # Required beta header
        }

    async def search(
        self,
        objective: str,
        search_queries: List[str],
        max_results: int = 10,
        max_chars_per_result: int = 10000
    ) -> Dict[str, Any]:
        """
        Perform a web search using Parallel.ai v1beta Search API.

        Args:
            objective: Natural language description of what to find
            search_queries: List of search query strings
            max_results: Maximum number of results to return
            max_chars_per_result: Max chars for excerpts

        Returns:
            Search results from Parallel.ai
        """
        if not self.api_key:
            logger.warning("Parallel.ai API key not configured")
            return {"error": "API key not configured", "results": []}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{PARALLEL_V1BETA_URL}/search",
                    headers=self._get_headers(),
                    json={
                        "objective": objective,
                        "search_queries": search_queries,
                        "max_results": max_results,
                        "excerpts": {
                            "max_chars_per_result": max_chars_per_result
                        }
                    }
                )
                response.raise_for_status()
                return response.json()

        except httpx.TimeoutException:
            logger.error(f"Timeout searching Parallel.ai for: {objective}")
            return {"error": "Search timeout", "results": []}

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error from Parallel.ai: {e.response.status_code} - {e.response.text[:200]}")
            return {"error": f"HTTP {e.response.status_code}", "results": []}

        except Exception as e:
            logger.error(f"Error searching Parallel.ai: {e}")
            return {"error": str(e), "results": []}

    async def research_company(
        self,
        company_name: str,
        website: str
    ) -> Dict[str, Any]:
        """
        Comprehensive company research using Parallel.ai Search API.

        Gathers information about:
        - Company overview and mission
        - Funding and investors
        - Products and technology
        - Culture and recent news

        Args:
            company_name: Company name
            website: Company website URL

        Returns:
            Aggregated search results
        """
        logger.info(f"Starting company research for: {company_name}")

        # Single comprehensive search with multiple queries
        objective = (
            f"Find comprehensive information about {company_name} ({website}). "
            f"Focus on: company overview, funding/investors, products/services, "
            f"technology stack, company culture, recent news and announcements, "
            f"and any interesting facts that would help understand the company."
        )

        search_queries = [
            f"{company_name} company overview about",
            f"{company_name} funding investors valuation",
            f"{company_name} products services technology",
            f"{company_name} culture values team",
            f"{company_name} news announcements 2024 2025",
            f"site:{website}",
        ]

        results = {
            "company_name": company_name,
            "website": website,
            "search_results": [],
            "errors": [],
        }

        try:
            search_result = await self.search(
                objective=objective,
                search_queries=search_queries,
                max_results=15,
                max_chars_per_result=5000
            )

            if "error" in search_result and search_result.get("error"):
                results["errors"].append({
                    "query": "comprehensive_search",
                    "error": search_result["error"]
                })
                logger.warning(f"Search failed for {company_name}: {search_result.get('error')}")
            else:
                # Transform results to expected format
                api_results = search_result.get("results", [])
                for result in api_results:
                    results["search_results"].append({
                        "url": result.get("url", ""),
                        "title": result.get("title", ""),
                        "content": result.get("excerpt", result.get("content", "")),
                        "publish_date": result.get("publish_date"),
                    })

                logger.info(f"Company research complete for {company_name}: {len(results['search_results'])} results")

        except Exception as e:
            logger.error(f"Error in company research for {company_name}: {e}")
            results["errors"].append({
                "query": "comprehensive_search",
                "error": str(e)
            })

        return results

    async def extract_from_url(
        self,
        urls: List[str],
        objective: str
    ) -> Dict[str, Any]:
        """
        Extract content from specific URLs using Parallel.ai Extract API.

        Args:
            urls: List of URLs to extract content from
            objective: What information to extract

        Returns:
            Extracted content from URLs
        """
        if not self.api_key:
            logger.warning("Parallel.ai API key not configured")
            return {"error": "API key not configured", "results": []}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{PARALLEL_V1BETA_URL}/extract",
                    headers=self._get_headers(),
                    json={
                        "urls": urls,
                        "objective": objective,
                        "excerpts": True
                    }
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error from Parallel.ai Extract: {e.response.status_code}")
            return {"error": f"HTTP {e.response.status_code}", "results": []}

        except Exception as e:
            logger.error(f"Error extracting from URLs: {e}")
            return {"error": str(e), "results": []}


# Global instance
parallel_service = ParallelAIService()
