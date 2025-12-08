# Briefing Room

An AI-powered interview platform that briefs interviewers before candidates arrive, provides real-time coaching during interviews, and generates comprehensive post-interview analytics.

---

## The Insight

The 5 minutes before an interview are valuable and often wasted. The interviewer walks in cold. The candidate is a PDF they skimmed.

Let's make those minutes collaborative, calm, and effective.

---

## Features

### 🎯 Pre-Interview Intelligence
- **AI-Generated Briefing Dashboard**: Comprehensive candidate analysis with competency radar chart, strengths/concerns, and suggested questions
- **Voice AI Assistant**: Optional Vapi-powered voice briefing for hands-free preparation
- **Engaging Loading Experience**: Rotating recruitment statistics while AI analyzes candidate data

### 💬 Live Interview Support
- **AI Chat Sidebar**: Real-time coaching suggestions based on interview progress
- **Coach Mode**: Time-aware prompts and talking point recommendations
- **In-Interview Briefing Access**: Quick-access modal overlay to review candidate details without leaving the call
- **AI Candidate Simulator**: Practice interviews with OpenAI Realtime-powered virtual candidates

### 📊 Post-Interview Analytics
- **Automated Debrief**: Comprehensive interview summary with scoring and evidence
- **Score Breakdown**: Visual scoring across multiple competency dimensions
- **Q&A Analysis**: Question quality assessment and conversation balance metrics
- **Next Round Recommendations**: AI-suggested questions for follow-up interviews

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 16 (Turbopack) |Modern React framework with app router |
| **UI Components** | shadcn/ui + Tailwind CSS | Premium component library |
| **Video** | Daily.co | WebRTC video conferencing |
| **Voice (Briefing)** | Vapi | Pre-interview voice AI assistant |
| **Voice (Candidate)** | OpenAI Realtime API | Real-time AI candidate simulation |
| **Backend** | FastAPI (Python) | REST API server |
| **AI Models** | OpenRouter (Gemini 2.5 Flash) | Text generation and analysis |
| **Charts** | Recharts | Data visualization |
| **Icons** | Lucide React | Consistent iconography |

---

## Setup

### Prerequisites

```bash
# Required
Node.js 18+ and npm
Python 3.12+
```

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd Superposition

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Frontend setup
cd ../frontend
npm install
```

### Environment Variables

Create `.env.local` in the `frontend` directory:

```bash
# Daily.co Configuration (Required)
NEXT_PUBLIC_DAILY_API_KEY=your_daily_api_key

# Backend API (Required)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Vapi Configuration (Optional - for voice briefing)
NEXT_PUBLIC_VAPI_WEB_KEY=your_vapi_public_key
NEXT_PUBLIC_VAPI_BRIEFING_ASSISTANT_ID=your_assistant_id  # Optional

# OpenAI Configuration (Optional - for AI candidate)
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key
```

Create `.env` in the `backend` directory:

```bash
# Daily.co Configuration (Required)
DAILY_API_KEY=your_daily_api_key

# OpenRouter Configuration (Required)
OPENROUTER_API_KEY=your_openrouter_api_key

# CORS (Optional - defaults to localhost:3000)
CORS_ORIGINS=http://localhost:3000
```

### Running Locally

```bash
# Terminal 1: Start backend
cd backend
source venv/bin/activate
uvicorn main:app --reload
# Backend runs on http://localhost:8000

# Terminal 2: Start frontend
cd frontend
npm run dev
# Frontend runs on http://localhost:3000
```

---

## User Flow

### Interviewer Experience

1. **Setup** (Join Screen)
   - Enter name and select "Interviewer" role
   - Paste job description and candidate resume/notes
   - Click "Start Interview Session"

2. **Pre-Briefing** (Dashboard + Optional Voice)
   - View AI-generated candidate analysis dashboard
   - Review competency radar chart, strengths, concerns
   - Optionally activate voice AI for hands-free briefing
   - Click "Start Interview" when ready

3. **Interview** (Video Room)
   - Join Daily.co video call
   - View AI Chat Sidebar with real-time coaching
   - Access briefing overlay anytime via "Briefing" button
   - Optionally test with AI candidate simulator
   - Click "End Interview" when complete

4. **Debrief** (Analytics Dashboard)
   - Review automated interview summary
   - View score breakdown across competencies
   - Analyze Q&A balance and question quality
   - Save suggested questions for next round

### Candidate Experience

1. **Setup** - Enter name, select "Candidate" role
2. **Interview** - Join video call, standard interview experience
3. **Done** - Simple "Leave Call" button when finished

### 🔒 Security: AI Features Hidden from Candidates

The AI coaching features (chat sidebar, suggestions, briefing) are **only visible to the interviewer**. Here's how to ensure separation:

#### Production-Ready Options

**Option 1: Role-Based Routes (Recommended)**
```
/room/[roomName]           → Interviewer view (AI features)
/room/[roomName]/candidate → Candidate view (video only)
```
Check the route to conditionally hide AI components. Most secure and cleanest UX.

**Option 2: Authentication Tokens**
Generate two different tokens when creating a room:
- Interviewer token → unlocks AI features
- Candidate token → video only

Validate tokens server-side for true security.

**Option 3: Query Parameter**
```
/room/abc123?role=interviewer  → Full features
/room/abc123                   → Video only (default)
```
Simpler but less secure (query params can be guessed).

---

## Design Decisions & Tradeoffs

### 1. OpenAI Realtime vs Vapi for Candidate Agent
**Decision**: Use OpenAI Realtime API for AI candidate simulation  
**Reason**: Vapi internally uses Daily.co, causing instance conflicts with our video room  
**Tradeoff**: OpenAI Realtime is more expensive (~$0.30/min) but doesn't conflict with video

### 2. Visual Briefing First, Voice Agent as Add-On
**Decision**: Prioritize the visual briefing dashboard over voice-only interaction  
**Reason**: Research shows humans learn and retain information faster visually than through audio. The briefing screen displays candidate claims, alignment with job requirements, and areas of concern in a scannable format  
**Voice Agent Role**: Available for interviewers who prefer hands-free prep or have follow-up questions. The voice agent has full context (resume, job description, briefing) and can answer any clarifying questions

### 3. Context-Aware Coaching (Not Time-Based)
**Decision**: Show coaching suggestions based on answer quality, not fixed intervals  
**Reason**: After each candidate response, we analyze the answer and suggest whether to probe deeper or move on  
**Implementation**: Real-time analysis of conversation flow provides relevant follow-up questions

### 4. Gemini 2.5 Flash for LLM Calls
**Decision**: Use Gemini 2.5 Flash via OpenRouter for all text generation  
**Reason**: 128K token context window handles even long interviews (30-90 min). Most interviews stay well under this limit  
**Tradeoff**: Perfect balance of cost, latency, context size, and intelligence for interview analysis

### 5. In-Memory Single-Session Storage
**Decision**: Use in-memory dict for briefing/debrief data (single interview instance)  
**Reason**: Time constraint - focused on core experience over persistence  
**Tradeoff**: Data lost on server restart; interviews are independent of each other. Production would use Supabase for cross-interview analytics

---

## Product Vision: Interview Intelligence Platform

This project is a **foundation for something much bigger**. Here's how a single interview tool evolves into an enterprise-grade hiring intelligence platform:

### Phase 1: Single Interview (Current ✅)
- Pre-brief → In-interview coaching → Shareable debrief artifact
- Voice AI for hands-free preparation
- Real-time chat coaching during interviews

### Phase 2: Interview History
**Problem**: Hiring decisions are made based on a single interview snapshot. Previous interviews with the same candidate are lost.  
**Solution**: Aggregate all interviews for a candidate into a unified view. Surface patterns across interviewers.  
**Example**: *"3 of 4 interviewers flagged 'communication' as a concern. Is this a real signal or are they anchoring on the same data?"*

### Phase 3: Calibration & Consistency
**Problem**: Interviewers aren't calibrated. One person's "strong yes" means nothing because we don't track if their "yes" candidates actually succeed.  
**Solution**: Link interview scores to 1-year retention and performance outcomes. Build an interviewer effectiveness score.  
**Example**: *"Priya's 'strong yes' candidates have 85% 1-year retention. Mike's have 40%. Trust Priya's signal more."*

### Phase 4: Hiring Funnel Intelligence
**Problem**: Companies don't know where their hiring process breaks down. They optimize blindly.  
**Solution**: Track conversion rates at each stage. Identify which interview rounds lose the best candidates. A/B test different question sets.  
**Example**: *"60% of candidates fail the system design round, but system design scores don't correlate with job performance. Consider removing it."*

### Phase 5: The Knowledge Graph
**Problem**: Institutional knowledge walks out when interviewers leave. Every interviewer asks questions differently.  
**Solution**: Build a corpus of every question asked and every answer given. Pattern match against successful hires to surface what actually predicts success.  
**Example**: *"Here's how your last 50 successful hires answered 'Tell me about a conflict with a manager.' Compare this candidate's answer."*

---

## Future Improvements

### With 2 More Days

1. **Persistent Storage**: Migrate to Supabase for interview history
2. **"Copy as Markdown" Debrief**: One-click copy debrief for Slack/email sharing, Browse past interviews, compare candidates
3. **Team Collaboration**: Share debriefs with hiring team on different channels, add comments
4. **Structured Scorecards**: Force ratings on specific competencies (creates training data)
5. **Evidence Linking**: Every rating must link to a transcript moment


### Technical Debt

1. **Error Boundaries**: Add React error boundaries for graceful failures
2. **Loading States**: Add skeletons for all async operations
3. **Test Coverage**: Add unit + integration tests (currently 0% coverage)
4. **API Rate Limiting**: Implement rate limiting on backend endpoints
5. **Logging**: Add structured logging (currently only console.log)
6. **WebSocket Reconnection**: Handle network interruptions gracefully

---

## Key Challenges Solved

See [`docs/DOCS_INDEX.md`](docs/DOCS_INDEX.md) for complete challenges log.

**Notable Challenges**:
1. Vapi + Daily.co SDK conflict (resolved with OpenAI Realtime)
2. React Hook ordering with early returns (hooks must be first)
3. Briefing overlay feeling like navigation (resolved with modal + backdrop)
4. Video controls pushed off-screen (resolved with `shrink-0` on control bar)
5. Briefing re-fetch during interview (resolved with state lifting/caching)

---

## API Costs

Production cost estimates for a **30-minute interview**:

| Service | Rate | Usage per Interview | Cost |
|---------|------|---------------------|------|
| **Daily.co** | $0.01/min after free tier | 60 room-min (2 users) | **~$0.60** |
| **OpenRouter (Gemini 2.5 Flash)** | $0.15/1M in, $0.60/1M out | ~15K tokens | **~$0.01** |
| **Vapi** (optional voice briefing) | ~$0.10/min | 5 min briefing | **~$0.50** |

### Production Cost: 8-Hour Workday

Assuming **10-12 interviews per interviewer per day** (30 min each + breaks):

| Scenario | Cost/Interview | Daily Cost (12 interviews) | Monthly (22 days) |
|----------|----------------|---------------------------|-------------------|
| **Standard** (AI briefing + debrief) | ~$0.61 | **~$7.32** | **~$161** |
| **With voice briefing** | ~$1.11 | **~$13.32** | **~$293** |

> 💡 **Note**: The AI candidate simulator (OpenAI Realtime at ~$9/session) is for practice only and not included in production estimates.

