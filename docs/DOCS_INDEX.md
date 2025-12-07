# Documentation Index

## Overview
Technical documentation for the Briefing Room interview training platform.

## Documents

| File | Description |
|------|-------------|
| `architecture.md` | System architecture, data flow, tech stack |
| `ai-candidate-agent.md` | AI candidate feature design (updated for OpenAI Realtime) |
| `transcription.md` | Real-time transcription implementation |

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
# Terminal 1: Backend
cd backend && source venv/bin/activate && uvicorn main:app --reload

# Terminal 2: Frontend  
cd frontend && npm run dev
```

