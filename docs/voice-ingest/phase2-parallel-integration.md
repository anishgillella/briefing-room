# Phase 2: Parallel.ai Integration

## Overview

Integrate Parallel.ai to research company information before the voice conversation starts. This enriches the agent's context so it sounds informed and can ask relevant questions.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PARALLEL.AI INTEGRATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User submits intake form                                                │
│     { firstName, lastName, company, website }                               │
│              │                                                              │
│              ▼                                                              │
│  2. Backend creates session, triggers Parallel.ai (async)                   │
│              │                                                              │
│              ├──────────────────────────────────┐                           │
│              │                                  │                           │
│              ▼                                  ▼                           │
│  3. User proceeds to JD input          Parallel.ai searches:                │
│     (doesn't wait)                     • Company website                    │
│                                        • Crunchbase                         │
│                                        • LinkedIn company page              │
│                                        • Recent news                        │
│                                        • Glassdoor                          │
│                                                 │                           │
│                                                 ▼                           │
│                                        4. Raw results → Pydantic extraction │
│                                           → CompanyIntelligence model       │
│                                                 │                           │
│              ◄──────────────────────────────────┘                           │
│              │                                                              │
│              ▼                                                              │
│  5. Voice agent receives enriched context                                   │
│     (company intel merged with any JD extraction)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Start Onboarding Session

```python
# POST /api/voice-ingest/start
# Creates session and triggers Parallel.ai search

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, HttpUrl
import uuid

router = APIRouter(prefix="/api/voice-ingest", tags=["voice-ingest"])


class StartSessionRequest(BaseModel):
    first_name: str
    last_name: str
    company_name: str
    company_website: HttpUrl


class StartSessionResponse(BaseModel):
    session_id: str
    status: str
    message: str


@router.post("/start", response_model=StartSessionResponse)
async def start_session(
    request: StartSessionRequest,
    background_tasks: BackgroundTasks
):
    """Create onboarding session and trigger company research"""

    session_id = str(uuid.uuid4())

    # Create initial job profile
    profile = JobProfile(
        id=session_id,
        recruiter_first_name=request.first_name,
        recruiter_last_name=request.last_name,
        company=CompanyIntelligence(
            name=request.company_name,
            website=str(request.company_website)
        ),
        requirements=HardRequirements(job_title="")  # To be filled
    )

    # Save to database
    await save_job_profile(profile)

    # Trigger Parallel.ai search in background
    background_tasks.add_task(
        research_company,
        session_id=session_id,
        company_name=request.company_name,
        website=str(request.company_website)
    )

    return StartSessionResponse(
        session_id=session_id,
        status="created",
        message="Session created. Company research started in background."
    )
```

### Get Company Research Status

```python
# GET /api/voice-ingest/{session_id}/company-intel
# Poll for Parallel.ai results

class CompanyIntelResponse(BaseModel):
    status: str  # "pending", "complete", "failed"
    company_intel: Optional[CompanyIntelligence] = None
    error: Optional[str] = None


@router.get("/{session_id}/company-intel", response_model=CompanyIntelResponse)
async def get_company_intel(session_id: str):
    """Get company research results"""

    profile = await get_job_profile(session_id)

    if not profile:
        raise HTTPException(404, "Session not found")

    # Check if research is complete
    research_status = await get_research_status(session_id)

    if research_status == "pending":
        return CompanyIntelResponse(status="pending")

    if research_status == "failed":
        return CompanyIntelResponse(
            status="failed",
            error="Company research failed. Proceeding with limited context."
        )

    return CompanyIntelResponse(
        status="complete",
        company_intel=profile.company
    )
```

---

## Parallel.ai Service

```python
# backend/services/parallel_ai.py

import httpx
import os
from typing import Optional
from models.voice_ingest import CompanyIntelligence

PARALLEL_API_URL = "https://api.parallel.ai/v1/search"
PARALLEL_API_KEY = os.getenv("PARALLEL_API_KEY")


class ParallelAIService:
    """Service for company research via Parallel.ai"""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=60.0,
            headers={"Authorization": f"Bearer {PARALLEL_API_KEY}"}
        )

    async def research_company(
        self,
        company_name: str,
        website: str
    ) -> dict:
        """
        Search for company information across the web.
        Returns raw search results.
        """

        # Build search query
        queries = [
            f"{company_name} company overview funding investors",
            f"site:{website}",
            f"{company_name} Crunchbase funding",
            f"{company_name} engineering blog tech stack",
            f"{company_name} Glassdoor reviews culture",
            f"{company_name} recent news funding announcement"
        ]

        results = []

        for query in queries:
            try:
                response = await self.client.post(
                    PARALLEL_API_URL,
                    json={
                        "query": query,
                        "max_results": 5,
                        "include_content": True
                    }
                )
                response.raise_for_status()
                results.append(response.json())
            except Exception as e:
                print(f"Parallel.ai search failed for query '{query}': {e}")
                continue

        return {
            "company_name": company_name,
            "website": website,
            "search_results": results
        }


parallel_service = ParallelAIService()
```

---

## Extraction Service (Raw → Structured)

```python
# backend/services/company_extractor.py

import httpx
import os
import json
from models.voice_ingest import CompanyIntelligence

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class CompanyExtractor:
    """Extract structured company info from raw Parallel.ai results"""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            }
        )

    async def extract(self, raw_results: dict) -> CompanyIntelligence:
        """
        Use Gemini 2.5 Flash to extract structured data
        from raw Parallel.ai results.
        """

        prompt = f"""
You are extracting structured company information from web search results.

Company: {raw_results['company_name']}
Website: {raw_results['website']}

Search Results:
{json.dumps(raw_results['search_results'], indent=2)[:15000]}

Extract the following information. If not found, use null.
Be conservative - only include information that is clearly stated.

Return a JSON object with this exact structure:
{{
    "name": "Company name",
    "website": "https://...",
    "tagline": "One-liner from website or null",
    "funding_stage": "seed/series_a/series_b/series_c/series_d_plus/public/bootstrapped or null",
    "total_raised": "$XM format or null",
    "last_round_date": "Month Year or null",
    "investors": ["List", "of", "investors"],
    "product_description": "What they build (1-2 sentences) or null",
    "problem_solved": "Why it matters (1 sentence) or null",
    "target_customers": "Who buys it or null",
    "industry": "e.g., Dev tools, Fintech, or null",
    "founders": ["Founder names"],
    "founder_backgrounds": "e.g., Ex-Google, Ex-Stripe or null",
    "team_size": "e.g., 50-100 or null",
    "headquarters": "City, State or null",
    "office_locations": ["List of office cities"],
    "competitors": ["Competitor names"],
    "differentiators": "What makes them unique or null",
    "recent_news": ["Up to 3 recent headlines"],
    "hiring_signals": "e.g., Hiring aggressively or null",
    "tech_stack_hints": ["Technologies mentioned in job posts or blog"],
    "culture_keywords": ["e.g., Remote-first, Move fast"],
    "glassdoor_sentiment": "Positive/Mixed/Negative or null",
    "interesting_facts": ["2-3 interesting facts for conversation"],
    "potential_selling_points": ["2-3 reasons candidates would want this job"]
}}
"""

        response = await self.client.post(
            OPENROUTER_URL,
            json={
                "model": "google/gemini-2.5-flash-preview",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.3
            }
        )

        response.raise_for_status()
        result = response.json()

        # Parse the JSON response
        content = result["choices"][0]["message"]["content"]
        data = json.loads(content)

        # Validate with Pydantic
        return CompanyIntelligence(**data)


extractor = CompanyExtractor()
```

---

## Background Task: Full Research Pipeline

```python
# backend/services/research_pipeline.py

from services.parallel_ai import parallel_service
from services.company_extractor import extractor
from repositories.job_profile_repository import job_profile_repo


async def research_company(
    session_id: str,
    company_name: str,
    website: str
):
    """
    Full pipeline: Parallel.ai search → Pydantic extraction → Save
    Runs as background task.
    """

    try:
        # Mark research as in-progress
        await job_profile_repo.update_research_status(session_id, "in_progress")

        # Step 1: Search via Parallel.ai
        raw_results = await parallel_service.research_company(
            company_name=company_name,
            website=website
        )

        # Step 2: Extract structured data
        company_intel = await extractor.extract(raw_results)

        # Step 3: Update job profile with enriched company data
        await job_profile_repo.update_company_intel(session_id, company_intel)

        # Mark research as complete
        await job_profile_repo.update_research_status(session_id, "complete")

        print(f"Company research complete for session {session_id}")

    except Exception as e:
        print(f"Company research failed for session {session_id}: {e}")
        await job_profile_repo.update_research_status(session_id, "failed")
```

---

## Frontend Integration

### Intake Form Component

```tsx
// frontend/src/components/voice-ingest/IntakeForm.tsx

import { useState } from 'react';
import { motion } from 'framer-motion';

interface IntakeFormProps {
  onSessionCreated: (sessionId: string) => void;
}

export function IntakeForm({ onSessionCreated }: IntakeFormProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    companyWebsite: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/voice-ingest/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          company_name: formData.companyName,
          company_website: formData.companyWebsite
        })
      });

      const data = await response.json();
      onSessionCreated(data.session_id);
    } catch (error) {
      console.error('Failed to start session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto"
    >
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-800">
        <h2 className="text-2xl font-semibold text-white mb-6">
          Let's build your hiring profile
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  firstName: e.target.value
                }))}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-violet-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  lastName: e.target.value
                }))}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-violet-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                companyName: e.target.value
              }))}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-violet-500 focus:outline-none"
              placeholder="Acme Inc"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Company Website
            </label>
            <input
              type="url"
              value={formData.companyWebsite}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                companyWebsite: e.target.value
              }))}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-violet-500 focus:outline-none"
              placeholder="https://acme.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium py-3 rounded-lg hover:from-violet-500 hover:to-violet-400 transition-all disabled:opacity-50"
          >
            {isLoading ? 'Starting...' : 'Continue'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
```

### Company Research Loading State

```tsx
// frontend/src/components/voice-ingest/CompanyResearchStatus.tsx

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface CompanyResearchStatusProps {
  sessionId: string;
  companyName: string;
  onComplete: (intel: CompanyIntelligence) => void;
}

export function CompanyResearchStatus({
  sessionId,
  companyName,
  onComplete
}: CompanyResearchStatusProps) {
  const [status, setStatus] = useState<'pending' | 'complete' | 'failed'>('pending');
  const [dots, setDots] = useState('');

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Poll for results
  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/voice-ingest/${sessionId}/company-intel`
        );
        const data = await response.json();

        if (data.status === 'complete') {
          setStatus('complete');
          onComplete(data.company_intel);
        } else if (data.status === 'failed') {
          setStatus('failed');
        }
      } catch (error) {
        console.error('Poll failed:', error);
      }
    };

    if (status === 'pending') {
      const interval = setInterval(poll, 2000);
      poll(); // Initial check
      return () => clearInterval(interval);
    }
  }, [sessionId, status, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 text-slate-400"
    >
      {status === 'pending' && (
        <>
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span>Researching {companyName}{dots}</span>
        </>
      )}

      {status === 'complete' && (
        <>
          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-emerald-400">Company research complete</span>
        </>
      )}

      {status === 'failed' && (
        <>
          <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs">!</span>
          </div>
          <span className="text-amber-400">Research limited - proceeding anyway</span>
        </>
      )}
    </motion.div>
  );
}
```

---

## Environment Variables

```bash
# .env

# Parallel.ai
PARALLEL_API_KEY=your_parallel_api_key_here

# OpenRouter (for extraction)
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

---

## Error Handling

1. **Parallel.ai timeout**: Proceed without company intel, agent asks more questions
2. **Extraction failure**: Use raw company name/website, log error
3. **Partial results**: Use what we got, mark low-confidence fields

```python
async def research_company_with_fallback(
    session_id: str,
    company_name: str,
    website: str
):
    """Research with graceful degradation"""

    try:
        await research_company(session_id, company_name, website)
    except Exception as e:
        print(f"Full research failed: {e}")

        # Fallback: minimal company intel
        fallback_intel = CompanyIntelligence(
            name=company_name,
            website=website,
            interesting_facts=[f"Visit {website} for more information"],
            potential_selling_points=["Growing company with exciting opportunities"]
        )

        await job_profile_repo.update_company_intel(session_id, fallback_intel)
        await job_profile_repo.update_research_status(session_id, "partial")
```

---

## Next Phase

[Phase 3: JD Extraction](./phase3-jd-extraction.md) - Structured extraction from pasted JD text
