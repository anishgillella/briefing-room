# Documentation Index

## Overview
Technical documentation for the Briefing Room interview training platform.

## Core Documents

| File | Description |
|------|-------------|
| `architecture.md` | System architecture, data flow, tech stack |
| `ai-candidate-agent.md` | AI candidate feature design (updated for OpenAI Realtime) |
| `dual-agent-architecture.md` | Two-agent design: AI Interviewer + AI Candidate roles |
| `transcription.md` | Real-time transcription implementation |
| `interview-analytics.md` | Post-interview analytics with Gemini 2.5 Flash |

## Dual Agent Implementation

Enables users to join interviews as either Interviewer (current) or Candidate (new). The AI plays the opposite role.

| Phase | Document | Description |
|-------|----------|-------------|
| Overview | `dual-agent-implementation/README.md` | Architecture and quick start |
| Phase 1 | `dual-agent-implementation/phase1-interviewer-agent.md` | Create `interviewer_agent.py` |
| Phase 2 | `dual-agent-implementation/phase2-backend-integration.md` | API role parameter and agent dispatch |
| Phase 3 | `dual-agent-implementation/phase3-frontend-integration.md` | Role selection UI |

## Streamlined Interview Flow

The streamlined flow unifies job descriptions, candidates, interviews, and analytics into a cohesive system. Jobs are the central organizing entity, with all other data flowing through it.

| Phase | Document | Description |
|-------|----------|-------------|
| Overview | `streamlined-flow/README.md` | Architecture and flow diagram |
| Phase 1 | `streamlined-flow/phase1-data-models.md` | Person, Job, Candidate, Interview, Analytics models |
| Phase 2 | `streamlined-flow/phase2-job-management.md` | Job CRUD API and UI |
| Phase 3 | `streamlined-flow/phase3-jd-voice-agent.md` | Voice agent for JD extraction (talks to recruiter) |
| Phase 4 | `streamlined-flow/phase4-candidate-upload.md` | CSV upload linked to jobs |
| Phase 5 | `streamlined-flow/phase5-interview-flow.md` | Interview with full job context |
| Phase 6 | `streamlined-flow/phase6-analytics.md` | Job-specific scoring and evaluation |
| Phase 7 | `streamlined-flow/phase7-recruiter-dashboard.md` | Multi-job dashboard |

## Quick Links

- **Backend Guide**: `../backend/BACKEND_GUIDE.md`
- **Frontend Guide**: `../frontend/FRONTEND_GUIDE.md`
- **Components Guide**: `../frontend/src/components/COMPONENTS_GUIDE.md`

---

## Complete Challenges Log

### Challenge 1: Vapi + Daily.co Instance Conflict (CRITICAL)
**Symptom**: `"Duplicate DailyIframe instances are not allowed"` error when activating AI candidate
**Cause**: Vapi Web SDK internally uses Daily.co for audio transport. When the video room (also using Daily) was active, two Daily instances conflicted.
**Attempted Fixes**:
1. ❌ Added `allowMultipleCallInstances: true` to DailyProvider - Didn't work because Vapi's internal Daily instance doesn't have this flag
2. ❌ Tried stopping Daily before Vapi - Would break the video call requirement
**Resolution**: Switch from Vapi to OpenAI Realtime API for candidate agent (uses WebSocket, no Daily dependency)

---

### Challenge 2: React Hook Ordering Error
**Symptom**: `"Rendered more hooks than during the previous render"` crash
**Cause**: Early `return` statements before all hooks executed in `video-room.tsx`
**Location**: `frontend/src/components/video-room.tsx`
**Resolution**: 
- Move ALL hooks to the top of component
- Use conditional rendering in JSX instead of early returns
```tsx
// ❌ Wrong
if (isLoading) return <Loading />;
useEffect(...); // Hook after conditional return

// ✅ Correct
useEffect(...); // All hooks first
if (isLoading) return <Loading />; // Conditionals after
```

---

### Challenge 3: Vapi "Key doesn't allow assistantId" Error
**Symptom**: `"Key doesn't allow assistantId '1d5854df-...'"` when starting Vapi
**Cause**: Using inline/transient assistant config with a PUBLIC key that doesn't have permission
**Resolution**: 
1. Create saved assistants in Vapi Dashboard
2. Use assistant ID instead of inline config: `vapi.start("assistant-id")`

---

### Challenge 4: Vapi Dynamic Context Injection
**Symptom**: Saved assistants didn't receive candidate name, resume, or job description
**Cause**: Saved assistants have static prompts, can't receive dynamic data automatically
**Resolution**: 
1. Use `variableValues` parameter in `vapi.start()`:
```tsx
await vapi.start("assistant-id", {
  variableValues: {
    candidateName: "John Doe",
    resume: "...",
  }
});
```
2. Update Vapi dashboard prompt to use template syntax: `{{candidateName}}`

---

### Challenge 5: Props Not Passed to Child Components
**Symptom**: `'onEndInterview' is not defined` error in VideoRoom
**Cause**: TypeScript interface declared the prop, but it wasn't destructured from props object
**Location**: `frontend/src/components/video-room.tsx`
**Resolution**: 
```tsx
// ❌ Wrong - declared but not extracted
function Component({ roomUrl, token }: Props) // Missing onEndInterview

// ✅ Correct
function Component({ roomUrl, token, onEndInterview }: Props)
```

---

### Challenge 6: Duplicate State Declarations
**Symptom**: `"Cannot redeclare block-scoped variable 'fullTranscript'"`
**Cause**: Copy-paste error created duplicate `useState` for same variable
**Resolution**: Remove duplicate declaration, keep single source of truth

---

### Challenge 7: Daily.co Client-Side Only
**Symptom**: `window is not defined` error during SSR
**Cause**: Daily.co SDK requires browser APIs (window, navigator)
**Resolution**: Use Next.js dynamic import with `ssr: false`:
```tsx
const VideoRoom = dynamic(() => import("./video-room"), { ssr: false });
```

---

### Challenge 8: Transcript Capture for Debrief
**Symptom**: Debrief was generic without interview content
**Cause**: No mechanism to capture and pass conversation to debrief endpoint
**Resolution**:
1. Capture transcript via Daily `transcription-message` events
2. Capture AI responses via Vapi `message` events
3. Pass combined transcript to `/debrief` endpoint
4. Backend uses transcript in LLM prompt for analysis

---

### Challenge 9: CORS Blocking Frontend Requests
**Symptom**: `CORS policy: No 'Access-Control-Allow-Origin'` in browser console
**Cause**: Backend didn't allow requests from frontend origin
**Resolution**: Add CORS middleware in FastAPI:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### Challenge 10: Briefing Data Persistence
**Symptom**: Briefing data lost between pre-briefing and video room
**Cause**: No persistence layer, data stored only in component state
**Resolution**: 
1. POST briefing to `/api/rooms/{name}/briefing`
2. GET briefing when needed in other components
3. (Current: in-memory dict. Production: use database)

---

### Challenge 11: OpenAI Realtime API Quota/Billing Error
**Symptom**: Connection establishes successfully, but AI responses fail immediately with no audio
**Error**: `{"type": "insufficient_quota", "code": "insufficient_quota", "message": "You exceeded your current quota..."}`
**Cause**: OpenAI Realtime API requires sufficient account credits. It costs ~$0.06/min input + $0.24/min output
**Detection**: Added detailed logging for `response.done` events to see `status_details.error`
**Resolution**: Add credits to OpenAI account at platform.openai.com/settings/organization/billing
**Note**: The code is correct - this is purely a billing/quota issue, not a bug

---

### Challenge 12: Debrief Not Appearing After End Interview
**Symptom**: Clicking "End Interview" stayed on video room or went to home instead of debrief screen
**Root Cause**: There are TWO page flows in the app:
- `/app/page.tsx` (home page flow) - main entry point
- `/app/room/[name]/page.tsx` (room page flow)

The **home page flow** was missing:
- `onEndInterview` prop on VideoRoom
- `debrief` phase in the AppPhase type
- `DebriefScreen` dynamic import
- `handleEndInterview` handler

**Detection**: Added console logs tracing prop from RoomPage → VideoRoom wrapper → CallInterface. Found `onEndInterview` was `undefined` at all levels, indicating the home page was the active flow.
**Resolution**: Added full debrief support to `/app/page.tsx`:
```tsx
// Added debrief phase
type AppPhase = "join" | "briefing" | "interview" | "debrief";

// Added handler
const handleEndInterview = (transcript) => {
  setFinalTranscript(transcript);
  setPhase("debrief");
};

// Added DebriefScreen render
if (phase === "debrief") { return <DebriefScreen ... /> }

// Passed prop to VideoRoom
<VideoRoom onEndInterview={handleEndInterview} />
```
**Lesson**: When debugging prop issues, trace the ENTIRE component hierarchy using console logs at each level.

---

### Challenge 13: Briefing Overlay Feels Like Navigation
**Symptom**: Clicking "Briefing" button during interview felt like leaving the video call
**Cause**: Used `absolute inset-4` positioning which filled entire viewport, no visual connection to underlying video
**User Feedback**: "I want it to just be a pop-up, which I can scroll to go through... I should stay within the interview"
**Resolution**: 
1. Changed to `fixed inset-0` with `bg-black/80 backdrop-blur-sm` backdrop
2. Constrained modal to `max-w-6xl h-[90vh]` centered container
3. Added `rounded-2xl` and shadow for clear modal boundary
4. Result: User can see darkened video feed behind modal, maintaining interview context

---

### Challenge 14: Video Control Bar Pushed Off-Screen
**Symptom**: Camera/Mic/End buttons not visible, pushed below viewport on some screen sizes
**Cause**: Video grid was allowed to grow without constraints, squashing the control bar
**User Feedback**: "I don't see the buttons down there, make sure the buttons are in the frame"
**Resolution**:
1. Added `shrink-0` to control bar div to prevent flexbox shrinking
2. Changed video grid container from `flex-1` to `flex-1 min-h-0`
3. Added explicit height constraints and overflow handling
```tsx
// Control bar
<div className="shrink-0 p-4 border-t...">

// Video container  
<div className="flex-1 min-h-0 p-4...">
  <div className="h-full w-full grid...">
```
**Result**: Controls always visible at bottom, video grid properly constrained

---

### Challenge 15: Uneven Video Tile Sizing
**Symptom**: Interviewer and candidate video tiles had different sizes, felt visually unbalanced
**Cause**: `VideoTile` component had `col-span-2` for remote and `col-span-1` for local
**Resolution**: 
1. Removed `col-span` logic from `VideoTile` component
2. Wrapped each tile in a `div` with `min-h-[300px]` and `w-full h-full`
3. Used `grid-cols-1 md:grid-cols-2` for responsive equal sizing
```tsx
{localSessionId && (
  <div className="relative w-full h-full min-h-[300px]...">
    <VideoTile sessionId={localSessionId} ... />
  </div>
)}
```
**Result**: All video tiles equal size, interview power balance maintained

---

### Challenge 16: Briefing Data Re-fetch During Interview
**Symptom**: Clicking "Briefing" button during interview took several seconds to load
**Cause**: Component fetched briefing data from API every time modal opened (expensive Gemini API call)
**User Feedback**: "The briefing part takes a while to load, are you not caching it?"
**Resolution**: Implemented state lifting pattern
1. Added `preBrief` state to parent `page.tsx`
2. Modified `PreBriefingScreen` to pass fetched brief back via callback: `onStartInterview(brief)`
3. Added `initialBrief` prop to `VideoRoom` component
4. Initialize `fullBriefing` state with cached data: `useState(initialBrief || null)`
5. Only fetch if cache miss: `if (!initialBrief && data.notes && data.resume_summary)`
**Result**: Briefing overlay loads instantly, no API call during interview

---

### Challenge 17: Loading Screen User Engagement
**Symptom**: "Analyzing Candidate..." loading screen felt long and boring during AI generation
**Cause**: Static text with spinner, no engagement while waiting 10-15 seconds
**User Request**: "Change the loading screen text to something interesting facts about recruitment"
**Resolution**:
1. Created array of 7 recruitment statistics/facts
2. Added `currentFactIndex` state with rotating interval (every 3 seconds)
3. Displayed current fact below main loading message
```tsx
const facts = [
  "Did you know? Top talent stays on the market for only 10 days.",
  "Structured interviews are 2x more predictive of job performance...",
  // ...
];

useEffect(() => {
  if (preBriefLoading) {
    const interval = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % facts.length);
    }, 3000);
    return () => clearInterval(interval);
  }
}, [preBriefLoading, facts.length]);
```
**Result**: Loading screen now educational and engaging, perceived wait time reduced

---

## Lessons Learned

1. **Test SDK integrations early** - Hidden dependencies (like Vapi using Daily) are hard to discover
2. **Read SDK source code** - Documentation doesn't always reveal internal implementations
3. **Have fallback options** - Voice AI is complex, have backup providers ready
4. **Hook ordering matters** - React Strict Mode catches these in dev, pay attention
5. **Document as you go** - Challenges are easier to explain right after solving
6. **Check API quotas early** - Billing issues can block testing even when code is correct

---

## Environment Setup

See `.env.example` in project root for all required variables.

## Running Locally

```bash
# Terminal 1: Backend API
cd backend && source venv/bin/activate && uvicorn main:app --reload

# Terminal 2: AI Candidate Agent (for interviewer mode)
cd backend && source venv/bin/activate && python interview_agent.py dev

# Terminal 3: AI Interviewer Agent (for candidate mode)
cd backend && source venv/bin/activate && python interviewer_agent.py dev

# Terminal 4: Frontend
cd frontend && npm run dev
```

### Agent Roles

| Agent | Command | AI Role | Human Role |
|-------|---------|---------|------------|
| `interview_agent.py` | `python interview_agent.py dev` | Candidate | Interviewer |
| `interviewer_agent.py` | `python interviewer_agent.py dev` | Interviewer | Candidate |

Both agents should be running to support both interview modes. The frontend role selector determines which agent joins the room.

