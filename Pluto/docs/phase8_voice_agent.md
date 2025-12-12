# Phase 8: Hybrid Voice Agent Integration

Resume extraction + Dynamic voice agent for gap-filling.

## Overview

Intelligent 3-step candidate onboarding:
1. **Resume Upload** → Extract structured data
2. **Gap Analysis** → Compare to job description requirements
3. **Voice Agent** → Only ask for missing fields + open-ended questions

---

## Why Hybrid is Better

| Factor | Full Voice | Resume + Voice Gap-Fill |
|--------|------------|-------------------------|
| Call Duration | 5-7 min | 1-2 min |
| API Cost | $$$$ | $ |
| User Experience | Redundant questions | Smart, contextual |
| Data Quality | Transcription errors | Clean structured data |

---

## Architecture

```
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│ Resume Upload  │ → │  Gap Analysis  │ → │  Voice Agent   │
│ (PDF/LinkedIn) │    │ (JD vs Resume) │    │ (Gaps Only)    │
└────────────────┘    └────────────────┘    └────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
   Gemini Extract      Missing Fields       Dynamic Prompt
   Structured Data     + Open Questions     Generated per JD
```

---

## Step 1: Resume Extraction

**Input:** PDF resume or LinkedIn URL
**Output:** Structured candidate profile

```json
{
  "name": "Anish Gillella",
  "current_title": "Account Executive",
  "current_company": "Salesforce",
  "years_experience": 4,
  "skills": ["Enterprise Sales", "SaaS"],
  "education": "BS Finance",
  "sold_to_finance": null,  // Unknown from resume
  "max_deal_size": null,    // Unknown from resume
  "startup_interest": null  // Unknown from resume
}
```

---

## Step 2: Gap Analysis

Compare extracted data against **JD requirements**:

```python
JD_REQUIREMENTS = {
    "required": [
        "years_experience",
        "sold_to_finance",
        "current_title"
    ],
    "preferred": [
        "max_deal_size",
        "startup_experience",
        "enterprise_experience"
    ],
    "open_ended": [
        "motivation",        # "Why this role?"
        "biggest_win"        # "Tell me about a big sale"
    ]
}
```

**Gap result:**
```json
{
  "missing_required": ["sold_to_finance"],
  "missing_preferred": ["max_deal_size", "startup_experience"],
  "open_ended_needed": ["motivation", "biggest_win"]
}
```

---

## Step 3: Dynamic Voice Agent

### System Prompt (Generated per JD + gaps):

```
You are Pluto, a friendly AI headhunter for TalentPluto.

CONTEXT:
- Candidate: Anish Gillella
- Current Role: Account Executive at Salesforce
- Experience: 4 years

YOU NEED TO ASK:
1. "Hi Anish! I see you're an AE at Salesforce. Have you sold to CFOs or finance leaders before?"
2. "What's the largest deal you've closed?"
3. "Are you interested in startup opportunities?"
4. "Tell me about your biggest sales win - what made it special?"

RULES:
- Ask ONE question at a time
- Be conversational, not robotic
- Acknowledge their answers briefly
- End with: "Perfect! Your profile is complete. We'll start matching you with opportunities!"
```

### First Message:
```
"Hi Anish! I'm Pluto, your AI headhunter. I see you're an Account Executive at Salesforce with 4 years of experience - impressive! I just have a few quick questions to complete your profile. Ready?"
```

---

## VAPI Configuration

### Model Settings:
- **LLM:** Gemini 2.5 Flash (via OpenRouter)
- **STT:** Deepgram Nova-2
- **TTS:** ElevenLabs Turbo v2.5

### Webhook Events:
- `transcript` - For real-time extraction
- `end-of-call-report` - Final summary

---

## Real-Time UI Updates

As user speaks, fields fill in real-time:

```
┌─────────────────────────────────────────────────────────────┐
│  Pluto: "Have you sold to CFOs before?"                    │
│  User: "Yes, I closed a $500K deal with a CFO at..."       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  sold_to_finance: [✓ Yes]  ← Just filled!           │   │
│  │  max_deal_size: [$500K]    ← Just filled!           │   │
│  │  startup_interest: [___]   ← Next question          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Backend

| File | Changes |
|------|---------|
| `server.py` | `/api/resume/upload`, `/api/resume/extract`, `/api/voice/start` |
| `voice_agent.py` | VAPI integration, dynamic prompt generation |
| `gap_analysis.py` | Compare resume vs JD requirements |

### Frontend

| Component | Purpose |
|-----------|---------|
| Resume Upload | Drag-drop PDF + preview |
| Gap Display | Show what's missing |
| Voice Call UI | Start call + real-time fields |

---

## Estimated Timeline

| Task | Time |
|------|------|
| Resume upload + extraction | 1 hr |
| Gap analysis logic | 30 min |
| Dynamic prompt generation | 30 min |
| VAPI integration | 1 hr |
| Real-time UI | 1 hr |
| **Total** | **~4 hrs** |

---

## User Inputs Needed

1. 🔑 VAPI API Key
2. 🗣️ Preferred voice (male/female)
3. 📄 Sample resume for testing
