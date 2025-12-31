# Phase 3: JD Extraction Voice Agent

## Overview

This phase implements the voice agent that talks to the **recruiter** (not the candidate) to extract additional context about the job. This agent enriches the job description with information that's often in the recruiter's head but not in the written JD.

**Implementation Status: COMPLETE**

The implementation uses **Vapi** (via webhooks) to match the existing voice infrastructure.

## What This Agent Does

After the recruiter pastes a job description and basic requirements are extracted, this voice agent:

1. **Reviews what was extracted** from the JD
2. **Asks clarifying questions** about gaps in the extracted data
3. **Extracts company context** (culture, team, growth stage)
4. **Defines scoring criteria** (what makes a strong candidate)
5. **Identifies red flags** (what to watch out for)
6. **Activates the job** when enrichment is complete

## Agent Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    JD EXTRACTION VOICE AGENT FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Introduction                                                        │
│  Agent: "Hi! I've reviewed the job description for [Job Title].              │
│          I see you're looking for someone with [skills].                     │
│          Ready to get started?"                                              │
│                                                                              │
│  STEP 2: Verify Extracted Requirements                                       │
│  Agent: "I extracted that you need [X years experience] and                  │
│          skills in [skill1, skill2]. Is this accurate?"                      │
│                                                                              │
│  STEP 3: Company Context Questions                                           │
│  • "Tell me about the team this person would be joining"                     │
│  • "What's the company culture like?"                                        │
│  • "Who would they report to?"                                               │
│  → Calls update_company_context tool                                         │
│                                                                              │
│  STEP 4: Scoring Criteria                                                    │
│  • "What are the absolute must-haves vs nice-to-haves?"                      │
│  • "What technical competencies matter most?"                                │
│  • "How should we weight technical vs experience vs cultural fit?"           │
│  → Calls update_scoring_criteria tool                                        │
│                                                                              │
│  STEP 5: Red Flags                                                           │
│  • "What would be a dealbreaker for this role?"                              │
│  • "Any patterns or backgrounds that concern you?"                           │
│  → Calls add_red_flag tool                                                   │
│                                                                              │
│  STEP 6: Wrap-up                                                             │
│  Agent: "Great! I now have a clear picture. Let me summarize..."             │
│  → Calls activate_job tool                                                   │
│  → Job status changes from 'draft' to 'active'                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### `POST /api/jobs/{job_id}/enrich`

Returns Vapi configuration for the frontend to start a voice enrichment session.

**Response:**
```json
{
  "vapi_public_key": "...",
  "assistant_id": "...",
  "job_id": "uuid",
  "assistant_overrides": {
    "variableValues": { "job_title": "...", "job_id": "..." },
    "firstMessage": "Hi! I've reviewed the job description...",
    "metadata": { "jobId": "...", "mode": "job_enrichment" },
    "model": { "provider": "openrouter", "model": "google/gemini-2.5-flash" },
    "voice": { "provider": "11labs", "voiceId": "..." }
  }
}
```

### `POST /api/jobs/enrich-webhook`

Webhook endpoint for Vapi tool calls during job enrichment. Handles:
- `update_company_context`: Save company/team information
- `update_scoring_criteria`: Save must-haves, nice-to-haves, weights
- `add_red_flag`: Add a red flag to watch for
- `activate_job`: Activate the job when enrichment is complete

## Frontend Integration

```tsx
// Example frontend integration with Vapi
import Vapi from "@vapi-ai/web";

async function startEnrichment(jobId: string) {
  // 1. Get Vapi config from backend
  const response = await fetch(`/api/jobs/${jobId}/enrich`, { method: 'POST' });
  const config = await response.json();

  // 2. Initialize Vapi with public key
  const vapi = new Vapi(config.vapi_public_key);

  // 3. Start call with assistant overrides
  await vapi.start({
    assistantId: config.assistant_id,
    assistantOverrides: config.assistant_overrides,
  });

  // 4. Handle call events
  vapi.on('call-end', () => {
    // Refresh job data to see enriched fields
    fetchJobDetails(jobId);
  });
}
```

## Implementation Details

### Backend Files

- **Router**: `backend/routers/jobs.py`
  - `get_job_enrich_config()` - Returns Vapi configuration
  - `job_enrich_webhook()` - Handles tool calls from Vapi
  - `_execute_enrich_tool()` - Executes individual tools
  - `_build_job_enrich_system_prompt()` - Generates conversation prompt

### Data Models Updated

When enrichment completes, the following Job fields are populated:

```python
class Job:
    # Populated by Phase 3 enrichment
    company_context: CompanyContext  # team size, culture, reporting
    scoring_criteria: ScoringCriteria  # must-haves, weights
    red_flags: List[str]  # dealbreakers
    status: JobStatus.ACTIVE  # activated when enrichment complete
```

### CompanyContext Fields
```python
class CompanyContext:
    company_name: Optional[str]
    company_description: Optional[str]
    team_size: Optional[str]  # e.g., "8 engineers"
    team_culture: Optional[str]  # e.g., "collaborative, fast-paced"
    reporting_to: Optional[str]  # e.g., "VP of Engineering"
    growth_stage: Optional[str]  # e.g., "Series A startup"
    key_projects: List[str]  # What they'll work on
```

### ScoringCriteria Fields
```python
class ScoringCriteria:
    must_haves: List[str]  # Non-negotiable requirements
    nice_to_haves: List[str]  # Bonus points
    cultural_fit_traits: List[str]  # Personality traits
    technical_competencies: List[str]  # Skills to evaluate
    weight_technical: float  # 0-1, default 0.5
    weight_experience: float  # 0-1, default 0.3
    weight_cultural: float  # 0-1, default 0.2
```

## Configuration Required

Environment variables:
- `VAPI_PUBLIC_KEY` - Vapi public key for frontend SDK
- `VAPI_ASSISTANT_ID` - Pre-configured Vapi assistant ID
- `LLM_MODEL` - Model to use (default: google/gemini-2.5-flash)

Vapi webhook URL (configure in Vapi console):
- `https://your-api.com/api/jobs/enrich-webhook`

## Agent Conversation Example

```
AI: "Hi! I've reviewed the job description for Senior Software Engineer.
     I see you're looking for someone with Python, AWS, and Kubernetes.
     I'd like to ask a few questions to help us evaluate candidates more
     accurately. Ready to get started?"

Recruiter: "Yes, let's go."

AI: "Great! First, tell me about the team this person would be joining.
     What's the size and culture like?"

Recruiter: "It's a team of 8 engineers. We're pretty collaborative,
            do a lot of pair programming."

[Agent calls update_company_context tool]

AI: "That's helpful. Who would they report to?"

Recruiter: "Our VP of Engineering, Sarah."

[Agent calls update_company_context tool with reporting_to]

AI: "Now, what are the absolute must-haves for this role?
     What skills does someone need to have?"

Recruiter: "They must know Python well. AWS is nice to have but
            we actually use GCP more. They need to be able to
            mentor junior engineers."

[Agent calls update_scoring_criteria tool]

AI: "Got it. Are there any red flags or dealbreakers I should know about?"

Recruiter: "Job hoppers with less than 1 year per role concern me.
            Also, people who can't explain their work simply."

[Agent calls add_red_flag tool - twice]

AI: "Perfect! Let me summarize:
     - Team of 8, collaborative culture, reporting to Sarah (VP Eng)
     - Must have Python expertise, cloud experience flexible
     - Looking for someone who can mentor juniors
     - Red flags: job hoppers, poor communication
     Does this sound right?"

Recruiter: "Perfect!"

[Agent calls activate_job tool]

AI: "Excellent. Your job is now active and ready for candidates. Thank you!"
```

## Next Phase

Once job enrichment is working, proceed to [Phase 4: Candidate Upload](./phase4-candidate-upload.md) to implement CSV upload linked to jobs.
