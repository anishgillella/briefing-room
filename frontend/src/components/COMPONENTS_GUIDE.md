# UI Components Guide

## Overview
React components for the Briefing Room interview training platform. Mix of custom components and shadcn/ui primitives.

## Structure

```
components/
├── video-room.tsx          # Daily.co video room wrapper
├── pre-briefing-screen.tsx # Vapi briefing voice agent
├── debrief-screen.tsx      # Post-interview AI analysis
├── ai-chat-sidebar.tsx     # Text-based AI assistant
├── vapi-agent.tsx          # Generic Vapi hook (briefing)
├── vapi-candidate-agent.tsx # AI candidate (DEPRECATED - Vapi conflicts with Daily)
├── openai-realtime-agent.tsx # AI candidate (TO BE IMPLEMENTED)
└── ui/                     # shadcn/ui components
    ├── button.tsx
    ├── card.tsx
    ├── input.tsx
    ├── textarea.tsx
    └── ...
```

## Key Components

### `video-room.tsx`
**Purpose**: Wraps Daily.co video functionality

**Key Features**:
- `DailyProvider` with custom callObject (allowMultipleCallInstances)
- Local/remote video tiles
- AI candidate integration point
- Transcript capture via Daily events

**State Managed**:
- `showAICandidate` - Toggle AI candidate
- `fullTranscript` - Captured conversation
- `candidateName` - From briefing data

### `pre-briefing-screen.tsx`
**Purpose**: Pre-interview voice briefing with AI

**Flow**:
1. Fetches briefing context from backend
2. Initializes Vapi with saved assistant ID
3. Voice conversation to prepare interviewer
4. "Start Interview" button transitions to video room

**Key Pattern**: Uses `variableValues` to inject dynamic context into saved assistant.

### `debrief-screen.tsx`
**Purpose**: Displays AI-generated post-interview analysis

**Features**:
- Calls `/api/rooms/{name}/debrief` with transcript
- Parses and displays: Summary, Strengths, Improvements, Decision
- Markdown rendering support

### `ai-chat-sidebar.tsx`
**Purpose**: Optional text chat during interview

**Pattern**: Streaming responses via async iteration.

---

## Component Patterns

### Voice Agent Pattern (Vapi)
```tsx
const vapi = useVapi(VAPI_PUBLIC_KEY);

useEffect(() => {
  if (isActive && briefingData) {
    vapi.start("assistant-id", {
      variableValues: { context: "..." }
    });
  }
  return () => vapi.stop();
}, [isActive, briefingData]);
```

### Video Integration Pattern (Daily)
```tsx
// Must be inside DailyProvider
const daily = useDaily();
const localSessionId = useLocalSessionId();
const participants = useParticipantIds();

useDailyEvent("transcription-message", (event) => {
  // Handle transcript
});
```

---

## Challenges Faced

### 1. Vapi + Daily Conflict (CRITICAL)
**Problem**: Both use Daily.co internally → "Duplicate DailyIframe" error
**Attempted Solutions**:
- `allowMultipleCallInstances: true` - Didn't work (Vapi's instance doesn't have this)
**Final Solution**: Replace Vapi with OpenAI Realtime API for candidate agent

### 2. Hook Ordering
**Problem**: Conditional hooks cause React errors
**Solution**: Always call hooks unconditionally at component top

### 3. Saved Assistant Context
**Problem**: Saved Vapi assistants can't receive dynamic prompts
**Solution**: Use `variableValues` and template syntax in dashboard prompts

---

## Deprecated Components

### `vapi-candidate-agent.tsx`
**Status**: ❌ DEPRECATED
**Reason**: Vapi uses Daily internally, conflicts with video room
**Replacement**: `openai-realtime-agent.tsx` (WebSocket, no Daily)

---

## Future Components

### `openai-realtime-agent.tsx`
**Purpose**: AI candidate using OpenAI Realtime API
**Transport**: WebSocket to OpenAI (no Daily.co dependency)
**Status**: To be implemented
