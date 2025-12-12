# Pluto Integration - Documentation Index

This folder contains phased documentation for integrating **Pluto** (AI talent matching system) into **Briefing Room** (AI interview platform).

---

## 📋 Phases

| Phase | Document | Description | Status |
|-------|----------|-------------|--------|
| 0 | [Interfaces](./00_interfaces.md) | Shared data models & API contracts | 📝 Draft |
| 1 | [Backend Merge](./01_backend_merge.md) | Mount Pluto routes in main FastAPI app | 📝 Draft |
| 2 | [Frontend Integration](./02_frontend_integration.md) | Add candidate pages, wire to interview flow | 📝 Draft |
| 3 | [Voice Agent Unification](./03_voice_agent.md) | Merge LiveKit agents with mode switching | 📝 Draft |

---

## 🎯 Integration Goals

1. **Unified Candidate Pipeline**: Upload CSV → Rank candidates → Select for interview → Conduct interview → Debrief
2. **Single Backend Server**: One FastAPI server with all routes
3. **Consistent UI**: Use shadcn/ui design system throughout
4. **Data Continuity**: Candidate data flows from Pluto ranking through to interview debrief
5. **Keep "Quick Interview"**: Ad-hoc interviews (paste resume/JD) still work

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     UNIFIED BRIEFING ROOM                            │
├─────────────────────────────────────────────────────────────────────┤
│  FRONTEND (Next.js)                                                  │
│  ├── /candidates          ← NEW: Pluto's ranking UI                 │
│  ├── /candidates/upload   ← NEW: CSV upload                         │
│  ├── /candidates/[id]     ← NEW: Detail + "Start Interview"         │
│  ├── /                    ← Updated: Links to candidates + quick    │
│  └── /room/[name]         ← Existing: Interview flow                │
├─────────────────────────────────────────────────────────────────────┤
│  BACKEND (FastAPI)                                                   │
│  ├── /api/pluto/...       ← NEW: Mounted from Pluto                 │
│  ├── /api/rooms/...       ← Existing                                │
│  ├── /api/prebrief/...    ← Existing (enhanced with Pluto scores)   │
│  ├── /api/analytics/...   ← Existing                                │
│  └── /api/coach/...       ← Existing                                │
├─────────────────────────────────────────────────────────────────────┤
│  DATA (JSON files - local dev)                                      │
│  ├── backend/data/candidates.json        ← Shared candidate store   │
│  └── backend/data/ranked_candidates.json ← Pluto output             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend servers | Single FastAPI | Simpler for local dev |
| Database | JSON files | Local dev only, Supabase later |
| Voice unification | Phase 3 (deferred) | Focus on UI/data flow first |
| Pluto UI | Rewrite with shadcn/ui | Unified design system |
| Quick Interview | Keep | Ad-hoc interviews still useful |
