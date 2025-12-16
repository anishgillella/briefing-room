# Phase 3: JD Extraction

## Overview

When users paste a job description, extract all possible structured data using Gemini 2.5 Flash with Pydantic structured outputs. Identify gaps that the voice agent will need to fill.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        JD EXTRACTION FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User pastes JD text                                                        │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  EXTRACTION PIPELINE                                                │    │
│  │                                                                     │    │
│  │  1. Pre-process text (clean, normalize)                             │    │
│  │  2. Send to Gemini 2.5 Flash with structured output schema          │    │
│  │  3. Parse response into Pydantic models                             │    │
│  │  4. Calculate confidence scores per field                           │    │
│  │  5. Identify missing required fields                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  RESPONSE                                                           │    │
│  │                                                                     │    │
│  │  extracted: JobProfile (partial)                                    │    │
│  │  confidence: { field → score }                                      │    │
│  │  missing_fields: ["visa", "equity", ...]                            │    │
│  │  suggested_questions: ["Do you sponsor visas?", ...]                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                   │
│         ▼                                                                   │
│  Voice agent receives extracted data + gaps                                 │
│  → Only asks about missing fields                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoint

```python
# POST /api/voice-ingest/{session_id}/parse-jd

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional

router = APIRouter(prefix="/api/voice-ingest", tags=["voice-ingest"])


class ParseJDRequest(BaseModel):
    jd_text: str


class ParseJDResponse(BaseModel):
    success: bool
    extracted: Dict  # Partial JobProfile as dict
    confidence_scores: Dict[str, float]
    missing_required: List[str]
    missing_optional: List[str]
    suggested_questions: List[str]
    extraction_summary: str


@router.post("/{session_id}/parse-jd", response_model=ParseJDResponse)
async def parse_jd(session_id: str, request: ParseJDRequest):
    """
    Extract structured data from pasted JD text.
    Updates session profile and returns gaps for voice agent.
    """

    # Validate session exists
    profile = await get_job_profile(session_id)
    if not profile:
        raise HTTPException(404, "Session not found")

    # Get company intel for context
    company_intel = profile.company

    # Extract from JD
    extraction_result = await jd_extractor.extract(
        jd_text=request.jd_text,
        company_context=company_intel
    )

    # Merge with existing profile
    updated_profile = merge_extraction(profile, extraction_result)

    # Save updated profile
    await save_job_profile(updated_profile)

    # Calculate gaps
    missing_required = updated_profile.get_missing_fields()
    missing_optional = get_optional_missing_fields(updated_profile)

    # Generate questions for gaps
    suggested_questions = generate_gap_questions(
        missing_required=missing_required,
        missing_optional=missing_optional,
        company_context=company_intel
    )

    return ParseJDResponse(
        success=True,
        extracted=extraction_result.dict(),
        confidence_scores=extraction_result.field_confidence,
        missing_required=missing_required,
        missing_optional=missing_optional,
        suggested_questions=suggested_questions,
        extraction_summary=generate_summary(extraction_result)
    )
```

---

## JD Extractor Service

```python
# backend/services/jd_extractor.py

import httpx
import json
from typing import Optional
from models.voice_ingest import (
    JobProfile, HardRequirements, CandidateTrait,
    InterviewStage, CompanyIntelligence, TraitPriority
)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class JDExtractor:
    """Extract structured job profile from JD text"""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=60.0,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            }
        )

    async def extract(
        self,
        jd_text: str,
        company_context: Optional[CompanyIntelligence] = None
    ) -> JobProfile:
        """
        Extract all possible fields from JD text.
        Uses Gemini 2.5 Flash with structured output.
        """

        company_hint = ""
        if company_context:
            company_hint = f"""
Company Context (from web research):
- Name: {company_context.name}
- Industry: {company_context.industry or 'Unknown'}
- Stage: {company_context.funding_stage or 'Unknown'}
- Product: {company_context.product_description or 'Unknown'}
"""

        prompt = f"""
You are extracting structured information from a job description.
Extract ALL information that is explicitly stated or clearly implied.
Do NOT make up information. If something is not mentioned, use null.

{company_hint}

Job Description:
---
{jd_text}
---

Extract into this JSON structure:

{{
    "requirements": {{
        "job_title": "Exact title from JD",
        "location_type": "onsite/hybrid/remote or null if not stated",
        "location_city": "City name or null",
        "onsite_days_per_week": "Number 0-5 or null",
        "timezone_requirements": "e.g., 'PST hours' or null",
        "visa_sponsorship": "true/false or null if not stated",
        "work_authorization_notes": "Any notes about work auth or null",
        "experience_min_years": "Number or null",
        "experience_max_years": "Number or null",
        "salary_min": "Number (USD annual) or null",
        "salary_max": "Number (USD annual) or null",
        "equity_offered": "true/false or null",
        "equity_range": "e.g., '0.1-0.25%' or null",
        "bonus_structure": "Description or null"
    }},
    "traits": [
        {{
            "name": "Conceptual trait name (NOT individual tech like 'React')",
            "description": "1-2 sentence description of what this means",
            "priority": "must_have or nice_to_have",
            "signals": ["What to look for in candidates"],
            "anti_signals": ["Red flags"]
        }}
    ],
    "interview_stages": [
        {{
            "name": "Stage name",
            "description": "What this stage evaluates",
            "order": 1,
            "duration_minutes": "Number or null",
            "interviewer_role": "Who conducts this or null",
            "actions": ["Recruiter instructions"]
        }}
    ],
    "outreach": {{
        "tone": "formal/casual/direct/enthusiastic or null",
        "key_hook": "What makes this role compelling or null",
        "selling_points": ["Reasons to take this job"]
    }},
    "confidence_scores": {{
        "job_title": 0.0-1.0,
        "location": 0.0-1.0,
        "experience": 0.0-1.0,
        "compensation": 0.0-1.0,
        "traits": 0.0-1.0,
        "interview_stages": 0.0-1.0
    }}
}}

Rules:
1. Traits should be CONCEPTUAL, not individual technologies
   - GOOD: "Frontend Development" with signals ["React", "Vue", "TypeScript"]
   - BAD: Separate traits for "React", "Vue", "TypeScript"

2. Every trait MUST have a description (1-2 sentences)

3. For compensation:
   - If only one number given, use it as salary_min
   - Look for equity mentions separately
   - "Competitive salary" = null (not specific)

4. For interview stages:
   - Only include if JD describes the process
   - Don't invent stages

5. Confidence scores:
   - 1.0 = Explicitly stated
   - 0.7-0.9 = Clearly implied
   - 0.4-0.6 = Inferred from context
   - 0.1-0.3 = Guessed, needs confirmation
   - 0.0 = Not mentioned at all
"""

        response = await self.client.post(
            OPENROUTER_URL,
            json={
                "model": "google/gemini-2.5-flash-preview",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.2  # Low temp for extraction
            }
        )

        response.raise_for_status()
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        data = json.loads(content)

        # Build JobProfile from extracted data
        return self._build_profile(data)

    def _build_profile(self, data: dict) -> JobProfile:
        """Convert raw extraction to JobProfile"""

        # Build requirements
        req_data = data.get("requirements", {})
        requirements = HardRequirements(
            job_title=req_data.get("job_title", ""),
            location_type=req_data.get("location_type"),
            location_city=req_data.get("location_city"),
            onsite_days_per_week=req_data.get("onsite_days_per_week"),
            timezone_requirements=req_data.get("timezone_requirements"),
            visa_sponsorship=req_data.get("visa_sponsorship"),
            work_authorization_notes=req_data.get("work_authorization_notes"),
            experience_min_years=req_data.get("experience_min_years"),
            experience_max_years=req_data.get("experience_max_years"),
            salary_min=req_data.get("salary_min"),
            salary_max=req_data.get("salary_max"),
            equity_offered=req_data.get("equity_offered"),
            equity_range=req_data.get("equity_range"),
            bonus_structure=req_data.get("bonus_structure")
        )

        # Build traits
        traits = []
        for i, t in enumerate(data.get("traits", [])):
            traits.append(CandidateTrait(
                id=str(uuid.uuid4()),
                name=t.get("name", ""),
                description=t.get("description", ""),
                priority=TraitPriority(t.get("priority", "must_have")),
                signals=t.get("signals", []),
                anti_signals=t.get("anti_signals", [])
            ))

        # Build interview stages
        stages = []
        for s in data.get("interview_stages", []):
            stages.append(InterviewStage(
                id=str(uuid.uuid4()),
                name=s.get("name", ""),
                description=s.get("description", ""),
                order=s.get("order", len(stages) + 1),
                duration_minutes=s.get("duration_minutes"),
                interviewer_role=s.get("interviewer_role"),
                actions=s.get("actions", [])
            ))

        # Build profile
        profile = JobProfile(
            recruiter_first_name="",  # Set by session
            recruiter_last_name="",
            company=CompanyIntelligence(name="", website=""),  # Merged later
            requirements=requirements,
            traits=traits,
            interview_stages=stages,
            extraction_source=ExtractionSource.JD_PASTE,
            field_confidence=[
                FieldConfidence(
                    field_name=k,
                    confidence=v,
                    source=ExtractionSource.JD_PASTE,
                    needs_confirmation=v < 0.7
                )
                for k, v in data.get("confidence_scores", {}).items()
            ]
        )

        profile.missing_required_fields = profile.get_missing_fields()
        profile.is_complete = len(profile.missing_required_fields) == 0

        return profile


jd_extractor = JDExtractor()
```

---

## Gap Question Generator

```python
# backend/services/gap_question_generator.py

from typing import List, Optional
from models.voice_ingest import CompanyIntelligence


def generate_gap_questions(
    missing_required: List[str],
    missing_optional: List[str],
    company_context: Optional[CompanyIntelligence] = None
) -> List[str]:
    """
    Generate contextual questions for missing fields.
    Uses company context to make questions relevant.
    """

    questions = []

    # Map fields to questions
    question_templates = {
        # Required fields
        "job_title": "What's the exact title for this role?",
        "location_type": "Is this role onsite, hybrid, or fully remote?",
        "experience_min_years": "What's the minimum years of experience you're looking for?",
        "compensation": "What's the compensation range for this role? And is there equity on top?",
        "visa_sponsorship": "Do you sponsor work visas for this role?",
        "equity": "Is equity part of the compensation package? If so, what range?",
        "traits": "What are the key skills and traits you're looking for in candidates?",
        "interview_stages": "What does your interview process look like for this role?",

        # Optional but valuable
        "location_city": "Which city or office would this person be based in?",
        "onsite_days": "For hybrid, how many days per week in office?",
        "experience_max_years": "Is there a ceiling on experience, or would you consider very senior candidates?",
        "team_structure": "Who would this person report to and work with day-to-day?",
        "growth_path": "Where could this role go in 1-2 years?",
    }

    # Generate questions for required fields first
    for field in missing_required:
        if field in question_templates:
            question = question_templates[field]

            # Add context if available
            if company_context:
                question = _add_context(question, field, company_context)

            questions.append(question)

    # Then optional fields
    for field in missing_optional[:3]:  # Limit to 3 optional
        if field in question_templates:
            questions.append(question_templates[field])

    return questions


def _add_context(
    question: str,
    field: str,
    company: CompanyIntelligence
) -> str:
    """Add company context to make questions more relevant"""

    if field == "compensation" and company.funding_stage:
        stage = company.funding_stage.replace("_", " ").title()
        return f"For a {stage} company, what's the compensation range? And is there equity?"

    if field == "location_type" and company.office_locations:
        locations = ", ".join(company.office_locations[:2])
        return f"I see you have offices in {locations}. Is this role tied to a location, or remote-friendly?"

    if field == "traits" and company.tech_stack_hints:
        tech = ", ".join(company.tech_stack_hints[:3])
        return f"I noticed you use {tech}. Is experience with these required, or what skills matter most?"

    return question
```

---

## Frontend: JD Input Component

```tsx
// frontend/src/components/voice-ingest/JDInput.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface JDInputProps {
  sessionId: string;
  onExtracted: (result: ExtractionResult) => void;
  onSkipToVoice: () => void;
}

interface ExtractionResult {
  extracted: Partial<JobProfile>;
  missingRequired: string[];
  missingOptional: string[];
  suggestedQuestions: string[];
}

export function JDInput({ sessionId, onExtracted, onSkipToVoice }: JDInputProps) {
  const [jdText, setJdText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<string[]>([]);

  const handleExtract = async () => {
    if (!jdText.trim()) return;

    setIsExtracting(true);
    setExtractionProgress(['Analyzing job description...']);

    try {
      // Simulate progress updates
      setTimeout(() => setExtractionProgress(prev => [...prev, 'Extracting requirements...']), 500);
      setTimeout(() => setExtractionProgress(prev => [...prev, 'Identifying traits...']), 1000);
      setTimeout(() => setExtractionProgress(prev => [...prev, 'Detecting interview stages...']), 1500);

      const response = await fetch(`/api/voice-ingest/${sessionId}/parse-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_text: jdText })
      });

      const data = await response.json();

      setExtractionProgress(prev => [...prev, 'Done!']);

      // Short delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));

      onExtracted({
        extracted: data.extracted,
        missingRequired: data.missing_required,
        missingOptional: data.missing_optional,
        suggestedQuestions: data.suggested_questions
      });
    } catch (error) {
      console.error('Extraction failed:', error);
      setExtractionProgress(prev => [...prev, 'Extraction failed. Try voice instead.']);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-800"
      >
        <h2 className="text-2xl font-semibold text-white mb-2">
          How would you like to describe the role?
        </h2>
        <p className="text-slate-400 mb-6">
          Paste your job description, or skip and talk through it with our AI.
        </p>

        <div className="space-y-4">
          {/* JD Textarea */}
          <div>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste your job description here..."
              className="w-full h-64 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none resize-none font-mono text-sm"
              disabled={isExtracting}
            />
            <div className="flex justify-between mt-2 text-sm text-slate-500">
              <span>{jdText.length} characters</span>
              <span>{jdText.split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>

          {/* Extraction Progress */}
          <AnimatePresence>
            {isExtracting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-slate-800/30 rounded-lg p-4"
              >
                {extractionProgress.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-sm text-slate-400"
                  >
                    {i === extractionProgress.length - 1 && !step.includes('Done') ? (
                      <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <span>{step}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleExtract}
              disabled={!jdText.trim() || isExtracting}
              className="flex-1 bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium py-3 rounded-lg hover:from-violet-500 hover:to-violet-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExtracting ? 'Extracting...' : 'Extract from JD'}
            </button>

            <button
              onClick={onSkipToVoice}
              disabled={isExtracting}
              className="flex-1 bg-slate-800 text-white font-medium py-3 rounded-lg hover:bg-slate-700 transition-all border border-slate-700 disabled:opacity-50"
            >
              Skip & Talk Instead
            </button>
          </div>

          <p className="text-center text-sm text-slate-500">
            Either way, you'll talk with our AI to fill in any gaps
          </p>
        </div>
      </motion.div>
    </div>
  );
}
```

---

## Extraction Summary Display

```tsx
// frontend/src/components/voice-ingest/ExtractionSummary.tsx

import { motion } from 'framer-motion';

interface ExtractionSummaryProps {
  extracted: Partial<JobProfile>;
  missingRequired: string[];
  onContinue: () => void;
}

export function ExtractionSummary({
  extracted,
  missingRequired,
  onContinue
}: ExtractionSummaryProps) {
  const completionPercentage = calculateCompletion(extracted, missingRequired);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white">
            Extraction Complete
          </h2>
          <div className="text-right">
            <div className="text-3xl font-bold text-violet-400">
              {completionPercentage}%
            </div>
            <div className="text-sm text-slate-500">complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-800 rounded-full mb-8 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-violet-600 to-emerald-500 rounded-full"
          />
        </div>

        {/* Extracted Fields */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <ExtractedCard
            title="Role"
            items={[
              extracted.requirements?.job_title,
              extracted.requirements?.location_type,
              extracted.requirements?.experience_min_years &&
                `${extracted.requirements.experience_min_years}+ years`
            ].filter(Boolean)}
            icon="💼"
          />

          <ExtractedCard
            title="Compensation"
            items={[
              extracted.requirements?.salary_min &&
                `$${(extracted.requirements.salary_min / 1000).toFixed(0)}k - $${(extracted.requirements.salary_max || extracted.requirements.salary_min) / 1000}k`,
              extracted.requirements?.equity_range &&
                `Equity: ${extracted.requirements.equity_range}`
            ].filter(Boolean)}
            icon="💰"
          />

          <ExtractedCard
            title="Traits"
            items={extracted.traits?.map(t => t.name) || []}
            icon="🎯"
          />

          <ExtractedCard
            title="Interview"
            items={extracted.interview_stages?.map(s => s.name) || []}
            icon="📋"
          />
        </div>

        {/* Missing Fields */}
        {missingRequired.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <span>⚠️</span>
              <span className="font-medium">Still needed</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {missingRequired.map(field => (
                <span
                  key={field}
                  className="px-2 py-1 bg-amber-500/20 text-amber-300 text-sm rounded"
                >
                  {formatFieldName(field)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={onContinue}
          className="w-full bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium py-3 rounded-lg hover:from-violet-500 hover:to-violet-400 transition-all"
        >
          {missingRequired.length > 0
            ? `Continue → Fill ${missingRequired.length} gaps with AI`
            : 'Continue → Review & Finalize'}
        </button>
      </div>
    </motion.div>
  );
}

function ExtractedCard({
  title,
  items,
  icon
}: {
  title: string;
  items: string[];
  icon: string;
}) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="font-medium text-white">{title}</span>
        {items.length > 0 && (
          <span className="ml-auto text-emerald-400">✓</span>
        )}
      </div>
      {items.length > 0 ? (
        <ul className="text-sm text-slate-400 space-y-1">
          {items.slice(0, 3).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
          {items.length > 3 && (
            <li className="text-slate-500">+{items.length - 3} more</li>
          )}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 italic">Not found in JD</p>
      )}
    </div>
  );
}

function formatFieldName(field: string): string {
  const names: Record<string, string> = {
    job_title: 'Job Title',
    location_type: 'Location',
    experience_min_years: 'Experience',
    compensation: 'Compensation',
    visa_sponsorship: 'Visa Policy',
    equity: 'Equity',
    traits: 'Key Traits',
    interview_stages: 'Interview Process'
  };
  return names[field] || field;
}

function calculateCompletion(
  extracted: Partial<JobProfile>,
  missing: string[]
): number {
  const totalRequired = 8; // Adjust based on required fields
  const found = totalRequired - missing.length;
  return Math.round((found / totalRequired) * 100);
}
```

---

## Next Phase

[Phase 4: LiveKit Voice Agent](./phase4-voice-agent.md) - Voice agent implementation with gap-fill conversation
