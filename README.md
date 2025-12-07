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

### 🎨 Premium UI/UX
- **Dark Mode Design**: Sleek slate-950 background with violet/emerald accents
- **Glassmorphism Effects**: Backdrop blur, subtle borders, and depth
- **Mission Control Aesthetic**: Data-dense, professional interface inspired by space control centers
- **Responsive Layout**: Optimized for various screen sizes with proper overflow handling

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

---

## Design Decisions & Tradeoffs

### 1. OpenAI Realtime vs Vapi for Candidate Agent
**Decision**: Use OpenAI Realtime API for AI candidate simulation  
**Reason**: Vapi internally uses Daily.co, causing instance conflicts with our video room  
**Tradeoff**: OpenAI Realtime is more expensive (~$0.30/min) but doesn't conflict with video

###2. In-Memory vs Database Storage
**Decision**: Use in-memory dict for briefing/debrief data  
**Reason**: Faster setup, no database dependencies for demo  
**Tradeoff**: Data lost on server restart. Production would use Supabase or PostgreSQL

### 3. State Caching for Briefing Dashboard
**Decision**: Lift briefing state to parent (`page.tsx`) instead of re-fetching  
**Reason**: Briefs are expensive to generate (Gemini 2.5 Flash API call)  
**Implementation**: Pass `initialBrief` prop from PreBriefingScreen → VideoRoom  
**Benefit**: Instant overlay load during interview

### 4. Glassmorphism UI Design
**Decision**: Dark mode with glass-morphism instead of light traditional UI  
**Reason**: Modern, premium aesthetic that stands out. Reduces eye strain in long interviews  
**Tradeoff**: Accessibility (contrast) requires careful color selection

### 5. Modal Overlay vs Navigation for Briefing Access
**Decision**: Fixed modal overlay instead of navigation/route change  
**Reason**: Keeps user mentally "in the interview." Video context visible behind blur  
**Implementation**: `fixed inset-0 z-50` with backdrop blur, constrained `max-w-6xl h-[90vh]`

### 6. Two-Column Video Grid vs Auto-Grid
**Decision**: Force 2-column grid with equal-sized tiles  
**Reason**: Ensures interviewer and candidate frames are visually equal (power balance)  
**Implementation**: Wrap each tile in `min-h-[300px]` divs within `grid-cols-2`

### 7. Coach Mode Timing Logic
**Decision**: Show coach suggestions every 5 minutes, track elapsed time  
**Reason**: Avoid overwhelming interviewer with constant pings  
**Implementation**: Store `interviewStartTime`, calculate elapsed in sidebar

---

## Future Improvements

### With 2 More Days

1. **Persistent Storage**: Migrate to Supabase for interview history
2. **Interview Library**: Browse past interviews, compare candidates
3. **Team Collaboration**: Share debriefs with hiring team, add comments
4. **Candidate Portal**: Post-interview feedback and next steps
5. **Email Integration**: Auto-send calendar invites and debriefs
6. **Advanced Analytics**: Trend analysis across multiple interviews
7. **Mobile Responsive**: Optimize for tablet/mobile interviewer experience
8. **Custom Scoring Rubrics**: Allow teams to define their own evaluation dimensions

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

This project uses several paid APIs:

- **Daily.co**: Free tier available (10,000 room minutes/month)
- **OpenRouter (Gemini)**: ~$0.15 per 1M tokens input, ~$0.60 per 1M output
- **OpenAI Realtime**: ~$0.06/min input + $0.24/min output (for AI candidate)
- **Vapi**: ~$0.05-0.15/min (for voice briefing, optional feature)

**Estimated cost per interview**: $0.10-0.50 depending on features used

---

## Philosophy

This is a canvas, not a checklist. The spec was intentionally open-ended to allow creativity while demonstrating production-quality engineering:

- **Scoping**: We added features beyond requirements (radar charts, coach mode, mission control UI) where they meaningfully improved the experience
- **Shipping**: We prioritized working features over perfect features. Database can wait; delight can't
- **Polish**: We sweated the details - smooth animations, rotating facts, glassmorphism - because those details compound into "wow"

---

## Acknowledgments

Built for the Superposition.ai interview challenge. Thank you for the opportunity to create something delightful.
