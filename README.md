# Hirely (formerly Briefing Room)

A high-performance, AI-native interview intelligence platform designed to eliminate context loss, standardize evaluations, and provide real-time coaching for hiring teams.

---

## 🚀 Overview

Hirely preserves every signal from sourcing to the final offer, turning unstructured conversations into trusted, evidence-linked data.

## ✨ Key Features

- **Job Management**: Intelligent profiling and AI-generated scoring rubrics.
- **Talent Pool**: Centralized candidate database with AI scoring and ranking.
- **Interview Intelligence**: Real-time coaching, evidence-linked debriefs, and automated analytics.
- **Candidate Simulation**: Practice interviews with AI-powered virtual candidates.

## 📚 Documentation

- **[Setup Guide](docs/SETUP_GUIDE.md)**: Instructions for installing and running the project locally.
- **[Architecture](docs/ARCHITECTURE.md)**: High-level system design and technology stack.

## ⚡ Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:3000** to start.

---

## 🛠 Tech Stack

- **Frontend**: Next.js 15+, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI (Python 3.12)
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenRouter (LLM), Vapi (Voice), OpenAI Realtime

## 🤝 Contribution

Contributions are welcome! Please branch off `main` and submit a PR for any enhancements or bug fixes.
