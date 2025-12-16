# Phase 4: LiveKit Voice Agent

## Overview

Implement the LiveKit voice agent that conducts the interactive conversation. The agent receives company context from Parallel.ai, any extracted JD data, and a list of gaps to fill. It sounds informed, asks contextual questions, and updates the UI in real-time via tool calls.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LIVEKIT VOICE AGENT ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  FRONTEND (Next.js)                                                 │    │
│  │                                                                     │    │
│  │  LiveKit React SDK ◄──────► LiveKit Server ◄──────► Voice Agent    │    │
│  │        │                                                  │         │    │
│  │        │ WebSocket (UI updates)                           │         │    │
│  │        ▼                                                  │         │    │
│  │  Real-time card updates                                   │         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  BACKEND (FastAPI + LiveKit Agents SDK)                             │    │
│  │                                                                     │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │    │
│  │  │  Voice Agent    │  │  Tool Handlers  │  │  WebSocket Hub  │     │    │
│  │  │  (Python)       │──│  (update_*)     │──│  (UI events)    │     │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │    │
│  │         │                     │                    │                │    │
│  │         │                     ▼                    │                │    │
│  │         │              ┌─────────────────┐         │                │    │
│  │         │              │  Supabase DB    │         │                │    │
│  │         │              │  (job_profiles) │         │                │    │
│  │         │              └─────────────────┘         │                │    │
│  │         │                                          │                │    │
│  │         ▼                                          ▼                │    │
│  │  ┌─────────────────┐                    ┌─────────────────┐        │    │
│  │  │  Deepgram STT   │                    │  Frontend WS    │        │    │
│  │  │  ElevenLabs TTS │                    │  Clients        │        │    │
│  │  └─────────────────┘                    └─────────────────┘        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## LiveKit Agent Implementation

### Agent Entry Point

```python
# backend/agents/onboarding_agent.py

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import deepgram, silero, openai as lk_openai
import os

# Import our tools and context
from agents.tools import OnboardingToolkit
from agents.context import build_agent_context
from agents.prompts import build_system_prompt


async def entrypoint(ctx: JobContext):
    """
    Main entry point for the onboarding voice agent.
    Called when a user joins a LiveKit room.
    """

    # Extract session_id from room metadata
    session_id = ctx.room.metadata

    # Build context from database
    context = await build_agent_context(session_id)

    # Initialize toolkit with session context
    toolkit = OnboardingToolkit(session_id=session_id, context=context)

    # Build the LLM with tools
    llm_instance = lk_openai.LLM.with_openrouter(
        model="google/gemini-2.5-flash-preview",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        temperature=0.7,
    )

    # Create voice assistant
    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=deepgram.STT(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            model="nova-2",
            language="en-US",
        ),
        llm=llm_instance,
        tts=lk_openai.TTS(
            api_key=os.getenv("OPENAI_API_KEY"),
            voice="alloy",
        ),
        fnc_ctx=toolkit,
        chat_ctx=llm.ChatContext().append(
            role="system",
            text=build_system_prompt(context)
        ),
    )

    # Connect to room
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Start the assistant
    assistant.start(ctx.room)

    # Initial greeting
    await assistant.say(context.opening_hook, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

---

### Tool Definitions

```python
# backend/agents/tools.py

from livekit.agents import llm
from typing import Optional, List
import uuid

from models.voice_ingest import (
    CandidateTrait, InterviewStage, NuanceCapture,
    TraitPriority, NuanceCategory, LocationType
)
from repositories.job_profile_repository import job_profile_repo
from services.websocket_hub import ws_hub


class OnboardingToolkit(llm.FunctionContext):
    """Tools available to the onboarding voice agent"""

    def __init__(self, session_id: str, context):
        super().__init__()
        self.session_id = session_id
        self.context = context

    # =========================================================================
    # COMPANY TOOLS
    # =========================================================================

    @llm.ai_callable(
        description="Update company profile information. Call when user provides or corrects company details."
    )
    async def update_company_profile(
        self,
        field: str = llm.TypeInfo(
            description="Field to update: tagline, product_description, problem_solved, team_size, headquarters"
        ),
        value: str = llm.TypeInfo(description="New value for the field"),
    ):
        """Update a company profile field"""
        await job_profile_repo.update_company_field(
            session_id=self.session_id,
            field=field,
            value=value
        )
        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="company",
            data={"field": field, "value": value}
        )
        return f"Updated company {field}"

    # =========================================================================
    # REQUIREMENTS TOOLS
    # =========================================================================

    @llm.ai_callable(
        description="Update job hard requirements. Call when user specifies job title, location, experience, or compensation."
    )
    async def update_requirements(
        self,
        job_title: Optional[str] = llm.TypeInfo(description="Job title", default=None),
        location_type: Optional[str] = llm.TypeInfo(
            description="onsite, hybrid, or remote", default=None
        ),
        location_city: Optional[str] = llm.TypeInfo(description="City name", default=None),
        onsite_days: Optional[int] = llm.TypeInfo(
            description="Days per week in office for hybrid", default=None
        ),
        visa_sponsorship: Optional[bool] = llm.TypeInfo(
            description="Whether visa sponsorship is available", default=None
        ),
        experience_min: Optional[int] = llm.TypeInfo(
            description="Minimum years of experience", default=None
        ),
        experience_max: Optional[int] = llm.TypeInfo(
            description="Maximum years of experience", default=None
        ),
        salary_min: Optional[int] = llm.TypeInfo(
            description="Minimum salary in USD", default=None
        ),
        salary_max: Optional[int] = llm.TypeInfo(
            description="Maximum salary in USD", default=None
        ),
        equity_offered: Optional[bool] = llm.TypeInfo(
            description="Whether equity is offered", default=None
        ),
        equity_range: Optional[str] = llm.TypeInfo(
            description="Equity range like 0.1-0.25%", default=None
        ),
    ):
        """Update job requirements"""
        updates = {
            k: v for k, v in {
                "job_title": job_title,
                "location_type": location_type,
                "location_city": location_city,
                "onsite_days_per_week": onsite_days,
                "visa_sponsorship": visa_sponsorship,
                "experience_min_years": experience_min,
                "experience_max_years": experience_max,
                "salary_min": salary_min,
                "salary_max": salary_max,
                "equity_offered": equity_offered,
                "equity_range": equity_range,
            }.items() if v is not None
        }

        await job_profile_repo.update_requirements(
            session_id=self.session_id,
            updates=updates
        )

        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="requirements",
            data=updates
        )

        return f"Updated requirements: {', '.join(updates.keys())}"

    # =========================================================================
    # TRAIT TOOLS
    # =========================================================================

    @llm.ai_callable(
        description="Create a new candidate trait. Traits should be conceptual (like 'Backend Architecture') not individual technologies (like 'Python'). Every trait MUST have a description."
    )
    async def create_trait(
        self,
        name: str = llm.TypeInfo(
            description="Conceptual trait name, e.g., 'Distributed Systems', 'Frontend Architecture'"
        ),
        description: str = llm.TypeInfo(
            description="1-2 sentence description of what this trait means for the role"
        ),
        priority: str = llm.TypeInfo(
            description="must_have or nice_to_have", default="must_have"
        ),
        signals: List[str] = llm.TypeInfo(
            description="What to look for in candidates", default=[]
        ),
    ):
        """Create a candidate trait"""
        trait = CandidateTrait(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            priority=TraitPriority(priority),
            signals=signals,
        )

        await job_profile_repo.add_trait(self.session_id, trait)

        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="trait_created",
            data=trait.dict()
        )

        return f"Created trait: {name}"

    @llm.ai_callable(
        description="Update an existing trait's details"
    )
    async def update_trait(
        self,
        trait_name: str = llm.TypeInfo(description="Name of trait to update"),
        new_description: Optional[str] = llm.TypeInfo(default=None),
        new_priority: Optional[str] = llm.TypeInfo(default=None),
        add_signals: Optional[List[str]] = llm.TypeInfo(default=None),
    ):
        """Update a trait"""
        updates = {}
        if new_description:
            updates["description"] = new_description
        if new_priority:
            updates["priority"] = new_priority
        if add_signals:
            updates["add_signals"] = add_signals

        await job_profile_repo.update_trait(
            session_id=self.session_id,
            trait_name=trait_name,
            updates=updates
        )

        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="trait_updated",
            data={"name": trait_name, "updates": updates}
        )

        return f"Updated trait: {trait_name}"

    @llm.ai_callable(
        description="Delete a trait that is no longer relevant"
    )
    async def delete_trait(
        self,
        trait_name: str = llm.TypeInfo(description="Name of trait to delete"),
    ):
        """Delete a trait"""
        await job_profile_repo.delete_trait(self.session_id, trait_name)

        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="trait_deleted",
            data={"name": trait_name}
        )

        return f"Deleted trait: {trait_name}"

    # =========================================================================
    # INTERVIEW STAGE TOOLS
    # =========================================================================

    @llm.ai_callable(
        description="Create an interview stage. Include what it evaluates and recruiter actions."
    )
    async def create_interview_stage(
        self,
        name: str = llm.TypeInfo(description="Stage name, e.g., 'Phone Screen', 'Technical'"),
        description: str = llm.TypeInfo(description="What this stage evaluates"),
        duration_minutes: Optional[int] = llm.TypeInfo(default=None),
        interviewer_role: Optional[str] = llm.TypeInfo(
            description="Who conducts this, e.g., 'Recruiter', 'Hiring Manager'", default=None
        ),
        actions: List[str] = llm.TypeInfo(
            description="Recruiter instructions like 'Send calendar invite'", default=[]
        ),
    ):
        """Create an interview stage"""
        # Get current stage count for ordering
        profile = await job_profile_repo.get(self.session_id)
        order = len(profile.interview_stages) + 1

        stage = InterviewStage(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            order=order,
            duration_minutes=duration_minutes,
            interviewer_role=interviewer_role,
            actions=actions,
        )

        await job_profile_repo.add_interview_stage(self.session_id, stage)

        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="stage_created",
            data=stage.dict()
        )

        return f"Created interview stage: {name}"

    @llm.ai_callable(
        description="Update an interview stage"
    )
    async def update_interview_stage(
        self,
        stage_name: str = llm.TypeInfo(description="Name of stage to update"),
        new_description: Optional[str] = llm.TypeInfo(default=None),
        new_duration: Optional[int] = llm.TypeInfo(default=None),
        add_actions: Optional[List[str]] = llm.TypeInfo(default=None),
    ):
        """Update an interview stage"""
        updates = {}
        if new_description:
            updates["description"] = new_description
        if new_duration:
            updates["duration_minutes"] = new_duration
        if add_actions:
            updates["add_actions"] = add_actions

        await job_profile_repo.update_interview_stage(
            session_id=self.session_id,
            stage_name=stage_name,
            updates=updates
        )

        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="stage_updated",
            data={"name": stage_name, "updates": updates}
        )

        return f"Updated stage: {stage_name}"

    @llm.ai_callable(
        description="Delete an interview stage"
    )
    async def delete_interview_stage(
        self,
        stage_name: str = llm.TypeInfo(description="Name of stage to delete"),
    ):
        """Delete an interview stage"""
        await job_profile_repo.delete_interview_stage(self.session_id, stage_name)

        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="stage_deleted",
            data={"name": stage_name}
        )

        return f"Deleted stage: {stage_name}"

    # =========================================================================
    # NUANCE CAPTURE
    # =========================================================================

    @llm.ai_callable(
        description="Capture qualitative insights that don't fit structured fields. Use for culture fit notes, hidden preferences, selling points, team dynamics, etc."
    )
    async def capture_nuance(
        self,
        category: str = llm.TypeInfo(
            description="culture_fit, hidden_pref, red_flag, selling_point, team_dynamic, growth_path, urgency, or other"
        ),
        insight: str = llm.TypeInfo(description="The insight in plain language"),
        verbatim_quote: Optional[str] = llm.TypeInfo(
            description="Exact user words if particularly useful", default=None
        ),
    ):
        """Capture qualitative nuance"""
        nuance = NuanceCapture(
            id=str(uuid.uuid4()),
            category=NuanceCategory(category),
            insight=insight,
            verbatim_quote=verbatim_quote,
        )

        await job_profile_repo.add_nuance(self.session_id, nuance)

        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="nuance_captured",
            data=nuance.dict()
        )

        return f"Captured insight: {category}"

    # =========================================================================
    # PROGRESS TRACKING
    # =========================================================================

    @llm.ai_callable(
        description="Mark a field as confirmed/complete. Call after user explicitly confirms a piece of information."
    )
    async def mark_field_complete(
        self,
        field_name: str = llm.TypeInfo(
            description="Field that has been confirmed: job_title, location, experience, compensation, visa, equity, traits, interview_stages"
        ),
    ):
        """Mark a field as confirmed"""
        await job_profile_repo.mark_field_complete(self.session_id, field_name)

        # Check if profile is now complete
        profile = await job_profile_repo.get(self.session_id)
        missing = profile.get_missing_fields()

        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="field_complete",
            data={
                "field": field_name,
                "remaining": missing,
                "is_complete": len(missing) == 0
            }
        )

        if len(missing) == 0:
            return "Profile complete! All required fields have been filled."
        else:
            return f"Confirmed {field_name}. Still need: {', '.join(missing)}"

    @llm.ai_callable(
        description="Get current profile status including what's missing"
    )
    async def get_profile_status(self):
        """Get current profile completion status"""
        profile = await job_profile_repo.get(self.session_id)
        missing = profile.get_missing_fields()
        completion = profile.calculate_completion_percentage()

        return {
            "completion_percentage": completion,
            "missing_fields": missing,
            "traits_count": len(profile.traits),
            "stages_count": len(profile.interview_stages),
        }

    # =========================================================================
    # COMPLETION
    # =========================================================================

    @llm.ai_callable(
        description="Mark onboarding as complete. Only call when all required fields are filled."
    )
    async def complete_onboarding(self):
        """Mark onboarding complete"""
        profile = await job_profile_repo.get(self.session_id)
        missing = profile.get_missing_fields()

        if missing:
            return f"Cannot complete - still missing: {', '.join(missing)}"

        await job_profile_repo.mark_complete(self.session_id)

        await ws_hub.send_update(
            session_id=self.session_id,
            update_type="onboarding_complete",
            data={"profile_id": self.session_id}
        )

        return "Onboarding complete! Profile is ready."
```

---

### System Prompt Builder

```python
# backend/agents/prompts.py

from models.voice_ingest import ConversationContext


def build_system_prompt(context: ConversationContext) -> str:
    """Build the system prompt for the voice agent"""

    # Format company intelligence
    company_section = ""
    if context.company_intel:
        ci = context.company_intel
        company_section = f"""
## COMPANY INTELLIGENCE (from web research)

Company: {ci.name}
{f'"{ci.tagline}"' if ci.tagline else ""}

Stage: {ci.funding_stage.value.replace("_", " ").title() if ci.funding_stage else "Unknown"}
{f"Total raised: {ci.total_raised}" if ci.total_raised else ""}
{f"Investors: {', '.join(ci.investors)}" if ci.investors else ""}

Product: {ci.product_description or "Unknown"}
{f"Problem: {ci.problem_solved}" if ci.problem_solved else ""}

Team: {ci.team_size or "Unknown"} people
HQ: {ci.headquarters or "Unknown"}
{f"Other offices: {', '.join(ci.office_locations)}" if ci.office_locations else ""}

{f"Tech stack hints: {', '.join(ci.tech_stack_hints)}" if ci.tech_stack_hints else ""}
{f"Competitors: {', '.join(ci.competitors)}" if ci.competitors else ""}
{f"Culture: {', '.join(ci.culture_keywords)}" if ci.culture_keywords else ""}

{f"Recent news: {'; '.join(ci.recent_news)}" if ci.recent_news else ""}

Interesting facts you can reference:
{chr(10).join(f"- {fact}" for fact in ci.interesting_facts) if ci.interesting_facts else "- None found"}

Potential selling points for candidates:
{chr(10).join(f"- {point}" for point in ci.potential_selling_points) if ci.potential_selling_points else "- Growing company"}
"""

    # Format extracted profile
    profile_section = ""
    if context.current_profile:
        p = context.current_profile
        req = p.requirements

        profile_section = f"""
## WHAT WE KNOW SO FAR

Job Title: {req.job_title or "Not set"}
Location: {req.location_type.value if req.location_type else "Not set"}
{f"City: {req.location_city}" if req.location_city else ""}
{f"Onsite days: {req.onsite_days_per_week}/week" if req.onsite_days_per_week else ""}

Experience: {f"{req.experience_min_years}+ years" if req.experience_min_years else "Not set"}
{f"(max {req.experience_max_years} years)" if req.experience_max_years else ""}

Compensation: {f"${req.salary_min:,}-${req.salary_max:,}" if req.salary_min else "Not set"}
Equity: {req.equity_range if req.equity_range else ("Yes" if req.equity_offered else "Not set")}
Visa: {"Yes" if req.visa_sponsorship else ("No" if req.visa_sponsorship is False else "Not set")}

Traits ({len(p.traits)}):
{chr(10).join(f"- {t.name}: {t.description}" for t in p.traits) if p.traits else "- None defined yet"}

Interview Stages ({len(p.interview_stages)}):
{chr(10).join(f"- {s.order}. {s.name}: {s.description}" for s in p.interview_stages) if p.interview_stages else "- None defined yet"}
"""

    # Format missing fields
    missing_section = ""
    if context.missing_fields:
        missing_section = f"""
## WHAT WE STILL NEED

Required fields missing: {", ".join(context.missing_fields)}

These are the gaps you need to fill through conversation.
Ask about them naturally, don't rapid-fire.
"""

    # Format smart questions
    questions_section = ""
    if context.smart_questions:
        questions_section = """
## SMART QUESTIONS TO WEAVE IN

These are contextual questions based on company research. Use them naturally:

"""
        for q in context.smart_questions:
            questions_section += f"- {q.question}\n  (Why: {q.why})\n\n"

    return f"""
You are an expert recruiting assistant helping {context.user_first_name} build a complete hiring profile for their role.

Your job is to have a natural conversation that captures all the information needed to find great candidates. You've done your homework on the company - use that knowledge to sound informed and ask relevant questions.

{company_section}

{profile_section}

{missing_section}

## YOUR APPROACH

1. **Sound informed**: Reference company details naturally. Show you've done research.

2. **Start with the opening**: Use this opener to begin:
   "{context.opening_hook}"

3. **Listen actively**: Let them talk freely. Extract information as they speak.
   Don't interrupt with form-like questions.

4. **Ask smart questions**: Go beyond hard requirements. Capture:
   - Role scope and how it might evolve
   - Team dynamics and reporting structure
   - What "great" looks like vs "good enough"
   - Hidden preferences (backgrounds they love or avoid)
   - Selling points for candidates
   - Red flags to watch for

5. **Fill gaps naturally**: Weave required questions into conversation.
   One topic at a time. Don't rapid-fire.

6. **Use tools in real-time**: Call update tools AS you learn things.
   The UI updates live - the user sees their words become structured data.
   Don't wait until the end to update.

7. **Confirm inferences**: If you infer something, confirm it.
   "It sounds like you'd want someone more senior - 7+ years. Is that right?"

8. **Capture nuance**: Use capture_nuance for insights that don't fit fields:
   - "They want someone scrappy" → culture_fit
   - "Would love ex-Stripe people" → hidden_pref
   - "Avoid job hoppers" → red_flag
   - "CTO mentors everyone" → selling_point

{questions_section}

## RESPONSE STYLE

- Be conversational, not formal
- Keep responses concise - you're speaking, not writing
- Use brief acknowledgments ("Got it", "Makes sense", "Perfect")
- Don't parrot back everything they said
- Ask follow-up questions naturally
- When a topic is complete, transition smoothly to the next gap

## COMPLETION

When all required fields are filled:
1. Summarize what you've captured (brief, not exhaustive)
2. Ask if anything needs adjustment
3. Call complete_onboarding when they confirm

Example: "Perfect - I've got the full picture. Senior backend role, hybrid in SF,
distributed systems focus, 150-180 plus equity, three-stage interview process.
Anything you'd like to adjust, or are we good to go?"
"""


def build_opening_hook(context: ConversationContext) -> str:
    """Generate personalized opening based on company context"""

    user_name = context.user_first_name
    ci = context.company_intel

    if ci and ci.tagline:
        return f"Hey {user_name}! I pulled some info on {ci.name} - {ci.tagline}. Tell me about this role you're hiring for. What would this person actually own?"

    if ci and ci.product_description:
        return f"Hey {user_name}! I see {ci.name} is building {ci.product_description}. Tell me about this role - what's the problem you're solving with this hire?"

    if ci and ci.funding_stage:
        stage = ci.funding_stage.value.replace("_", " ").title()
        return f"Hey {user_name}! I see {ci.name} is at {stage} stage. Tell me everything about this role - who you're looking for, what they'd work on, what matters most."

    return f"Hey {user_name}! Tell me everything about this role at {ci.name if ci else 'your company'}. What would this person own, and what kind of candidate would crush it?"
```

---

### Context Builder

```python
# backend/agents/context.py

from models.voice_ingest import ConversationContext, SmartQuestion
from repositories.job_profile_repository import job_profile_repo
from services.smart_questions import generate_smart_questions
from agents.prompts import build_opening_hook


async def build_agent_context(session_id: str) -> ConversationContext:
    """
    Build complete context for the voice agent.
    Called when agent starts.
    """

    # Get profile from database
    profile = await job_profile_repo.get(session_id)

    if not profile:
        raise ValueError(f"No profile found for session {session_id}")

    # Calculate what's missing
    missing_fields = profile.get_missing_fields()

    # Determine confirmed fields
    confirmed = []
    req = profile.requirements
    if req.job_title:
        confirmed.append("job_title")
    if req.location_type:
        confirmed.append("location")
    if req.experience_min_years is not None:
        confirmed.append("experience")
    if req.salary_min is not None:
        confirmed.append("compensation")
    if req.visa_sponsorship is not None:
        confirmed.append("visa")
    if req.equity_offered is not None:
        confirmed.append("equity")
    if len(profile.traits) > 0:
        confirmed.append("traits")
    if len(profile.interview_stages) > 0:
        confirmed.append("interview_stages")

    # Generate smart questions based on company intel
    smart_questions = []
    if profile.company:
        smart_questions = generate_smart_questions(
            company=profile.company,
            missing_fields=missing_fields
        )

    # Build context
    context = ConversationContext(
        session_id=session_id,
        user_first_name=profile.recruiter_first_name,
        user_last_name=profile.recruiter_last_name,
        company_intel=profile.company,
        current_profile=profile,
        confirmed_fields=confirmed,
        missing_fields=missing_fields,
        smart_questions=smart_questions,
        opening_hook=""  # Set below
    )

    # Generate opening hook
    context.opening_hook = build_opening_hook(context)

    return context
```

---

### WebSocket Hub for UI Updates

```python
# backend/services/websocket_hub.py

from fastapi import WebSocket
from typing import Dict, Set
import json
import asyncio


class WebSocketHub:
    """Manages WebSocket connections for real-time UI updates"""

    def __init__(self):
        # session_id -> set of connected websockets
        self.connections: Dict[str, Set[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, session_id: str, websocket: WebSocket):
        """Register a new WebSocket connection"""
        await websocket.accept()

        async with self.lock:
            if session_id not in self.connections:
                self.connections[session_id] = set()
            self.connections[session_id].add(websocket)

    async def disconnect(self, session_id: str, websocket: WebSocket):
        """Remove a WebSocket connection"""
        async with self.lock:
            if session_id in self.connections:
                self.connections[session_id].discard(websocket)
                if not self.connections[session_id]:
                    del self.connections[session_id]

    async def send_update(self, session_id: str, update_type: str, data: dict):
        """Send update to all connected clients for a session"""
        message = json.dumps({
            "type": update_type,
            "data": data
        })

        async with self.lock:
            if session_id not in self.connections:
                return

            dead_connections = set()

            for ws in self.connections[session_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead_connections.add(ws)

            # Clean up dead connections
            self.connections[session_id] -= dead_connections


# Global instance
ws_hub = WebSocketHub()
```

---

### WebSocket Endpoint

```python
# backend/routers/websocket.py

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.websocket_hub import ws_hub

router = APIRouter()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time UI updates"""

    await ws_hub.connect(session_id, websocket)

    try:
        while True:
            # Keep connection alive, handle any client messages
            data = await websocket.receive_text()
            # Could handle client-to-server messages here if needed

    except WebSocketDisconnect:
        await ws_hub.disconnect(session_id, websocket)
```

---

## Environment Variables

```bash
# .env additions for Phase 4

# LiveKit
LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Speech services
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key  # For TTS

# Already have from previous phases
OPENROUTER_API_KEY=your_openrouter_key
```

---

## Running the Agent

```bash
# Start the LiveKit agent worker
cd backend
python -m agents.onboarding_agent dev

# In production, use:
python -m agents.onboarding_agent start
```

---

## Next Phase

[Phase 5: Frontend Components](./phase5-frontend.md) - Real-time UI with glassmorphic cards and voice interface
