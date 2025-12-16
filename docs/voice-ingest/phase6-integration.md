# Phase 6: Integration

## Overview

Connect the Voice Ingest flow to the existing Briefing Room pipeline. The finalized job profile feeds into the CSV upload and candidate processing flow.

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPLETE BRIEFING ROOM FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  VOICE INGEST (New - Phases 1-5)                                    │    │
│  │                                                                     │    │
│  │  Intake → Parallel.ai → JD Input → Voice Agent → Review             │    │
│  │                                                                     │    │
│  │  Output: Complete JobProfile                                        │    │
│  │  • Company context                                                  │    │
│  │  • Hard requirements (location, comp, visa, exp)                    │    │
│  │  • Candidate traits with descriptions                               │    │
│  │  • Interview stages with actions                                    │    │
│  │  • Qualitative nuances                                              │    │
│  └────────────────────────────────┬────────────────────────────────────┘    │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  HANDOFF POINT                                                      │    │
│  │                                                                     │    │
│  │  POST /api/jobs/{job_profile_id}/activate                           │    │
│  │  • Converts JobProfile → Job (existing schema)                      │    │
│  │  • Generates job_description text from structured data              │    │
│  │  • Creates email template from outreach config                      │    │
│  │  • Returns job_id for next steps                                    │    │
│  └────────────────────────────────┬────────────────────────────────────┘    │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  EXISTING FLOW (Current Briefing Room)                              │    │
│  │                                                                     │    │
│  │  /job/{job_id}/candidates                                           │    │
│  │  ├── Upload CSV                                                     │    │
│  │  ├── Pluto processes candidates against JobProfile                  │    │
│  │  ├── AI scoring uses traits as evaluation criteria                  │    │
│  │  └── Ranking generated                                              │    │
│  │                                                                     │    │
│  │  /candidates/{candidate_id}/prebrief                                │    │
│  │  ├── Pre-interview briefing now uses structured traits              │    │
│  │  └── Suggested questions based on trait signals                     │    │
│  │                                                                     │    │
│  │  /candidates/{candidate_id}/interview                               │    │
│  │  ├── Live interview with coaching                                   │    │
│  │  └── Coach uses interview_stages context                            │    │
│  │                                                                     │    │
│  │  Post-interview analytics                                           │    │
│  │  └── Scoring aligned with defined traits                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Mapping: JobProfile → Existing Schema

### Database Schema Updates

```sql
-- Add job_profile_id to jobs table for linkage
ALTER TABLE jobs ADD COLUMN job_profile_id UUID REFERENCES job_profiles(id);

-- Add structured traits table (optional - can also use JSONB)
CREATE TABLE job_traits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('must_have', 'nice_to_have')),
    signals JSONB DEFAULT '[]'::jsonb,
    anti_signals JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_traits_job ON job_traits(job_id);

-- Add interview stages table
CREATE TABLE job_interview_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    stage_order INT NOT NULL,
    duration_minutes INT,
    interviewer_role TEXT,
    actions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_stages_job ON job_interview_stages(job_id);
```

---

## Activation Endpoint

```python
# backend/routers/voice_ingest.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class ActivateJobResponse(BaseModel):
    job_id: str
    job_description: str
    redirect_url: str


@router.post("/{job_profile_id}/activate", response_model=ActivateJobResponse)
async def activate_job_profile(job_profile_id: str):
    """
    Convert a completed JobProfile into an active Job.
    This bridges Voice Ingest to the existing candidate flow.
    """

    # Get the job profile
    profile = await job_profile_repo.get(job_profile_id)

    if not profile:
        raise HTTPException(404, "Job profile not found")

    if not profile.is_complete:
        raise HTTPException(400, "Job profile is not complete")

    # Generate job description text from structured data
    job_description = generate_job_description(profile)

    # Create job in existing schema
    job = await create_job(
        title=profile.requirements.job_title,
        company_name=profile.company.name,
        job_description=job_description,
        job_profile_id=job_profile_id,
        metadata={
            "location_type": profile.requirements.location_type,
            "location_city": profile.requirements.location_city,
            "experience_min": profile.requirements.experience_min_years,
            "experience_max": profile.requirements.experience_max_years,
            "salary_min": profile.requirements.salary_min,
            "salary_max": profile.requirements.salary_max,
        }
    )

    # Copy traits to job_traits table
    for trait in profile.traits:
        await create_job_trait(
            job_id=job.id,
            name=trait.name,
            description=trait.description,
            priority=trait.priority,
            signals=trait.signals,
            anti_signals=trait.anti_signals
        )

    # Copy interview stages
    for stage in profile.interview_stages:
        await create_job_interview_stage(
            job_id=job.id,
            name=stage.name,
            description=stage.description,
            order=stage.order,
            duration_minutes=stage.duration_minutes,
            interviewer_role=stage.interviewer_role,
            actions=stage.actions
        )

    # Generate email template if outreach config exists
    if profile.outreach:
        await create_email_template(
            job_id=job.id,
            subject=profile.outreach.subject_line or f"Opportunity at {profile.company.name}",
            body=profile.outreach.email_body or generate_outreach_email(profile),
            tone=profile.outreach.tone
        )

    return ActivateJobResponse(
        job_id=job.id,
        job_description=job_description,
        redirect_url=f"/job/{job.id}/candidates"
    )


def generate_job_description(profile: JobProfile) -> str:
    """Generate human-readable JD from structured profile"""

    sections = []

    # Title and company
    sections.append(f"# {profile.requirements.job_title} at {profile.company.name}")

    # Company overview
    if profile.company.product_description:
        sections.append(f"\n## About {profile.company.name}")
        sections.append(profile.company.product_description)
        if profile.company.problem_solved:
            sections.append(f"\n{profile.company.problem_solved}")

    # Role overview
    sections.append("\n## The Role")
    role_details = []

    if profile.requirements.location_type:
        loc = profile.requirements.location_type.value.title()
        if profile.requirements.location_city:
            loc = f"{profile.requirements.location_city} ({loc})"
        if profile.requirements.onsite_days_per_week:
            loc += f" - {profile.requirements.onsite_days_per_week} days/week in office"
        role_details.append(f"- **Location:** {loc}")

    if profile.requirements.experience_min_years:
        exp = f"{profile.requirements.experience_min_years}+ years"
        if profile.requirements.experience_max_years:
            exp = f"{profile.requirements.experience_min_years}-{profile.requirements.experience_max_years} years"
        role_details.append(f"- **Experience:** {exp}")

    if profile.requirements.salary_min:
        comp = f"${profile.requirements.salary_min:,}"
        if profile.requirements.salary_max:
            comp += f" - ${profile.requirements.salary_max:,}"
        if profile.requirements.equity_range:
            comp += f" + {profile.requirements.equity_range} equity"
        elif profile.requirements.equity_offered:
            comp += " + equity"
        role_details.append(f"- **Compensation:** {comp}")

    if profile.requirements.visa_sponsorship is not None:
        visa = "Available" if profile.requirements.visa_sponsorship else "Not available"
        role_details.append(f"- **Visa Sponsorship:** {visa}")

    sections.append("\n".join(role_details))

    # What we're looking for (traits)
    if profile.traits:
        sections.append("\n## What We're Looking For")

        must_haves = [t for t in profile.traits if t.priority.value == "must_have"]
        nice_to_haves = [t for t in profile.traits if t.priority.value == "nice_to_have"]

        if must_haves:
            sections.append("\n### Must Have")
            for trait in must_haves:
                sections.append(f"- **{trait.name}:** {trait.description}")

        if nice_to_haves:
            sections.append("\n### Nice to Have")
            for trait in nice_to_haves:
                sections.append(f"- **{trait.name}:** {trait.description}")

    # Interview process
    if profile.interview_stages:
        sections.append("\n## Interview Process")
        for stage in sorted(profile.interview_stages, key=lambda s: s.order):
            sections.append(f"{stage.order}. **{stage.name}** - {stage.description}")

    return "\n".join(sections)


def generate_outreach_email(profile: JobProfile) -> str:
    """Generate default outreach email from profile"""

    company = profile.company.name
    role = profile.requirements.job_title
    selling_points = profile.company.potential_selling_points or []

    body = f"""Hi {{{{first_name}}}},

I came across your profile and was impressed by your background. We're hiring a {role} at {company}, and I think you could be a great fit.

"""

    if selling_points:
        body += "A few things that make this opportunity exciting:\n"
        for point in selling_points[:3]:
            body += f"• {point}\n"
        body += "\n"

    if profile.requirements.salary_min:
        comp = f"${int(profile.requirements.salary_min/1000)}k"
        if profile.requirements.salary_max:
            comp += f"-${int(profile.requirements.salary_max/1000)}k"
        body += f"Compensation is in the {comp} range"
        if profile.requirements.equity_offered:
            body += " plus equity"
        body += ".\n\n"

    body += """Would you be open to a quick chat to learn more?

Best,
{{sender_name}}"""

    return body
```

---

## Updating Pluto Processor

The existing Pluto processor needs to use the structured traits for scoring:

```python
# backend/services/pluto_processor.py (updates)

async def score_candidate_against_job(
    candidate: CandidateData,
    job_id: str
) -> CandidateScore:
    """
    Score a candidate using structured job traits.
    """

    # Get job traits
    traits = await get_job_traits(job_id)

    if not traits:
        # Fallback to old JD-based scoring
        return await legacy_score_candidate(candidate, job_id)

    # Build scoring prompt with structured traits
    prompt = build_trait_scoring_prompt(candidate, traits)

    # Score via LLM
    scores = await llm_score_candidate(prompt)

    return CandidateScore(
        candidate_id=candidate.id,
        overall_score=scores.overall,
        trait_scores={
            trait.name: scores.by_trait.get(trait.name, 0)
            for trait in traits
        },
        reasoning=scores.reasoning
    )


def build_trait_scoring_prompt(
    candidate: CandidateData,
    traits: List[JobTrait]
) -> str:
    """Build scoring prompt from structured traits"""

    prompt = f"""
Score this candidate against the job requirements.

## Candidate Profile
Name: {candidate.name}
Current Role: {candidate.current_title} at {candidate.current_company}

Resume/Background:
{candidate.resume_text}

## Job Requirements - Score each trait 1-10

"""

    for trait in traits:
        prompt += f"""
### {trait.name} ({"Required" if trait.priority == "must_have" else "Nice to Have"})
{trait.description}

Look for: {", ".join(trait.signals) if trait.signals else "N/A"}
Red flags: {", ".join(trait.anti_signals) if trait.anti_signals else "N/A"}

"""

    prompt += """
Return JSON:
{
    "overall": 1-10,
    "by_trait": {
        "Trait Name": 1-10,
        ...
    },
    "reasoning": "Brief explanation"
}
"""

    return prompt
```

---

## Updating Pre-Briefing

The pre-briefing now uses structured traits:

```python
# backend/routers/prebrief.py (updates)

async def generate_prebrief(
    candidate_id: str,
    job_id: str
) -> Prebrief:
    """
    Generate pre-interview briefing using structured job profile.
    """

    candidate = await get_candidate(candidate_id)
    job = await get_job(job_id)
    traits = await get_job_traits(job_id)
    stages = await get_job_interview_stages(job_id)

    # Generate trait-based evaluation points
    evaluation_points = []
    for trait in traits:
        evidence = await find_trait_evidence(candidate, trait)
        evaluation_points.append({
            "trait": trait.name,
            "description": trait.description,
            "priority": trait.priority,
            "candidate_evidence": evidence.found,
            "confidence": evidence.confidence,
            "suggested_questions": generate_trait_questions(trait, evidence)
        })

    # Build briefing
    return Prebrief(
        candidate_id=candidate_id,
        job_id=job_id,
        candidate_summary=generate_candidate_summary(candidate),
        trait_analysis=evaluation_points,
        interview_guide={
            "stages": stages,
            "suggested_flow": generate_interview_flow(stages, traits),
            "time_allocation": calculate_time_allocation(stages, traits)
        },
        key_questions=generate_priority_questions(traits, evaluation_points),
        red_flags=identify_red_flags(candidate, traits),
        talking_points=generate_selling_points(job, candidate)
    )


def generate_trait_questions(
    trait: JobTrait,
    evidence: TraitEvidence
) -> List[str]:
    """Generate interview questions for a specific trait"""

    questions = []

    if evidence.confidence < 0.5:
        # Low evidence - need to probe
        questions.append(
            f"Tell me about your experience with {trait.name.lower()}."
        )

    if trait.signals:
        # Ask about specific signals
        signal = trait.signals[0]
        questions.append(
            f"Can you walk me through a project where you used {signal}?"
        )

    if evidence.concerns:
        # Address concerns
        questions.append(
            f"I noticed {evidence.concerns[0]}. Can you help me understand that?"
        )

    return questions
```

---

## Review & Finalize Component

```tsx
// frontend/src/components/voice-ingest/ReviewFinalize.tsx

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from './ui/GlassCard';
import { Check, Edit2, ArrowRight } from 'lucide-react';

interface ReviewFinalizeProps {
  sessionId: string;
  onComplete: () => void;
}

export function ReviewFinalize({ sessionId, onComplete }: ReviewFinalizeProps) {
  const [profile, setProfile] = useState<JobProfile | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState('');

  useEffect(() => {
    async function loadProfile() {
      const response = await fetch(`/api/voice-ingest/${sessionId}`);
      const data = await response.json();
      setProfile(data.profile);
      setEmailTemplate(data.profile.outreach?.email_body || '');
    }
    loadProfile();
  }, [sessionId]);

  const handleActivate = async () => {
    setIsActivating(true);

    try {
      // Update email template if edited
      if (emailTemplate !== profile?.outreach?.email_body) {
        await fetch(`/api/voice-ingest/${sessionId}/outreach`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_body: emailTemplate })
        });
      }

      // Activate the job
      const response = await fetch(`/api/jobs/${sessionId}/activate`, {
        method: 'POST'
      });
      const data = await response.json();

      // Redirect to candidate upload
      window.location.href = data.redirect_url;
    } catch (error) {
      console.error('Activation failed:', error);
      setIsActivating(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Profile Complete!
          </h1>
          <p className="text-slate-400">
            Review your hiring profile before uploading candidates
          </p>
        </div>

        {/* Profile Summary */}
        <GlassCard className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            {profile.requirements.job_title} at {profile.company.name}
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryItem
              label="Location"
              value={formatLocation(profile.requirements)}
            />
            <SummaryItem
              label="Experience"
              value={formatExperience(profile.requirements)}
            />
            <SummaryItem
              label="Compensation"
              value={formatSalary(profile.requirements)}
            />
            <SummaryItem
              label="Visa"
              value={profile.requirements.visa_sponsorship ? 'Sponsors' : 'No sponsorship'}
            />
          </div>

          {/* Traits */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-400 mb-2">
              Candidate Traits ({profile.traits.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.traits.map(trait => (
                <span
                  key={trait.id}
                  className={`px-3 py-1 rounded-full text-sm ${
                    trait.priority === 'must_have'
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {trait.name}
                </span>
              ))}
            </div>
          </div>

          {/* Interview Stages */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">
              Interview Process ({profile.interview_stages.length} stages)
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {profile.interview_stages
                .sort((a, b) => a.order - b.order)
                .map((stage, i) => (
                  <div key={stage.id} className="flex items-center">
                    <span className="px-3 py-1 bg-slate-800 rounded text-sm text-white">
                      {stage.name}
                    </span>
                    {i < profile.interview_stages.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-slate-600 mx-1" />
                    )}
                  </div>
                ))}
            </div>
          </div>
        </GlassCard>

        {/* Email Template */}
        <GlassCard className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Outreach Email Template
            </h2>
            <button className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1">
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          </div>

          <textarea
            value={emailTemplate}
            onChange={(e) => setEmailTemplate(e.target.value)}
            className="w-full h-64 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-violet-500 focus:outline-none resize-none"
          />

          <p className="text-xs text-slate-500 mt-2">
            Variables: {'{{first_name}}'}, {'{{sender_name}}'}, {'{{company}}'}
          </p>
        </GlassCard>

        {/* Activate Button */}
        <button
          onClick={handleActivate}
          disabled={isActivating}
          className="w-full bg-gradient-to-r from-violet-600 to-emerald-500 text-white font-semibold py-4 rounded-xl hover:from-violet-500 hover:to-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isActivating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Activating...
            </>
          ) : (
            <>
              Continue to Upload Candidates
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-slate-500 mt-4">
          You can always edit these details later
        </p>
      </motion.div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}
```

---

## Navigation Updates

```tsx
// frontend/src/app/page.tsx (update home page)

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center px-4">
        <h1 className="text-4xl font-bold text-white mb-4">
          Briefing Room
        </h1>
        <p className="text-xl text-slate-400 mb-8">
          AI-powered interview intelligence
        </p>

        <div className="grid gap-4">
          {/* New: Voice Ingest flow */}
          <a
            href="/voice-ingest"
            className="block bg-gradient-to-r from-violet-600 to-emerald-500 text-white font-semibold py-4 px-6 rounded-xl hover:from-violet-500 hover:to-emerald-400 transition-all"
          >
            Create New Hiring Profile
            <span className="block text-sm font-normal opacity-80 mt-1">
              Build a complete job profile with our AI assistant
            </span>
          </a>

          {/* Existing: Direct to job management */}
          <a
            href="/jobs"
            className="block bg-slate-800 text-white font-semibold py-4 px-6 rounded-xl hover:bg-slate-700 transition-all border border-slate-700"
          >
            View Existing Jobs
            <span className="block text-sm font-normal text-slate-400 mt-1">
              Manage candidates and interviews
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
```

---

## Environment Variables Summary

```bash
# .env - Complete list for Voice Ingest

# Parallel.ai (Company Research)
PARALLEL_API_KEY=your_parallel_api_key

# OpenRouter (LLM - Gemini 2.5 Flash)
OPENROUTER_API_KEY=your_openrouter_api_key

# LiveKit (Voice Agent)
LIVEKIT_URL=wss://your-instance.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Speech Services
DEEPGRAM_API_KEY=your_deepgram_api_key
OPENAI_API_KEY=your_openai_api_key  # For TTS

# Supabase (Database)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Frontend
NEXT_PUBLIC_LIVEKIT_URL=wss://your-instance.livekit.cloud
NEXT_PUBLIC_WS_URL=ws://localhost:8000  # or production URL
```

---

## File Structure Summary

```
kinshasa/
├── backend/
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── onboarding_agent.py    # LiveKit agent entry
│   │   ├── tools.py               # Agent tool definitions
│   │   ├── context.py             # Context builder
│   │   └── prompts.py             # System prompt builder
│   │
│   ├── models/
│   │   └── voice_ingest/
│   │       ├── __init__.py
│   │       ├── company.py
│   │       ├── requirements.py
│   │       ├── traits.py
│   │       ├── interview.py
│   │       ├── nuance.py
│   │       ├── outreach.py
│   │       ├── profile.py
│   │       └── context.py
│   │
│   ├── routers/
│   │   ├── voice_ingest.py        # Main API endpoints
│   │   └── websocket.py           # WebSocket endpoint
│   │
│   ├── services/
│   │   ├── parallel_ai.py         # Company research
│   │   ├── company_extractor.py   # Raw → structured
│   │   ├── jd_extractor.py        # JD parsing
│   │   ├── smart_questions.py     # Question generator
│   │   └── websocket_hub.py       # WS management
│   │
│   └── repositories/
│       └── job_profile_repository.py
│
├── frontend/
│   └── src/
│       ├── app/
│       │   └── voice-ingest/
│       │       └── page.tsx       # Main page
│       │
│       ├── components/
│       │   └── voice-ingest/
│       │       ├── IntakeForm.tsx
│       │       ├── JDInput.tsx
│       │       ├── ExtractionSummary.tsx
│       │       ├── VoiceSession.tsx
│       │       ├── ProfileBuilder.tsx
│       │       ├── ReviewFinalize.tsx
│       │       └── ui/
│       │           └── GlassCard.tsx
│       │
│       ├── hooks/
│       │   └── useWebSocket.ts
│       │
│       └── lib/
│           └── design-tokens.ts
│
└── docs/
    └── voice-ingest/
        ├── README.md
        ├── phase1-data-models.md
        ├── phase2-parallel-integration.md
        ├── phase3-jd-extraction.md
        ├── phase4-voice-agent.md
        ├── phase5-frontend.md
        └── phase6-integration.md
```

---

## Implementation Order

1. **Phase 1**: Data models (Pydantic) + Database schema
2. **Phase 2**: Parallel.ai integration + Extraction service
3. **Phase 3**: JD extraction endpoint
4. **Phase 4**: LiveKit voice agent + Tools
5. **Phase 5**: Frontend components + WebSocket
6. **Phase 6**: Integration with existing flow

Each phase builds on the previous. Start with Phase 1 to establish the data foundation.

---

## Success Metrics

- **Time to complete profile**: Target < 10 minutes (down from 30)
- **Profile completeness**: 100% of required fields filled
- **User satisfaction**: Agent sounds informed, not robotic
- **Data quality**: Structured traits enable better candidate matching
