# Hirely (formerly Briefing Room)

A high-performance, AI-native interview intelligence platform designed to eliminate context loss, standardize evaluations, and provide real-time coaching for hiring teams.

---

## 🚀 The Core Philosophy

Traditional hiring breaks when context gets lost. Interviewers walk in "cold," skimming a PDF 5 minutes before the call. Hirely preserves every signal from sourcing to the final offer, turning unstructured conversations into trusted, evidence-linked data.

---

## ✨ Features

### 🏢 Job Management & Enrichment
- **Intelligent Profiling**: Transform raw job descriptions into precise evaluation criteria automatically.
- **Dynamic Rubrics**: AI-generated scoring rubrics that ensure every candidate is measured against the same objective benchmarks.
- **Enrichment Engine**: Automatically extracts key skills and signals from unstructured job requirements.

### 🏊 Talent Pool & Pipeline
- **Centralized Database**: A unified view of all candidates across every open role.
- **AI Scoring & Ranking**: Real-time scoring of candidates based on resume-to-job alignment.
- **Pipeline Visibility**: Track conversion rates and bottlenecks at every stage of the hiring funnel.

### 💬 Live Interview Intelligence
- **AI Copilot Sidebar**: Real-time coaching prompts and suggested follow-up questions during the interview.
- **Evidence-Linked Debrief**: Automatically generates post-interview summaries where every score is backed by a specific transcript moment.
- **Briefing Dashboard**: A high-impact dashboard showing competency radar charts, strengths, and concerns *before* the interview starts.

### 🎭 Practice & Simulation
- **AI Candidate Simulator**: Practice conducting interviews with OpenAI Realtime-powered virtual candidates that respond to your questions in real-time.
- **Bias Monitoring**: Manager-level analytics that track question quality and potential bias across the hiring team.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Core** | Next.js 15+ (App Router), FastAPI (Python 3.12) |
| **Real-time** | LiveKit (Audio), Daily.co (Video) |
| **AI/LLM** | OpenAI Realtime API, OpenRouter (Gemini 2.0 Flash) |
| **Database** | Supabase (PostgreSQL) |
| **Styling** | Vanilla CSS, Tailwind CSS, Framer Motion |
| **State** | React Context + TanStack Query |

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- Python 3.12+
- Supabase Account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/anishgillella/briefing-room.git
   cd briefing-room
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

### Execution

```bash
# Terminal 1: Backend
cd backend && uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 📈 Roadmap

### Phase 1: Context Preservation (Current ✅)
- Pre-briefing dashboards, AI-assisted rubrics, and real-time coaching.

### Phase 2: Calibration (In Progress 🏗️)
- Linking interview scores to long-term employee performance metadata to identify "high-signal" interviewers.

### Phase 3: The Knowledge Graph (Future 🔮)
- Building a cross-organization corpus of interview data to pattern-match successful hires at scale.

---

## 🤝 Contribution

Contributions are welcome! Please branch off `main` and submit a PR for any enhancements or bug fixes.

