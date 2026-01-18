# Phase 3: Frontend Integration

## Goal

Add role selection UI so users can choose to join as Interviewer or Candidate before entering an interview.

## Prerequisites

- Phase 1 complete (`interviewer_agent.py` working)
- Phase 2 complete (backend accepts `role` parameter)

## Files to Create/Modify

```
frontend/src/
├── components/
│   └── role-selector.tsx          # NEW: Role selection component
├── app/
│   └── interviews/
│       └── [id]/
│           └── page.tsx           # MODIFY: Add role selection step
└── lib/
    └── api.ts                     # MODIFY: Update start interview call
```

## Implementation

### Step 1: Create Role Selector Component

Create `frontend/src/components/role-selector.tsx`:

```tsx
"use client";

import { Mic, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type InterviewRole = "interviewer" | "candidate";

interface RoleSelectorProps {
  candidateName: string;
  jobTitle: string;
  onSelectRole: (role: InterviewRole) => void;
  isLoading?: boolean;
}

export function RoleSelector({
  candidateName,
  jobTitle,
  onSelectRole,
  isLoading = false,
}: RoleSelectorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
      <h2 className="text-2xl font-bold mb-2">Join Interview Session</h2>
      <p className="text-muted-foreground mb-8 text-center">
        Interview for <span className="font-medium">{jobTitle}</span>
        {candidateName && (
          <>
            {" "}
            with <span className="font-medium">{candidateName}</span>
          </>
        )}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
        {/* Interviewer Role */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => !isLoading && onSelectRole("interviewer")}
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mic className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Join as Interviewer</CardTitle>
            <CardDescription>You conduct the interview</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>You ask questions</li>
              <li>AI plays the candidate</li>
              <li>Get real-time coaching suggestions</li>
            </ul>
            <Button
              className="mt-4 w-full"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                onSelectRole("interviewer");
              }}
            >
              {isLoading ? "Starting..." : "Start as Interviewer"}
            </Button>
          </CardContent>
        </Card>

        {/* Candidate Role */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => !isLoading && onSelectRole("candidate")}
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-secondary-foreground" />
            </div>
            <CardTitle>Join as Candidate</CardTitle>
            <CardDescription>Experience being interviewed</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>AI asks you questions</li>
              <li>You answer as the candidate</li>
              <li>Experience the candidate perspective</li>
            </ul>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                onSelectRole("candidate");
              }}
            >
              {isLoading ? "Starting..." : "Start as Candidate"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground mt-8 text-center max-w-md">
        Both modes generate the same analytics after the interview ends.
        Choose based on which experience you want to test.
      </p>
    </div>
  );
}
```

### Step 2: Update API Client

Update `frontend/src/lib/api.ts` to include role:

```typescript
export type InterviewRole = "interviewer" | "candidate";

export interface StartInterviewRequest {
  candidate_id: string;
  job_id?: string;
  stage?: string;
  role: InterviewRole;
}

export interface StartInterviewResponse {
  interview_id: string;
  room_name: string;
  room_url: string;
  token: string;
  role: InterviewRole;
  agent_type: string;
}

export async function startInterview(
  request: StartInterviewRequest
): Promise<StartInterviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/interviews/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Failed to start interview");
  }

  return response.json();
}
```

### Step 3: Update Interview Page Flow

Modify the interview page to include role selection step.

Example update to interview start flow:

```tsx
"use client";

import { useState } from "react";
import { RoleSelector, InterviewRole } from "@/components/role-selector";
import { VideoRoom } from "@/components/video-room";
import { startInterview } from "@/lib/api";

type InterviewPhase = "role-select" | "connecting" | "interview" | "debrief";

export default function InterviewPage({ params }: { params: { id: string } }) {
  const [phase, setPhase] = useState<InterviewPhase>("role-select");
  const [selectedRole, setSelectedRole] = useState<InterviewRole | null>(null);
  const [roomData, setRoomData] = useState<{
    roomUrl: string;
    token: string;
    interviewId: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch candidate/job data...
  const candidateName = "John Doe"; // From your data fetching
  const jobTitle = "Senior Software Engineer"; // From your data fetching
  const candidateId = params.id;
  const jobId = "job-uuid"; // From your data fetching

  const handleSelectRole = async (role: InterviewRole) => {
    setIsLoading(true);
    setSelectedRole(role);

    try {
      const response = await startInterview({
        candidate_id: candidateId,
        job_id: jobId,
        role: role,
      });

      setRoomData({
        roomUrl: response.room_url,
        token: response.token,
        interviewId: response.interview_id,
      });

      setPhase("interview");
    } catch (error) {
      console.error("Failed to start interview:", error);
      setPhase("role-select");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndInterview = (transcript: any[]) => {
    setPhase("debrief");
    // Handle debrief...
  };

  // Render based on phase
  if (phase === "role-select") {
    return (
      <RoleSelector
        candidateName={candidateName}
        jobTitle={jobTitle}
        onSelectRole={handleSelectRole}
        isLoading={isLoading}
      />
    );
  }

  if (phase === "interview" && roomData) {
    return (
      <VideoRoom
        roomUrl={roomData.roomUrl}
        token={roomData.token}
        userRole={selectedRole!}
        onEndInterview={handleEndInterview}
      />
    );
  }

  if (phase === "debrief") {
    return <DebriefScreen interviewId={roomData?.interviewId} />;
  }

  return <div>Loading...</div>;
}
```

### Step 4: Update VideoRoom for Role Context

Pass role to VideoRoom so it can adapt UI if needed:

```tsx
interface VideoRoomProps {
  roomUrl: string;
  token: string;
  userRole: InterviewRole;
  onEndInterview: (transcript: any[]) => void;
}

export function VideoRoom({
  roomUrl,
  token,
  userRole,
  onEndInterview,
}: VideoRoomProps) {
  // Role-specific UI adaptations
  const roleLabel = userRole === "interviewer" ? "Interviewer" : "Candidate";

  return (
    <div className="...">
      {/* Show role indicator */}
      <div className="absolute top-4 left-4 bg-background/80 px-3 py-1 rounded-full text-sm">
        You are: <span className="font-medium">{roleLabel}</span>
      </div>

      {/* Video tiles, controls, etc. */}
      {/* ... */}

      {/* AI Suggestions panel - maybe hide in candidate mode? */}
      {userRole === "interviewer" && <AISuggestionsPanel />}
    </div>
  );
}
```

### Step 5: Optional - Role-Specific Debrief

Adapt debrief screen based on role:

```tsx
export function DebriefScreen({
  interviewId,
  userRole,
}: {
  interviewId: string;
  userRole: InterviewRole;
}) {
  // Fetch analytics...

  return (
    <div>
      {userRole === "interviewer" ? (
        <>
          <h2>Candidate Evaluation</h2>
          {/* Show candidate scores, recommendations */}
        </>
      ) : (
        <>
          <h2>Your Interview Performance</h2>
          {/* Show feedback, coaching tips */}
        </>
      )}
    </div>
  );
}
```

## UI States

### Role Selection Screen

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                  Join Interview Session                      │
│     Interview for Senior Engineer with John Doe              │
│                                                              │
│   ┌─────────────────────┐   ┌─────────────────────┐         │
│   │         🎤          │   │         👤          │         │
│   │                     │   │                     │         │
│   │  Join as Interviewer│   │  Join as Candidate  │         │
│   │  You conduct the    │   │  Experience being   │         │
│   │  interview          │   │  interviewed        │         │
│   │                     │   │                     │         │
│   │  • You ask questions│   │  • AI asks you      │         │
│   │  • AI is candidate  │   │  • You answer       │         │
│   │  • Get suggestions  │   │  • Test UX          │         │
│   │                     │   │                     │         │
│   │  [Start as Inter.]  │   │  [Start as Cand.]   │         │
│   └─────────────────────┘   └─────────────────────┘         │
│                                                              │
│     Both modes generate analytics after the interview.       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Interview Room (Role Indicated)

```
┌─────────────────────────────────────────────────────────────┐
│  You are: Interviewer                        [Briefing] [End]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌───────────────────┐     ┌───────────────────┐           │
│   │                   │     │                   │           │
│   │    Your Video     │     │   AI Candidate    │           │
│   │                   │     │                   │           │
│   └───────────────────┘     └───────────────────┘           │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│           [🎤 Mic]    [📹 Cam]    [🔴 End Interview]         │
└─────────────────────────────────────────────────────────────┘
```

## Verification Checklist

- [ ] Role selector component renders correctly
- [ ] Clicking role starts interview with correct `role` parameter
- [ ] Loading state shows while connecting
- [ ] VideoRoom receives and displays role context
- [ ] Correct agent joins (AI candidate or AI interviewer)
- [ ] Interview flows naturally for both roles
- [ ] Debrief works for both roles
- [ ] Back navigation handles role state correctly

## Testing Scenarios

1. **Interviewer Flow (Regression)**
   - Select "Join as Interviewer"
   - Verify AI candidate joins and introduces itself
   - Ask questions, get suggestions
   - End interview, see debrief

2. **Candidate Flow (New)**
   - Select "Join as Candidate"
   - Verify AI interviewer joins and asks first question
   - Answer questions
   - End interview, see debrief

3. **Edge Cases**
   - Refresh during role selection
   - Network failure during start
   - Browser back button behavior

## Complete

Once frontend integration is done, the dual-agent system is fully functional. Test both flows end-to-end and gather feedback on the candidate experience UX.
