# Frontend Application Guide

## Overview
Next.js 16 application providing the interview training platform UI with Daily.co video integration and AI-powered features.

## Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Home page (room setup form)
│   │   └── room/[name]/       # Dynamic room page
│   │       └── page.tsx       # Room orchestration
│   ├── components/            # React components
│   │   ├── video-room.tsx     # Daily video room wrapper
│   │   ├── pre-briefing-screen.tsx  # Vapi briefing agent
│   │   ├── debrief-screen.tsx # Post-interview analysis
│   │   ├── ai-chat-sidebar.tsx # Text-based AI assistant
│   │   ├── vapi-agent.tsx     # Vapi voice agent (briefing)
│   │   ├── vapi-candidate-agent.tsx # AI candidate (deprecated)
│   │   └── ui/                # shadcn/ui components
│   └── lib/
│       ├── api.ts             # Backend API client
│       └── utils.ts           # Utilities
├── .env.local                 # Environment variables
└── package.json
```

## Key Files

### `app/page.tsx` (Home)
- Room setup form (resume, job description, name)
- Creates room via API
- Redirects to `/room/[name]`

### `app/room/[name]/page.tsx` (Room Orchestrator)
The main state machine controlling interview flow:
```
PreBriefing → VideoRoom → Debrief
```

### `components/video-room.tsx`
Daily.co video integration:
- `DailyProvider` with `allowMultipleCallInstances`
- Local/remote participant video tiles
- AI candidate trigger button
- Transcript capture

### `components/pre-briefing-screen.tsx`
Vapi voice agent for pre-interview briefing:
- Fetches briefing context from backend
- Uses Vapi Web SDK with saved assistant ID
- Auto-transitions when user clicks "Start"

### `lib/api.ts`
Backend API client with TypeScript interfaces:
- `createRoom()`, `joinRoom()`, `checkRoom()`
- `saveBriefing()`, `getBriefing()`
- `chatWithAI()`, `generateDebrief()`

---

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your-vapi-public-key
```

---

## Challenges Faced

### 1. React Hook Order Error
**Problem**: "Rendered more hooks than during the previous render"
**Cause**: Early return before all hooks executed
**Solution**: Move all hooks to top of component, use conditional rendering instead of early returns.

### 2. Duplicate Daily Instance Conflict
**Problem**: "Duplicate DailyIframe instances are not allowed"
**Cause**: Vapi internally uses Daily.co, conflicting with video room's Daily instance.
**Attempted Fix**: Added `allowMultipleCallInstances: true` to DailyProvider
**Final Solution**: Replacing Vapi with OpenAI Realtime API (no Daily dependency)

### 3. Vapi Assistant Permission Error
**Problem**: "Key doesn't allow assistantId"
**Cause**: Using inline assistant config with public key
**Solution**: Create saved assistants in Vapi dashboard, use assistant IDs

### 4. Vapi Context Injection
**Problem**: Saved assistants don't receive dynamic context automatically
**Solution**: Use `variableValues` in `vapi.start()` to pass runtime context

### 5. Transcript Capture
**Problem**: Needed full transcript for debrief quality
**Solution**: Capture via Daily transcription events + Vapi message events

### 6. Dynamic Imports for Client Components
**Problem**: Daily.co SDK only works in browser
**Solution**: Use Next.js `dynamic()` with `ssr: false`

---

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## Component Patterns

### State Management
- React `useState` for local state
- Props drilling for shared state
- No global state library (simple app)

### Video Integration
```tsx
<DailyProvider callObject={callObject}>
  <ComponentsUsingDailyHooks />
</DailyProvider>
```

### Voice Agents
- Vapi: `useVapi()` hook for briefing
- OpenAI Realtime: WebSocket hook (to be implemented)

---

## Future Improvements
- [ ] Implement OpenAI Realtime candidate agent
- [ ] Add loading skeletons
- [ ] Improve mobile responsiveness
- [ ] Add error boundaries
