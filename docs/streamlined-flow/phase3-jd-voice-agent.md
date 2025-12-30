# Phase 3: JD Extraction Voice Agent

## Overview

This phase implements the voice agent that talks to the **recruiter** (not the candidate) to extract additional context about the job. This agent enriches the job description with information that's often in the recruiter's head but not in the written JD.

## What This Agent Does

After the recruiter pastes a job description and basic requirements are extracted, this voice agent:

1. **Reviews what was extracted** from the JD
2. **Asks clarifying questions** about gaps in the extracted data
3. **Extracts company context** (culture, team, growth stage)
4. **Defines scoring criteria** (what makes a strong candidate)
5. **Identifies red flags** (what to watch out for)
6. **Captures nuances** that can't be extracted from text

## Agent Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    JD EXTRACTION VOICE AGENT FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Introduction                                                        │
│  ───────────────────                                                         │
│  Agent: "Hi! I've reviewed the job description for [Job Title].              │
│          I'd like to ask a few questions to help me understand               │
│          exactly what you're looking for. This will help us                  │
│          evaluate candidates more accurately."                               │
│                                                                              │
│  STEP 2: Verify Extracted Requirements                                       │
│  ─────────────────────────────────────                                       │
│  Agent: "I extracted that you need [X years experience] and                  │
│          skills in [skill1, skill2]. Is this accurate?                       │
│          Anything to add or change?"                                         │
│                                                                              │
│  STEP 3: Company Context Questions                                           │
│  ─────────────────────────────────                                           │
│  • "Tell me about the team this person would be joining"                     │
│  • "What's the company culture like?"                                        │
│  • "Who would they report to?"                                               │
│  • "What's the growth stage - startup, scale-up, enterprise?"                │
│                                                                              │
│  STEP 4: Ideal Candidate Profile                                             │
│  ───────────────────────────────                                             │
│  • "What does your ideal candidate look like?"                               │
│  • "What experience would make someone stand out?"                           │
│  • "Are there specific companies you'd love to hire from?"                   │
│  • "What personality traits work well on your team?"                         │
│                                                                              │
│  STEP 5: Scoring & Evaluation                                                │
│  ───────────────────────────                                                 │
│  • "What are the absolute must-haves vs nice-to-haves?"                      │
│  • "How important is technical skill vs communication?"                      │
│  • "What would make you immediately excited about a candidate?"              │
│                                                                              │
│  STEP 6: Red Flags                                                           │
│  ─────────────────                                                           │
│  • "What would be a dealbreaker for this role?"                              │
│  • "Any past hiring mistakes you want to avoid repeating?"                   │
│  • "Are there any backgrounds or patterns that concern you?"                 │
│                                                                              │
│  STEP 7: Wrap-up                                                             │
│  ────────────                                                                │
│  Agent: "Great! I now have a clear picture of what you're looking for.       │
│          Let me summarize: [summary]. Does this sound right?"                │
│                                                                              │
│  → Updates Job record with enriched data                                     │
│  → Job status changes from 'draft' to 'active'                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Backend Implementation

### Voice Agent Configuration

```python
# backend/agents/jd_extraction_agent.py

from livekit.agents import Agent, JobContext, WorkerOptions, cli
from livekit.agents.llm import ChatContext, ChatMessage
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import openai, silero

import json
from typing import Optional
from models.streamlined.job import Job, CompanyContext, ScoringCriteria


def build_jd_extraction_prompt(job: Job) -> str:
    """
    Build the system prompt for the JD extraction agent.
    Includes the job data we've already extracted.
    """
    extracted = job.extracted_requirements

    prompt = f"""You are a friendly HR consultant helping a recruiter define their hiring criteria for a {job.title} position.

CONTEXT - What we already know from the job description:
- Job Title: {job.title}
- Experience Required: {extracted.years_experience if extracted else 'Not specified'}
- Required Skills: {', '.join(extracted.required_skills) if extracted and extracted.required_skills else 'Not specified'}
- Preferred Skills: {', '.join(extracted.preferred_skills) if extracted and extracted.preferred_skills else 'Not specified'}
- Location: {extracted.location if extracted else 'Not specified'}
- Work Type: {extracted.work_type if extracted else 'Not specified'}

YOUR ROLE:
You are having a voice conversation with the recruiter. Your goal is to extract information that's NOT in the written job description but is in the recruiter's head.

CONVERSATION FLOW:
1. Briefly greet them and confirm the role they're hiring for
2. Verify the extracted requirements are correct
3. Ask about company/team context (culture, size, reporting structure)
4. Ask about their ideal candidate profile
5. Define scoring criteria (must-haves vs nice-to-haves, weighting)
6. Identify red flags and dealbreakers
7. Summarize what you learned and confirm

GUIDELINES:
- Be conversational, not robotic
- Ask ONE question at a time
- Listen carefully and ask follow-up questions
- Don't repeat information they've already given
- If they give short answers, probe deeper
- Keep the conversation focused (aim for 5-7 minutes total)

EXTRACTION TARGETS:
You need to extract:
1. company_context: company culture, team size, reporting structure, growth stage
2. scoring_criteria: must-haves, nice-to-haves, personality traits, skill weights
3. red_flags: dealbreakers, patterns to avoid

After gathering information, output a JSON summary in this format:
{{
    "company_context": {{
        "company_name": "...",
        "team_size": "...",
        "team_culture": "...",
        "reporting_to": "...",
        "growth_stage": "..."
    }},
    "scoring_criteria": {{
        "must_haves": ["...", "..."],
        "nice_to_haves": ["...", "..."],
        "cultural_fit_traits": ["...", "..."],
        "technical_competencies": ["...", "..."],
        "weight_technical": 0.5,
        "weight_experience": 0.3,
        "weight_cultural": 0.2
    }},
    "red_flags": ["...", "..."]
}}

Remember: You're talking to the RECRUITER, not a candidate. Be professional but friendly."""

    return prompt


class JDExtractionAgent:
    """
    Voice agent that extracts job details from recruiter conversation.
    """

    def __init__(self, job_id: str):
        self.job_id = job_id
        self.job: Optional[Job] = None
        self.extracted_data = {}
        self.conversation_complete = False

    async def load_job(self):
        """Load job data from database."""
        from repositories.streamlined.job_repo import JobRepository
        repo = JobRepository()
        self.job = await repo.get_by_id(self.job_id)

    async def save_extracted_data(self):
        """Save extracted data back to job."""
        from repositories.streamlined.job_repo import JobRepository
        from models.streamlined.job import JobUpdate, JobStatus

        repo = JobRepository()

        update = JobUpdate(
            company_context=CompanyContext(**self.extracted_data.get("company_context", {})),
            scoring_criteria=ScoringCriteria(**self.extracted_data.get("scoring_criteria", {})),
            red_flags=self.extracted_data.get("red_flags", []),
            status=JobStatus.ACTIVE  # Activate job after enrichment
        )

        await repo.update(self.job_id, update)

    async def run(self, ctx: JobContext):
        """Main agent loop."""
        await self.load_job()

        if not self.job:
            print(f"Job {self.job_id} not found")
            return

        # Build the system prompt with job context
        system_prompt = build_jd_extraction_prompt(self.job)

        # Create chat context
        chat_ctx = ChatContext()
        chat_ctx.append(ChatMessage(role="system", content=system_prompt))

        # Initialize voice assistant with Gemini 2.5 Flash via OpenRouter
        from config import LLM_MODEL
        OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
        OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

        assistant = VoiceAssistant(
            vad=silero.VAD.load(),
            stt=openai.STT(),
            llm=openai.LLM(
                model=LLM_MODEL,  # google/gemini-2.5-flash
                base_url=OPENROUTER_BASE_URL,
                api_key=OPENROUTER_API_KEY,
            ),
            tts=openai.TTS(voice="alloy"),
            chat_ctx=chat_ctx,
        )

        # Handle agent speech for extraction
        @assistant.on("agent_speech_committed")
        def on_speech(text: str):
            # Check if agent outputted JSON extraction
            if "{" in text and "company_context" in text:
                try:
                    # Extract JSON from the response
                    json_start = text.find("{")
                    json_end = text.rfind("}") + 1
                    json_str = text[json_start:json_end]
                    self.extracted_data = json.loads(json_str)
                    self.conversation_complete = True
                except json.JSONDecodeError:
                    pass

        # Start the assistant
        assistant.start(ctx.room)

        # Wait for conversation to complete
        await assistant.say(
            f"Hi! I've reviewed the job description for {self.job.title}. "
            "I'd like to ask you a few questions to help me understand exactly what you're looking for. "
            "This will help us evaluate candidates more accurately. Ready to get started?"
        )

        # The conversation continues via the voice assistant
        # When the agent outputs the JSON summary, we save it

        # Wait for completion signal (timeout after 15 minutes)
        import asyncio
        timeout = 60 * 15  # 15 minutes
        start_time = asyncio.get_event_loop().time()

        while not self.conversation_complete:
            await asyncio.sleep(1)
            if asyncio.get_event_loop().time() - start_time > timeout:
                break

        # Save extracted data
        if self.extracted_data:
            await self.save_extracted_data()


async def entrypoint(ctx: JobContext):
    """Entry point for the JD extraction agent."""
    # Get job_id from room metadata
    room_metadata = ctx.room.metadata
    if not room_metadata:
        print("No room metadata found")
        return

    metadata = json.loads(room_metadata)
    job_id = metadata.get("job_id")

    if not job_id:
        print("No job_id in room metadata")
        return

    agent = JDExtractionAgent(job_id)
    await agent.run(ctx)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

### API Endpoint for Starting Voice Enrichment

```python
# backend/routers/jobs.py (additional endpoint)

from livekit import api as livekit_api
import os

@router.post("/{job_id}/enrich/start")
async def start_job_enrichment(
    job_id: UUID,
    repo: JobRepository = Depends(get_job_repo)
):
    """
    Start a voice session for job enrichment.

    Returns LiveKit room credentials for the frontend to connect.
    """
    job = await repo.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Create LiveKit room
    room_name = f"jd-enrich-{job_id}"

    livekit_client = livekit_api.LiveKitAPI(
        os.getenv("LIVEKIT_URL"),
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )

    # Create room with metadata containing job_id
    room_metadata = json.dumps({
        "job_id": str(job_id),
        "mode": "jd_extraction"
    })

    await livekit_client.room.create_room(
        livekit_api.CreateRoomRequest(
            name=room_name,
            metadata=room_metadata,
        )
    )

    # Generate token for recruiter
    token = livekit_api.AccessToken(
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )
    token.with_identity(f"recruiter-{job_id}")
    token.with_name("Recruiter")
    token.with_grants(livekit_api.VideoGrants(
        room_join=True,
        room=room_name,
    ))

    return {
        "room_name": room_name,
        "token": token.to_jwt(),
        "livekit_url": os.getenv("LIVEKIT_WS_URL"),
    }


@router.post("/{job_id}/enrich/complete")
async def complete_job_enrichment(
    job_id: UUID,
    repo: JobRepository = Depends(get_job_repo)
):
    """
    Called when voice enrichment is complete.

    The agent saves data directly, this just confirms completion
    and cleans up the room.
    """
    job = await repo.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Clean up LiveKit room
    room_name = f"jd-enrich-{job_id}"

    try:
        livekit_client = livekit_api.LiveKitAPI(
            os.getenv("LIVEKIT_URL"),
            os.getenv("LIVEKIT_API_KEY"),
            os.getenv("LIVEKIT_API_SECRET"),
        )
        await livekit_client.room.delete_room(
            livekit_api.DeleteRoomRequest(room=room_name)
        )
    except Exception:
        pass  # Room might already be deleted

    return {"status": "completed", "job_id": str(job_id)}
```

---

## Frontend Implementation

### Voice Enrichment Page

```tsx
// frontend/src/app/jobs/[id]/enrich/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
} from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, CheckCircle, Loader2 } from "lucide-react";

interface Job {
  id: string;
  title: string;
  extracted_requirements: any;
}

interface RoomCredentials {
  room_name: string;
  token: string;
  livekit_url: string;
}

export default function JobEnrichPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [credentials, setCredentials] = useState<RoomCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    fetchJob();
  }, [params.id]);

  const fetchJob = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/jobs/${params.id}`
      );
      const data = await response.json();
      setJob(data);
    } catch (error) {
      console.error("Failed to fetch job:", error);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/jobs/${params.id}/enrich/start`,
        { method: "POST" }
      );
      const data = await response.json();
      setCredentials(data);
      setSessionStarted(true);
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  const completeSession = async () => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/jobs/${params.id}/enrich/complete`,
        { method: "POST" }
      );
      setSessionComplete(true);
      // Redirect to job detail page after short delay
      setTimeout(() => {
        router.push(`/jobs/${params.id}`);
      }, 2000);
    } catch (error) {
      console.error("Failed to complete session:", error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return <div className="container mx-auto p-6">Job not found</div>;
  }

  if (sessionComplete) {
    return (
      <div className="container mx-auto p-6 flex flex-col items-center justify-center min-h-screen">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Job Enriched Successfully!</h1>
        <p className="text-muted-foreground">Redirecting to job details...</p>
      </div>
    );
  }

  if (!sessionStarted || !credentials) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Enrich Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">{job.title}</h2>
              <Badge>Draft</Badge>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-medium mb-2">What we extracted so far:</h3>
              {job.extracted_requirements ? (
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {job.extracted_requirements.years_experience && (
                    <li>Experience: {job.extracted_requirements.years_experience}</li>
                  )}
                  {job.extracted_requirements.required_skills?.length > 0 && (
                    <li>
                      Skills: {job.extracted_requirements.required_skills.join(", ")}
                    </li>
                  )}
                  {job.extracted_requirements.location && (
                    <li>Location: {job.extracted_requirements.location}</li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Requirements still being extracted...
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">What happens next:</h3>
              <p className="text-sm text-muted-foreground">
                Our AI assistant will have a brief conversation with you to understand:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Your company and team context</li>
                <li>What your ideal candidate looks like</li>
                <li>How to score and evaluate candidates</li>
                <li>Any red flags or dealbreakers</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                This typically takes 5-7 minutes.
              </p>
            </div>

            <Button className="w-full" size="lg" onClick={startSession}>
              <Mic className="mr-2 h-5 w-5" />
              Start Voice Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={credentials.token}
      serverUrl={credentials.livekit_url}
      connect={true}
      audio={true}
      video={false}
    >
      <VoiceEnrichmentRoom
        job={job}
        onComplete={completeSession}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}


function VoiceEnrichmentRoom({
  job,
  onComplete,
}: {
  job: Job;
  onComplete: () => void;
}) {
  const { state, audioTrack } = useVoiceAssistant();
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    // Toggle local audio track
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Voice Enrichment: {job.title}</CardTitle>
            <Badge variant={state === "speaking" ? "default" : "secondary"}>
              {state === "speaking" ? "AI Speaking" : state === "listening" ? "Listening" : "Processing"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Audio Visualizer */}
          <div className="h-24 bg-muted rounded-lg flex items-center justify-center">
            {audioTrack && (
              <BarVisualizer
                state={state}
                trackRef={audioTrack}
                barCount={7}
                options={{ minHeight: 10 }}
              />
            )}
          </div>

          {/* Status */}
          <div className="text-center">
            <p className="text-muted-foreground">
              {state === "speaking"
                ? "AI is speaking..."
                : state === "listening"
                ? "Speak now - the AI is listening"
                : "Processing..."}
            </p>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4">
            <Button
              variant={isMuted ? "destructive" : "outline"}
              size="lg"
              onClick={toggleMute}
            >
              {isMuted ? (
                <>
                  <MicOff className="mr-2 h-5 w-5" />
                  Unmute
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-5 w-5" />
                  Mute
                </>
              )}
            </Button>

            <Button size="lg" onClick={onComplete}>
              <CheckCircle className="mr-2 h-5 w-5" />
              Complete Session
            </Button>
          </div>

          {/* Tips */}
          <div className="bg-muted/50 p-4 rounded-lg text-sm">
            <h4 className="font-medium mb-2">Tips for best results:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Speak clearly and at a normal pace</li>
              <li>Give detailed answers - more context helps</li>
              <li>Feel free to ask the AI to repeat or clarify</li>
              <li>You can end the session early if you've covered everything</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Real-time UI Updates

As the agent extracts information, we can show it in real-time using WebSocket updates.

```python
# backend/services/websocket_updates.py

from fastapi import WebSocket
from typing import Dict, Set
import json

# Store active connections per job
job_connections: Dict[str, Set[WebSocket]] = {}


async def broadcast_to_job(job_id: str, message: dict):
    """Broadcast a message to all clients watching a job."""
    if job_id not in job_connections:
        return

    disconnected = set()
    for ws in job_connections[job_id]:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.add(ws)

    # Clean up disconnected clients
    job_connections[job_id] -= disconnected


async def notify_extraction_progress(job_id: str, field: str, value: any):
    """Notify clients that a field was extracted."""
    await broadcast_to_job(job_id, {
        "type": "extraction_progress",
        "field": field,
        "value": value,
    })


async def notify_enrichment_complete(job_id: str):
    """Notify clients that enrichment is complete."""
    await broadcast_to_job(job_id, {
        "type": "enrichment_complete",
        "job_id": job_id,
    })
```

---

## LiveKit Agent Worker

The agent needs to be run as a separate worker process.

```python
# backend/agents/run_jd_agent.py

"""
Run the JD extraction agent worker.

Usage:
    python -m agents.run_jd_agent

This connects to LiveKit and listens for rooms with mode='jd_extraction'.
"""

from livekit.agents import cli, WorkerOptions
from agents.jd_extraction_agent import entrypoint

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            # Only handle JD extraction rooms
            room_filter=lambda room: (
                room.metadata and
                '"mode": "jd_extraction"' in room.metadata
            )
        )
    )
```

---

## Implementation Steps

1. **Create agent files:**
   - `backend/agents/jd_extraction_agent.py`
   - `backend/agents/run_jd_agent.py`

2. **Add API endpoints** to `backend/routers/jobs.py`:
   - `POST /jobs/{job_id}/enrich/start`
   - `POST /jobs/{job_id}/enrich/complete`

3. **Create frontend page:**
   - `frontend/src/app/jobs/[id]/enrich/page.tsx`

4. **Configure LiveKit** (if not already):
   - Ensure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` are set
   - Ensure `LIVEKIT_WS_URL` is set for client connections

5. **Run the agent worker** in a separate terminal:
   ```bash
   python -m agents.run_jd_agent
   ```

## Agent Conversation Example

```
AI: "Hi! I've reviewed the job description for Senior Software Engineer.
     I'd like to ask a few questions to help me understand exactly what
     you're looking for. Ready to get started?"

Recruiter: "Yes, let's go."

AI: "Great! I extracted that you need 5+ years of experience and skills
     in Python, AWS, and Kubernetes. Is that accurate?"

Recruiter: "Yes, but Python is really the most important. AWS is nice
            to have but we use GCP more."

AI: "Got it - I'll prioritize Python and adjust cloud experience to be
     more flexible. Now, tell me about the team this person would be
     joining. What's the size and culture like?"

Recruiter: "It's a team of 8 engineers. We're pretty collaborative,
            do a lot of pair programming. The culture is fast-paced
            but we value work-life balance."

AI: "That's helpful. Who would they report to?"

Recruiter: "Our VP of Engineering, Sarah."

...continues through all topics...

AI: "Great! Let me summarize what I've learned:
     - Team of 8, collaborative culture, reporting to Sarah (VP Eng)
     - Must have Python expertise, cloud experience flexible
     - Looking for someone who can mentor juniors
     - Red flags: job hoppers with less than 1 year per role
     Does this sound right?"

Recruiter: "Perfect!"

AI: "Excellent. I've saved all this information. Your job is now
     ready for candidates. Thank you!"
```

## Next Phase

Once job enrichment is working, proceed to [Phase 4: Candidate Upload](./phase4-candidate-upload.md) to implement CSV upload linked to jobs.
