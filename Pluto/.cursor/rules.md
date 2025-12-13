# Pluto - Cursor Rules & Best Practices

## 🎯 Project Overview
**Pluto** is an AI-powered talent matching system for Founding Account Executives (AEs). It combines:
- **Dual-layer scoring**: Algorithmic + AI evaluation
- **Voice agent**: Interactive resume gap-filling via LiveKit
- **Modern stack**: Next.js frontend + FastAPI backend + LLM integrations

---

## 📁 Project Structure

```
pluto/
├── backend/
│   ├── models.py          # Pydantic schemas for LLM interactions
│   ├── config.py          # Environment & API configuration
│   ├── server.py          # FastAPI routes (extraction, scoring, comparison)
│   ├── extract_data.py    # Resume extraction pipeline
│   ├── score_candidates.py # Dual-layer scoring engine
│   ├── resume_processor.py # PDF/text parsing
│   ├── livekit_agent.py   # Voice agent entry point
│   ├── livekit_session.py # Voice session management
│   ├── voice_models.py    # Voice-specific schemas
│   ├── data/              # CSV inputs & JSON outputs
│   └── requirements.txt
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx       # Main landing + analysis dashboard
│   │   └── voice/page.tsx # Voice onboarding interface
│   ├── package.json
│   └── tsconfig.json
└── readme.md
```

---

## 🔧 Backend Development Rules

### Models & Schemas (`backend/models.py`)
- **Always use Pydantic BaseModel** for all data structures
- Include detailed `Field(description=...)` for every field—these become LLM prompts
- Group related models with section headers (e.g., `# Phase 1: Extraction Models`)
- Keep schema definitions DRY—reuse models across pipelines

**Example:**
```python
class CandidateExtraction(BaseModel):
    bio_summary: str = Field(
        description="2-sentence first-person sales-focused summary"
    )
    sold_to_finance: bool = Field(
        description="True if candidate mentions CFOs, Controllers, VP Finance"
    )
```

### API Routes (`backend/server.py`)
- Prefix routes clearly: `/api/upload`, `/api/status`, `/api/results/csv`
- Return status updates with real-time progress: `{"status": "processing", "progress": 45}`
- Use FastAPI's `BackgroundTasks` for long-running operations
- Always validate file types early (CSV only for uploads)

### Configuration (`backend/config.py`)
- Load all API keys via `os.getenv()` from `.env`
- Never hardcode credentials or API endpoints
- Define constants (batch size, retry limits) at top level
- Export a `validate_config()` function to check required vars at startup

### Voice Agent (`backend/livekit_agent.py`)
- Use **function_tool decorator** for any LLM callable actions
- Log extensively (especially context injection and data broadcasts)
- Store session state in global `current_session` for multi-turn conversations
- Always publish data updates via `room.local_participant.publish_data()`

---

## 🎨 Frontend Development Rules

### Component Structure (`frontend/src/app/page.tsx`)
- Use **React hooks** (`useState`, `useEffect`, `useCallback`)
- Define all TypeScript interfaces at file top
- Separate UI into logical sections with comments (Landing, Upload, Processing, Results)
- Use constants for API URLs and tips arrays

### State Management
- Use `useState` for local component state
- Poll backend via `/api/status` during processing (1s interval)
- Update UI reactively as results stream in
- Clear intervals on component unmount

### Styling
- Use **Tailwind CSS** exclusively (no inline styles except dynamic values)
- Apply glassmorphism effects: `glass-card` class
- Consistent color scheme:
  - **Primary**: `from-purple-500/10 to-pink-500/10` (both cards)
  - **Accents**: `text-indigo-400`, `text-purple-400`
  - **Success**: `text-green-400`
  - **Alert**: `text-red-400`, `text-yellow-400`
- Use CSS variables for dynamic scores: `style={{ "--score": `${score}%` }}`

### User Experience
- Show progress feedback during long operations (tips, animations)
- Implement compare mode with multi-select checkboxes
- Lazy-load interview questions on demand
- Provide CSV export and reset functionality

---

## 🤖 AI/LLM Integration

### Prompts & Extraction
- **System prompt pattern**: Include candidate context, explicit instructions, field mappings
- **Extraction model**: Use `google/gemini-2.5-flash` (fast, cheap)
- **Scoring model**: Use same Gemini or `openai/gpt-5-mini` via OpenRouter
- **Function calling**: Map LLM outputs directly to `update_candidate_profile(field_name, field_value)`

### API Configuration
- Use **OpenRouter** as the LLM provider (supports multiple models)
- Set `base_url="https://openrouter.ai/api/v1"`
- Include `api_key` from `.env`
- For voice: Deepgram STT + ElevenLabs TTS (`eleven_turbo_v2_5`)

### Error Handling
- Wrap LLM calls in try-except with logging
- Retry failed requests up to `MAX_RETRIES` (default: 2)
- Log full error context: input, model, exception
- Never expose raw API errors to frontend—sanitize messages

---

## 🔊 Voice Agent Rules

### LiveKit Integration
- **Prewarm function**: Load VAD model before job starts (`silero.VAD.load()`)
- **Entrypoint**: Connect to room, wait for participant, build agent
- **Room metadata**: Pass `candidate_id`, `candidate_name`, `questions`, `resume_context` as JSON
- **Function tools**: Use `@function_tool(description=...)` decorator

### Conversation Flow
1. **Greeting**: Brief introduction with question count
2. **Questions**: Ask one at a time, wait for answer
3. **Data capture**: Immediately call `update_candidate_profile()` with extracted info
4. **Acknowledgment**: Keep responses short (3-5 words max)
5. **Completion**: Thank candidate and summarize

### Logging
- Log context injection verification (room vs participant metadata)
- Log resume context received (length + preview)
- Log gap questions received (count + list)
- Log participant connections and data broadcasts
- Use emoji prefixes for quick scans: ✅, ❌, ⚠️, 📤, etc.

---

## 📊 Data Flow

### Extraction Pipeline
```
CSV Input → Resume Processor → LLM Extraction → Pydantic Validation → JSON Cache
```

### Scoring Pipeline
```
Extracted Data → Algo Scorer (hard metrics) + AI Scorer (qualitative) → Combined Score → Ranking
```

### Voice Enhancement
```
Candidate Call → Agent Listens → Function Calls → Profile Updates → Real-time Broadcast
```

---

## 🧪 Testing & Debugging

### Backend Testing
- Test schema validation: `python -c "from backend.models import CandidateExtraction; CandidateExtraction(...).dict()"`
- Test config: `python -c "from backend.config import validate_config; validate_config()"`
- Use FastAPI interactive docs: `http://localhost:8000/docs`

### Frontend Testing
- Check network tab for API calls and responses
- Verify localStorage for any state caching
- Test responsive design at breakpoints (mobile, tablet, desktop)

### Voice Agent Testing
- Mock LiveKit locally or use test room
- Verify metadata is correctly passed (check logs)
- Test function tool calling with sample inputs

---

## 🚀 Deployment Checklist

- [ ] All environment variables in `.env` (don't commit `.env`)
- [ ] Backend runs on `http://localhost:8000`
- [ ] Frontend runs on `http://localhost:3000`
- [ ] Voice agent started: `python backend/livekit_agent.py dev`
- [ ] CORS configured for frontend → backend calls
- [ ] Data directory exists: `backend/data/`
- [ ] API keys valid (OpenRouter, LiveKit, Deepgram, ElevenLabs)

---

## 💡 Key Development Patterns

### Pattern: Streaming Results
```python
# Backend: Yield results as they're available
async def process_candidates():
    for candidate in candidates:
        score = await score_candidate(candidate)
        # Save to cache so frontend sees updates
        cache_update(candidate.id, score)
```

```typescript
// Frontend: Poll status and display updates
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch(`${API_URL}/api/status`);
    const data = await res.json();
    setResults(data.scored_candidates); // Updates UI immediately
  }, 1000);
}, []);
```

### Pattern: Function Tool Integration
```python
@function_tool(description="Update candidate profile with information")
async def update_candidate_profile(field_name: str, field_value: str) -> str:
    # Always log the call
    logger.info(f"🔧 update_candidate_profile({field_name}={field_value})")
    
    # Update session state
    if current_session:
        current_session.update_field(field_name, field_value)
        # Broadcast to all participants
        await broadcast_update(field_name, field_value)
    
    return f"Updated {field_name} successfully"
```

---

## 📝 Commit Message Convention

```
[backend|frontend|docs] Brief description of change

- Detailed bullet points explaining the why and what
- Keep commits focused and atomic
```

**Examples:**
```
[backend] Improve LLM error handling and logging
- Add retry logic for failed API calls
- Log full context for debugging
- Return sanitized errors to frontend

[frontend] Update card colors to purple/pink theme
- Consistent branding across all workflow cards
- Improved visual hierarchy
```

---

## 🎓 Learning Resources

- **Pydantic**: https://docs.pydantic.dev (schema validation)
- **FastAPI**: https://fastapi.tiangolo.com (API framework)
- **LiveKit Agents**: https://docs.livekit.io/agents (voice SDK)
- **Tailwind CSS**: https://tailwindcss.com (styling)
- **Next.js**: https://nextjs.org/docs (React framework)

---

## ✅ Code Review Checklist

Before committing:
- [ ] All imports are used (remove unused)
- [ ] Type hints on all functions (Python & TypeScript)
- [ ] Descriptive variable/function names (no `x`, `temp`, `data`)
- [ ] Logging for debugging (info, warnings, errors)
- [ ] Error handling for all async operations
- [ ] No hardcoded values (use config/constants)
- [ ] Comments for non-obvious logic
- [ ] Consistent formatting (black for Python, prettier for JS)

---

**Last Updated**: December 2024  
**Maintainer**: Anish Gillella
