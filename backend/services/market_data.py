from abc import ABC, abstractmethod
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import logging
import os
import json
import random
from openai import AsyncOpenAI
import httpx

logger = logging.getLogger(__name__)

class MarketInsights(BaseModel):
    role: str
    location: str
    salary_range_low: int
    salary_range_high: int
    currency: str = "USD"
    top_skills: List[str]
    demand_level: str = Field(description="High, Medium, or Low")
    average_time_to_hire_days: int
    sources: List[str] = Field(default_factory=list)

class MarketDataProvider(ABC):
    @abstractmethod
    async def get_insights(self, role: str, location: str) -> MarketInsights:
        pass

class MockMarketDataProvider(MarketDataProvider):
    """
    Simulates market data for development.
    values are hardcoded or randomized within realistic bounds based on title keywords.
    """
    async def get_insights(self, role: str, location: str) -> MarketInsights:
        role_lower = role.lower()
        
        # Base salary logic
        base = 80000
        if "senior" in role_lower or "lead" in role_lower or "manager" in role_lower:
            base += 60000
        if "engineer" in role_lower or "developer" in role_lower:
            base += 40000
        if "director" in role_lower or "vp" in role_lower:
            base += 100000
            
        # Location adjustment (simple heuristic)
        if any(c in location.lower() for c in ["san francisco", "sf", "new york", "ny", "seattle"]):
            base = int(base * 1.3)
        
        salary_low = base
        salary_high = int(base * 1.25)
        
        # Skills logic
        skills = ["Communication", "Problem Solving"]
        if "python" in role_lower:
            skills.extend(["Django", "FastAPI", "PostgreSQL"])
        if "frontend" in role_lower or "react" in role_lower:
            skills.extend(["React", "TypeScript", "Tailwind CSS"])
        if "marketing" in role_lower:
            skills.extend(["SEO", "Content Strategy", "Google Analytics"])
        if "product" in role_lower:
            skills.extend(["User Research", "Roadmapping", "Jira"])

        return MarketInsights(
            role=role,
            location=location,
            salary_range_low=salary_low,
            salary_range_high=salary_high,
            top_skills=skills[:5],
            demand_level="High" if "engineer" in role_lower else "Medium",
            average_time_to_hire_days=45 if "engineer" in role_lower else 30,
            sources=["Simulated Market Data (Mock)"]
        )

class WebSearchMarketProvider(MarketDataProvider):
    """
    Uses SerpApi (Google Search) to find real salary data.
    Requires SERPAPI_KEY in environment.
    """
    def __init__(self):
        self.api_key = os.getenv("SERPAPI_KEY")
        self.client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY")
        )
        self.model = os.getenv("LLM_MODEL", "google/gemini-2.5-flash")
    
    async def get_insights(self, role: str, location: str) -> MarketInsights:
        import httpx
        
        if not self.api_key:
            logger.error("SERPAPI_KEY is missing but WebSearchMarketProvider was requested.")
            # Return a special "Data Unavailable" object or raise error.
            # User said: "return that I couldn't access the data"
            # We'll return a zeroed out object with sources indicating failure for UI to handle.
            return MarketInsights(
                role=role,
                location=location,
                salary_range_low=0,
                salary_range_high=0,
                top_skills=[],
                demand_level="Unknown",
                average_time_to_hire_days=0,
                sources=["Error: Configuration Missing (SERPAPI_KEY)"]
            )
            
        # 1. Search Query
        query = f"average salary {role} {location} 2025"
        search_url = "https://serpapi.com/search"
        params = {
            "engine": "google",
            "q": query,
            "api_key": self.api_key,
            "hl": "en",
            "gl": "us" # default to US for now
        }
        
        try:
            async with httpx.AsyncClient() as http_client:
                resp = await http_client.get(search_url, params=params, timeout=10.0)
                resp.raise_for_status()
                data = resp.json()
                
            # 2. Extract Snippets
            snippets = []
            
            # Answer Box (High value)
            if "answer_box" in data:
                snippets.append(f"Answer Box: {json.dumps(data['answer_box'])}")
                
            # Organic Results
            organic = data.get("organic_results", [])
            for res in organic[:4]: # Top 4 results
                title = res.get("title", "")
                snippet = res.get("snippet", "")
                snippets.append(f"Source: {title} - {snippet}")
                
            full_text = "\n".join(snippets)
            if not full_text:
                raise ValueError("No search results found")
                
            # 3. Use LLM to Extract Structured Data
            extraction_prompt = f"""
            Analyze these search results for "{role}" in "{location}":
            {full_text}
            
            Extract the following market insights in JSON format:
            - salary_range_low (integer, annual USD)
            - salary_range_high (integer, annual USD)
            - top_skills (list of strings)
            - demand_level (High/Medium/Low)
            - average_time_to_hire_days (integer estimate, default to 45 if unknown)
            
            If data is missing, make a reasonable estimate based on the role seniority.
            """
            
            llm_response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a data extraction assistant. Output only JSON."},
                    {"role": "user", "content": extraction_prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            content = llm_response.choices[0].message.content
            parsed = json.loads(content)
            
            return MarketInsights(
                role=role,
                location=location,
                # Ensure keys exist with defaults
                salary_range_low=parsed.get("salary_range_low", 0),
                salary_range_high=parsed.get("salary_range_high", 0),
                top_skills=parsed.get("top_skills", []),
                demand_level=parsed.get("demand_level", "Medium"),
                average_time_to_hire_days=parsed.get("average_time_to_hire_days", 45),
                sources=["SerpApi (Google Search)"]
            )
            
        except Exception as e:
            logger.error(f"Search/Extraction failed: {e}")
            return MarketInsights(
                role=role,
                location=location,
                salary_range_low=0,
                salary_range_high=0,
                top_skills=[],
                demand_level="Unknown",
                average_time_to_hire_days=0,
                sources=[f"Error accessing market data: {str(e)}"]
            )

def get_market_data_service() -> MarketDataProvider:
    """Factory to get the configured provider."""
    # Always return WebSearch provider as requested by user.
    # It handles its own fallback/error states if key is missing.
    return WebSearchMarketProvider()
