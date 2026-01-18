# Dual Agent Architecture - Interviewer & Candidate Agents

## Overview

This document outlines the architecture for supporting **two AI agents** that enable users to experience both sides of an interview:

| Agent | AI Role | Human Role | Use Case |
|-------|---------|------------|----------|
| `interview_agent.py` | Candidate | Interviewer | Recruiter evaluates AI candidate (CURRENT) |
| `interviewer_agent.py` | Interviewer | Candidate | User experiences being interviewed (PROPOSED) |

**Primary Purpose**: Internal testing and UX validation - to understand how the product feels from both perspectives before shipping.

## Why Two Agents (Not a View Toggle)

A simple "view toggle" would only change UI labels while keeping the same conversation flow. This doesn't help understand the candidate experience because:

| Approach | Conversation Flow | UX Insight |
|----------|-------------------|------------|
| View Toggle | Human asks → AI answers | None - same interaction |
| Dual Agents | Agent-specific flow | Full experience of each role |

**Candidate Agent** (existing): Human asks questions → AI answers as candidate
**Interviewer Agent** (proposed): AI asks questions → Human answers as candidate

These are fundamentally different interaction patterns that require separate agents.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MANILA INTERVIEW SYSTEM                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────┐              ┌──────────────────┐            │
│   │  RECRUITER MODE  │              │  CANDIDATE MODE  │            │
│   │  (Current Flow)  │              │  (New Flow)      │            │
│   └────────┬─────────┘              └────────┬─────────┘            │
│            │                                  │                      │
│            ▼                                  ▼                      │
│   ┌──────────────────┐              ┌──────────────────┐            │
│   │ interview_agent  │              │ interviewer_agent│            │
│   │ (AI = Candidate) │              │ (AI = Interviewer│            │
│   └────────┬─────────┘              └────────┬─────────┘            │
│            │                                  │                      │
│            ▼                                  ▼                      │
│   ┌──────────────────────────────────────────────────────┐          │
│   │                   LiveKit Room                        │          │
│   │  - Real-time audio/video                              │          │
│   │  - Transcript capture                                 │          │
│   │  - Data channel for AI suggestions                    │          │
│   └──────────────────────────────────────────────────────┘          │
│            │                                  │                      │
│            ▼                                  ▼                      │
│   ┌──────────────────────────────────────────────────────┐          │
│   │                 Same Analytics Pipeline               │          │
│   │  - Post-interview analysis (Gemini 2.5 Flash)        │          │
│   │  - Transcript storage                                 │          │
│   │  - Scoring & recommendations                          │          │
│   └──────────────────────────────────────────────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## User Flow

### Role Selection (At Interview Start)

```
┌─────────────────────────────────────────┐
│        Join Interview Session           │
│                                         │
│  How would you like to join?            │
│                                         │
│  ┌─────────────┐    ┌─────────────┐     │
│  │ 🎤 As       │    │ 👤 As       │     │
│  │ Interviewer │    │ Candidate   │     │
│  │             │    │             │     │
│  │ You ask     │    │ AI asks     │     │
│  │ questions   │    │ you         │     │
│  └─────────────┘    └─────────────┘     │
│                                         │
└─────────────────────────────────────────┘
```

### Flow A: Join as Interviewer (Current)

1. User clicks "As Interviewer"
2. Backend spawns `interview_agent.py` (AI plays candidate)
3. User joins LiveKit room
4. AI introduces itself as the candidate
5. User conducts interview, AI answers questions
6. AI Copilot provides real-time suggestions to interviewer
7. Interview ends → Analytics generated

### Flow B: Join as Candidate (Proposed)

1. User clicks "As Candidate"
2. Backend spawns `interviewer_agent.py` (AI plays interviewer)
3. User joins LiveKit room
4. AI greets user and begins interview
5. AI asks questions based on JD/role, user answers
6. AI provides real-time feedback/coaching (optional)
7. Interview ends → Analytics generated (from candidate perspective)

## Agent Specifications

### Existing: `interview_agent.py` (AI as Candidate)

```python
# Current implementation - AI plays the candidate

PERSONA:
- Name: From candidate metadata
- Background: From resume context
- Style: Natural speech, slight nervousness, enthusiastic

BEHAVIOR:
- Waits for interviewer questions
- Answers using STAR method when appropriate
- Uses speech fillers ("um", "well", "you know")
- Keeps answers 30-60 seconds
- Never asks interviewer questions

TOOLS:
- send_ai_suggestion(): Copilot hints for interviewer
- record_transcript(): Backup transcript capture
```

### Proposed: `interviewer_agent.py` (AI as Interviewer)

```python
# New implementation - AI plays the interviewer

PERSONA:
- Role: Professional recruiter/hiring manager
- Style: Warm but evaluative, structured approach

BEHAVIOR:
- Greets candidate warmly
- Asks questions based on JD requirements
- Uses STAR prompts for behavioral questions
- Probes for depth on technical answers
- Manages interview pacing (5-7 questions)
- Closes interview professionally

QUESTION FLOW:
1. Opening: "Tell me about yourself"
2. Experience: Role-specific questions from JD
3. Behavioral: 2-3 STAR-format questions
4. Technical: Domain-specific probing
5. Closing: "Do you have questions for me?"

TOOLS:
- evaluate_answer(): Score response quality
- send_feedback(): Optional real-time coaching
- record_transcript(): Backup transcript capture
```

## Backend Changes

### API Endpoint Modification

```python
# Option A: New parameter
POST /api/interviews/start
{
    "candidate_id": "uuid",
    "job_id": "uuid",
    "role": "interviewer" | "candidate"  # NEW
}

# Option B: Separate endpoints
POST /api/interviews/start-as-interviewer  # Spawns candidate agent
POST /api/interviews/start-as-candidate    # Spawns interviewer agent
```

### Agent Dispatch Logic

```python
# In interview start handler
if role == "interviewer":
    # User is interviewer, spawn AI candidate
    agent_type = "interview_agent"
elif role == "candidate":
    # User is candidate, spawn AI interviewer
    agent_type = "interviewer_agent"

# Spawn appropriate agent
await spawn_livekit_agent(agent_type, room_name, metadata)
```

### Token Metadata

```python
# Include role in LiveKit token for context
token_metadata = {
    "user_role": role,  # "interviewer" or "candidate"
    "job_title": job.title,
    "job_description": job.description,
    "candidate_name": candidate.name,  # For candidate agent
    "resume_context": candidate.resume_text,
}
```

## Frontend Changes

### Role Selection Component

```tsx
// components/role-selector.tsx

interface RoleSelectorProps {
    onSelect: (role: "interviewer" | "candidate") => void;
}

export function RoleSelector({ onSelect }: RoleSelectorProps) {
    return (
        <div className="flex gap-4">
            <button
                onClick={() => onSelect("interviewer")}
                className="..."
            >
                <MicIcon />
                <span>Join as Interviewer</span>
                <span className="text-sm">You ask questions</span>
            </button>

            <button
                onClick={() => onSelect("candidate")}
                className="..."
            >
                <UserIcon />
                <span>Join as Candidate</span>
                <span className="text-sm">AI interviews you</span>
            </button>
        </div>
    );
}
```

### Interview Start Flow

```tsx
// Modified interview start handler
async function handleStartInterview(role: "interviewer" | "candidate") {
    const response = await fetch("/api/interviews/start", {
        method: "POST",
        body: JSON.stringify({
            candidate_id: selectedCandidate.id,
            job_id: selectedJob.id,
            role: role,  // Pass selected role
        }),
    });

    const { room_url, token } = await response.json();

    // Join room - UI adapts based on role
    setUserRole(role);
    joinRoom(room_url, token);
}
```

## Analytics Considerations

Both flows generate the same data structure:

```json
{
    "interview_id": "uuid",
    "transcript": [...],
    "role": "interviewer" | "candidate",
    "analytics": {
        "overall_score": 85,
        "category_scores": {...},
        "highlights": {...},
        "recommendations": [...]
    }
}
```

**Difference in analytics interpretation**:
- **Interviewer mode**: Analytics evaluate the AI candidate's performance
- **Candidate mode**: Analytics could evaluate the human's responses (training value)

## Implementation Phases

### Phase 1: Interviewer Agent Core
- [ ] Create `interviewer_agent.py` with base persona
- [ ] Implement question flow logic
- [ ] Add JD-aware question generation
- [ ] Test in isolation

### Phase 2: Backend Integration
- [ ] Add `role` parameter to interview start endpoint
- [ ] Implement agent dispatch logic
- [ ] Update token metadata generation
- [ ] Add role to interview records

### Phase 3: Frontend Integration
- [ ] Create RoleSelector component
- [ ] Update interview start flow
- [ ] Adapt UI based on user role
- [ ] Update interview room for candidate perspective

### Phase 4: Analytics Adaptation
- [ ] Ensure analytics work for both flows
- [ ] Consider role-specific insights
- [ ] Test end-to-end both directions

## Use Cases

| User | Joins As | Experience | Value |
|------|----------|------------|-------|
| Product Team | Candidate | Get interviewed by AI | UX validation |
| Recruiter | Interviewer | Interview AI candidate | Current flow |
| Candidate (future) | Candidate | Practice interviews | Training tool |
| Hiring Manager | Both | Understand both sides | Empathy building |

## Open Questions

1. **Should candidate mode include coaching?** Real-time feedback could help users improve their interview skills.

2. **Same analytics UI?** The debrief screen may need role-aware presentation.

3. **Recording/playback?** Should interviews be reviewable from the other perspective?

4. **Difficulty levels?** Should the AI interviewer have "easy/medium/hard" modes?

## Related Documentation

- [AI Candidate Agent](./ai-candidate-agent.md) - Current candidate agent architecture
- [Interview Analytics](./interview-analytics.md) - Post-interview analysis system
- [Architecture Overview](./architecture.md) - System architecture
