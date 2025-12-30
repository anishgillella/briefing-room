# Phase 5: Candidate Interview Flow

## Overview

This phase updates the existing candidate interview flow to use the full job context. The key change is that the voice agent (playing the candidate) now receives the complete job description, scoring criteria, and company context from the Job record.

## What Changes From Current Flow

| Aspect | Before | After |
|--------|--------|-------|
| Job Context | Only `job_title` from candidate | Full `Job` record with description, requirements, criteria |
| Agent Prompt | Generic based on title | Role-specific based on full JD |
| Room Metadata | Limited candidate info | Includes `job_id` for traceability |
| Interview Record | Not persisted | Saved to `Interview` table |
| Transcript | Saved to file | Saved to `Interview.transcript` |

## Updated Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CANDIDATE INTERVIEW FLOW (UPDATED)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Start Interview                                                     │
│  ───────────────────────                                                     │
│  • Recruiter clicks "Interview" on candidate                                 │
│  • System loads:                                                             │
│    - Candidate record (bio, skills, resume)                                  │
│    - Job record (description, requirements, scoring criteria)                │
│  • Creates Interview record (status: scheduled)                              │
│  • Creates LiveKit room with full metadata                                   │
│                                                                              │
│  STEP 2: Voice Agent Joins                                                   │
│  ─────────────────────────                                                   │
│  • Agent reads room metadata                                                 │
│  • Builds role-specific persona from:                                        │
│    - Candidate's bio_summary and skills                                      │
│    - Job's full description and requirements                                 │
│    - Job's company_context                                                   │
│  • Agent plays the candidate role                                            │
│                                                                              │
│  STEP 3: Interview Happens                                                   │
│  ─────────────────────────                                                   │
│  • Recruiter interviews the AI candidate                                     │
│  • Transcript captured in real-time                                          │
│  • Interview record updated (status: in_progress)                            │
│                                                                              │
│  STEP 4: End Interview                                                       │
│  ─────────────────────                                                       │
│  • Recruiter ends interview                                                  │
│  • Transcript saved to Interview record                                      │
│  • Interview status → completed                                              │
│  • Candidate status → completed                                              │
│  • Triggers analytics generation (Phase 6)                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Updated Interview Agent

The key change is enriching the agent's system prompt with job context.

```python
# backend/agents/candidate_interview_agent.py

from livekit.agents import Agent, JobContext, WorkerOptions, cli
from livekit.agents.llm import ChatContext, ChatMessage
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import openai, silero

import json
from typing import Optional
from models.streamlined.job import Job
from models.streamlined.candidate import Candidate


def build_candidate_persona_prompt(
    candidate: Candidate,
    job: Job,
) -> str:
    """
    Build a rich persona prompt for the AI candidate.

    Now includes full job context, not just job_title.
    """
    # Extract company context if available
    company_context = ""
    if job.company_context:
        cc = job.company_context
        company_context = f"""
COMPANY CONTEXT (what you know about the company):
- Company: {cc.company_name or 'Not specified'}
- Team Size: {cc.team_size or 'Not specified'}
- Culture: {cc.team_culture or 'Not specified'}
- Growth Stage: {cc.growth_stage or 'Not specified'}
"""

    # Extract requirements
    requirements = ""
    if job.extracted_requirements:
        req = job.extracted_requirements
        requirements = f"""
JOB REQUIREMENTS (what the role needs):
- Experience: {req.years_experience or 'Not specified'}
- Required Skills: {', '.join(req.required_skills) if req.required_skills else 'Not specified'}
- Preferred Skills: {', '.join(req.preferred_skills) if req.preferred_skills else 'Not specified'}
- Work Type: {req.work_type or 'Not specified'}
"""

    # Build the full prompt
    prompt = f"""You are {candidate.person_name or 'a candidate'}, a job candidate being interviewed for the position of {job.title}.

YOUR PROFESSIONAL BACKGROUND:
{candidate.bio_summary or 'You are an experienced professional with a strong background in your field.'}

YOUR KEY SKILLS:
{', '.join(candidate.skills[:10]) if candidate.skills else 'Various relevant skills for this role'}

CURRENT ROLE:
{f'{candidate.current_title} at {candidate.current_company}' if candidate.current_title else 'Currently exploring new opportunities'}

YEARS OF EXPERIENCE: {candidate.years_experience or 'Several years'}

{company_context}

{requirements}

JOB DESCRIPTION SUMMARY:
{job.raw_description[:1500] if job.raw_description else 'A challenging role in a growing company.'}

---

INTERVIEW GUIDELINES:

1. STAY IN CHARACTER
   - You ARE {candidate.person_name or 'this candidate'}
   - Speak in first person ("I have experience in...")
   - Draw from your background naturally

2. ANSWER AUTHENTICALLY
   - Give specific examples from your experience
   - Show enthusiasm for the role and company
   - Be honest about areas where you're still growing

3. DEMONSTRATE FIT
   - Connect your experience to the job requirements
   - Show you understand the company culture
   - Ask thoughtful questions about the role

4. BE CONVERSATIONAL
   - Listen carefully to questions
   - Give concise but complete answers
   - Don't monologue - leave room for follow-ups

5. SHOW PERSONALITY
   - Be professional but personable
   - Show genuine interest in the opportunity
   - Let your communication style shine through

Remember: You want this job, but you're also evaluating if it's right for you."""

    return prompt


class CandidateInterviewAgent:
    """
    Voice agent that plays the candidate role during interviews.

    Key improvement: Now uses full job context from Job record.
    """

    def __init__(self, candidate_id: str, job_id: str, interview_id: str):
        self.candidate_id = candidate_id
        self.job_id = job_id
        self.interview_id = interview_id
        self.candidate: Optional[Candidate] = None
        self.job: Optional[Job] = None
        self.transcript_lines = []

    async def load_context(self):
        """Load candidate and job data from database."""
        from repositories.streamlined.candidate_repo import CandidateRepository
        from repositories.streamlined.job_repo import JobRepository

        candidate_repo = CandidateRepository()
        job_repo = JobRepository()

        self.candidate = await candidate_repo.get_by_id(self.candidate_id)
        self.job = await job_repo.get_by_id(self.job_id)

    async def save_transcript(self):
        """Save transcript to interview record."""
        from repositories.streamlined.interview_repo import InterviewRepository
        from models.streamlined.interview import InterviewUpdate, InterviewSessionStatus

        repo = InterviewRepository()
        transcript = "\n".join(self.transcript_lines)

        await repo.update(self.interview_id, InterviewUpdate(
            transcript=transcript,
            status=InterviewSessionStatus.COMPLETED,
        ))

    async def run(self, ctx: JobContext):
        """Main agent loop."""
        await self.load_context()

        if not self.candidate or not self.job:
            print(f"Missing context: candidate={self.candidate}, job={self.job}")
            return

        # Build the persona prompt with full job context
        system_prompt = build_candidate_persona_prompt(self.candidate, self.job)

        # Create chat context
        chat_ctx = ChatContext()
        chat_ctx.append(ChatMessage(role="system", content=system_prompt))

        # Initialize voice assistant
        assistant = VoiceAssistant(
            vad=silero.VAD.load(),
            stt=openai.STT(),
            llm=openai.LLM(model="gpt-4o"),
            tts=openai.TTS(voice="nova"),  # Use a different voice than JD agent
            chat_ctx=chat_ctx,
        )

        # Capture transcript
        @assistant.on("user_speech_committed")
        def on_user_speech(text: str):
            self.transcript_lines.append(f"Interviewer: {text}")

        @assistant.on("agent_speech_committed")
        def on_agent_speech(text: str):
            self.transcript_lines.append(f"Candidate ({self.candidate.person_name}): {text}")

        # Start the assistant
        assistant.start(ctx.room)

        # Opening statement from candidate
        opening = f"""Hi, thank you for taking the time to meet with me today.
        I'm really excited about this {self.job.title} opportunity.
        I've been looking forward to learning more about the role and the team."""

        await assistant.say(opening)

        # Wait for interview to end (room will be closed by frontend)
        await ctx.room.disconnected.wait()

        # Save transcript when done
        await self.save_transcript()


async def entrypoint(ctx: JobContext):
    """Entry point for the candidate interview agent."""
    room_metadata = ctx.room.metadata
    if not room_metadata:
        print("No room metadata found")
        return

    metadata = json.loads(room_metadata)

    # Validate this is an interview room
    if metadata.get("mode") != "candidate_interview":
        return

    candidate_id = metadata.get("candidate_id")
    job_id = metadata.get("job_id")
    interview_id = metadata.get("interview_id")

    if not all([candidate_id, job_id, interview_id]):
        print(f"Missing required IDs: candidate={candidate_id}, job={job_id}, interview={interview_id}")
        return

    agent = CandidateInterviewAgent(candidate_id, job_id, interview_id)
    await agent.run(ctx)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

## Interview API Endpoints

```python
# backend/routers/interviews.py

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from uuid import UUID
from datetime import datetime

from livekit import api as livekit_api
import os
import json

from models.streamlined.interview import (
    Interview, InterviewCreate, InterviewUpdate,
    InterviewType, InterviewSessionStatus
)
from models.streamlined.candidate import CandidateUpdate, InterviewStatus
from repositories.streamlined.interview_repo import InterviewRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from repositories.streamlined.job_repo import JobRepository

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.post("/start/{candidate_id}")
async def start_interview(
    candidate_id: UUID,
    interview_type: InterviewType = InterviewType.AI_CANDIDATE,
    interview_repo: InterviewRepository = Depends(get_interview_repo),
    candidate_repo: CandidateRepository = Depends(get_candidate_repo),
    job_repo: JobRepository = Depends(get_job_repo),
):
    """
    Start an interview session for a candidate.

    1. Loads candidate and job data
    2. Creates Interview record
    3. Creates LiveKit room with full context in metadata
    4. Returns room credentials
    """
    # Load candidate
    candidate = await candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Load job
    job = await job_repo.get_by_id(candidate.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Create interview record
    interview = await interview_repo.create(InterviewCreate(
        candidate_id=candidate_id,
        interview_type=interview_type,
    ))

    # Update interview with start time
    await interview_repo.update(interview.id, InterviewUpdate(
        status=InterviewSessionStatus.IN_PROGRESS,
        started_at=datetime.utcnow(),
    ))

    # Update candidate status
    await candidate_repo.update(candidate_id, CandidateUpdate(
        interview_status=InterviewStatus.IN_PROGRESS,
    ))

    # Create LiveKit room with rich metadata
    room_name = f"interview-{interview.id}"

    room_metadata = json.dumps({
        "mode": "candidate_interview",
        "interview_id": str(interview.id),
        "candidate_id": str(candidate_id),
        "job_id": str(candidate.job_id),
        "candidate_name": candidate.person_name,
        "job_title": job.title,
    })

    livekit_client = livekit_api.LiveKitAPI(
        os.getenv("LIVEKIT_URL"),
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )

    await livekit_client.room.create_room(
        livekit_api.CreateRoomRequest(
            name=room_name,
            metadata=room_metadata,
        )
    )

    # Generate token for interviewer
    token = livekit_api.AccessToken(
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )
    token.with_identity(f"interviewer-{interview.id}")
    token.with_name("Interviewer")
    token.with_grants(livekit_api.VideoGrants(
        room_join=True,
        room=room_name,
    ))

    return {
        "interview_id": str(interview.id),
        "room_name": room_name,
        "token": token.to_jwt(),
        "livekit_url": os.getenv("LIVEKIT_WS_URL"),
        "candidate_name": candidate.person_name,
        "job_title": job.title,
    }


@router.post("/end/{interview_id}")
async def end_interview(
    interview_id: UUID,
    interview_repo: InterviewRepository = Depends(get_interview_repo),
    candidate_repo: CandidateRepository = Depends(get_candidate_repo),
):
    """
    End an interview session.

    1. Updates interview status to completed
    2. Updates candidate status to completed
    3. Cleans up LiveKit room
    4. Triggers analytics generation
    """
    interview = await interview_repo.get_by_id(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Update interview
    await interview_repo.update(interview_id, InterviewUpdate(
        status=InterviewSessionStatus.COMPLETED,
        ended_at=datetime.utcnow(),
    ))

    # Update candidate
    await candidate_repo.update(interview.candidate_id, CandidateUpdate(
        interview_status=InterviewStatus.COMPLETED,
    ))

    # Clean up LiveKit room
    room_name = f"interview-{interview_id}"
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
        pass

    # Trigger analytics generation (async)
    from services.analytics_generator import generate_analytics_async
    import asyncio
    asyncio.create_task(generate_analytics_async(interview_id))

    return {
        "interview_id": str(interview_id),
        "status": "completed",
        "message": "Interview ended. Analytics will be generated shortly."
    }


@router.get("/{interview_id}")
async def get_interview(
    interview_id: UUID,
    interview_repo: InterviewRepository = Depends(get_interview_repo),
):
    """Get interview details including transcript."""
    interview = await interview_repo.get_by_id(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@router.get("/candidate/{candidate_id}")
async def get_candidate_interviews(
    candidate_id: UUID,
    interview_repo: InterviewRepository = Depends(get_interview_repo),
):
    """Get all interviews for a candidate."""
    interviews = await interview_repo.list_by_candidate(candidate_id)
    return interviews
```

## Interview Repository

```python
# backend/repositories/streamlined/interview_repo.py

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from models.streamlined.interview import (
    Interview, InterviewCreate, InterviewUpdate,
    InterviewSessionStatus
)
from services.supabase_client import get_supabase_client


class InterviewRepository:
    def __init__(self):
        self.client = get_supabase_client()
        self.table = "interviews"

    async def create(self, data: InterviewCreate) -> Interview:
        """Create a new interview."""
        insert_data = {
            "candidate_id": str(data.candidate_id),
            "interview_type": data.interview_type.value,
            "status": InterviewSessionStatus.SCHEDULED.value,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = self.client.table(self.table).insert(insert_data).execute()
        return Interview(**result.data[0])

    async def get_by_id(self, interview_id: UUID) -> Optional[Interview]:
        """Get interview by ID with joined data."""
        result = self.client.table(self.table)\
            .select("*, candidates(person_id, job_id, persons(name), jobs(title))")\
            .eq("id", str(interview_id))\
            .execute()

        if not result.data:
            return None

        data = result.data[0]
        # Flatten joined data
        candidate_data = data.pop("candidates", {})
        data["candidate_name"] = candidate_data.get("persons", {}).get("name")
        data["job_id"] = candidate_data.get("job_id")
        data["job_title"] = candidate_data.get("jobs", {}).get("title")

        return Interview(**data)

    async def list_by_candidate(self, candidate_id: UUID) -> List[Interview]:
        """List all interviews for a candidate."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("candidate_id", str(candidate_id))\
            .order("created_at", desc=True)\
            .execute()

        return [Interview(**data) for data in result.data]

    async def update(
        self,
        interview_id: UUID,
        data: InterviewUpdate
    ) -> Optional[Interview]:
        """Update an interview."""
        update_data = data.model_dump(exclude_unset=True)

        if not update_data:
            return await self.get_by_id(interview_id)

        if "status" in update_data:
            update_data["status"] = update_data["status"].value

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(interview_id))\
            .execute()

        if not result.data:
            return None

        return Interview(**result.data[0])
```

## Frontend Interview Page

```tsx
// frontend/src/app/candidates/[id]/interview/page.tsx

"use client";

import { useState, useEffect } from "react";
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
import { Mic, MicOff, PhoneOff, Loader2, User } from "lucide-react";

interface InterviewCredentials {
  interview_id: string;
  room_name: string;
  token: string;
  livekit_url: string;
  candidate_name: string;
  job_title: string;
}

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const [credentials, setCredentials] = useState<InterviewCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startInterview();
  }, [params.id]);

  const startInterview = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/interviews/start/${params.id}`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Failed to start interview");
      }

      const data = await response.json();
      setCredentials(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const endInterview = async () => {
    if (!credentials) return;

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/interviews/end/${credentials.interview_id}`,
        { method: "POST" }
      );
      router.push(`/candidates/${params.id}/analytics`);
    } catch (err) {
      console.error("Failed to end interview:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Setting up interview room...</p>
        </div>
      </div>
    );
  }

  if (error || !credentials) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">{error || "Failed to load interview"}</p>
            <Button onClick={() => router.back()}>Go Back</Button>
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
      <InterviewRoom
        candidateName={credentials.candidate_name}
        jobTitle={credentials.job_title}
        onEnd={endInterview}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}


function InterviewRoom({
  candidateName,
  jobTitle,
  onEnd,
}: {
  candidateName: string;
  jobTitle: string;
  onEnd: () => void;
}) {
  const { state, audioTrack } = useVoiceAssistant();
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">{candidateName}</h1>
            <p className="text-gray-400">Interviewing for: {jobTitle}</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-lg px-4 py-2">
              {formatTime(duration)}
            </Badge>
            <Badge
              variant={state === "speaking" ? "default" : "secondary"}
              className="text-lg px-4 py-2"
            >
              {state === "speaking"
                ? "Candidate Speaking"
                : state === "listening"
                ? "Listening"
                : "Processing"}
            </Badge>
          </div>
        </div>

        {/* Main Interview Area */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Candidate Visual */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Candidate</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center mb-4">
                <User className="h-16 w-16 text-gray-400" />
              </div>
              <p className="text-xl font-medium">{candidateName}</p>

              {/* Audio Visualizer */}
              <div className="h-24 w-full mt-6">
                {audioTrack && (
                  <BarVisualizer
                    state={state}
                    trackRef={audioTrack}
                    barCount={7}
                    options={{ minHeight: 10 }}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Interview Tips */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Interview Guide</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300 space-y-4">
              <div>
                <h4 className="font-medium mb-2">Suggested Questions:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Tell me about your experience with [required skill]</li>
                  <li>Describe a challenging project you've worked on</li>
                  <li>How do you handle [job-specific scenario]?</li>
                  <li>What interests you about this role?</li>
                  <li>Where do you see yourself in 3-5 years?</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Tips:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Speak clearly and at a normal pace</li>
                  <li>Ask follow-up questions to dig deeper</li>
                  <li>Take notes on key points</li>
                  <li>Allow candidate to finish speaking</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4">
          <div className="container mx-auto flex justify-center gap-4">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="lg"
              onClick={() => setIsMuted(!isMuted)}
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

            <Button variant="destructive" size="lg" onClick={onEnd}>
              <PhoneOff className="mr-2 h-5 w-5" />
              End Interview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Implementation Steps

1. **Update agent files:**
   - `backend/agents/candidate_interview_agent.py` (updated with job context)

2. **Create interview router:**
   - `backend/routers/interviews.py`

3. **Create interview repository:**
   - `backend/repositories/streamlined/interview_repo.py`

4. **Register router:**
   ```python
   from routers.interviews import router as interviews_router
   app.include_router(interviews_router)
   ```

5. **Create frontend page:**
   - `frontend/src/app/candidates/[id]/interview/page.tsx`

6. **Run the agent worker:**
   ```bash
   python -m agents.candidate_interview_agent
   ```

## Key Improvements

1. **Full Job Context** - Agent knows the complete job requirements, not just title
2. **Company Context** - Agent can reference company culture and team dynamics
3. **Traceability** - Interview record links to candidate and job
4. **Transcript Persistence** - Transcript saved to database, not just file
5. **Analytics Trigger** - Automatically starts analytics generation on end

## Next Phase

Once interview flow is updated, proceed to [Phase 6: Analytics](./phase6-analytics.md) to implement job-specific scoring and evaluation.
