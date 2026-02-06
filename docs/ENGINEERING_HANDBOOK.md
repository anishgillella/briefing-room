# Engineering Handbook & Deep Dive

> **Target Audience:** New engineers joining the Hirely team.
> **Goal:** Understand not just *what* the code does, but *why* and *how* the complex pieces fit together.

---

## 1. System Philosophy: "AI-Native"

Hirely is not just a CRUD app with an AI wrapper. It is **AI-Native**.
- **CRUD apps** store data and display it.
- **Hirely** actively *generates* data.
    - **Jobs:** Generated from conversations (`JobArchitect`).
    - **Candidate Data:** Extracted by LLMs from raw text (`PlutoProcessor`).
    - **Interviews:** Conducted by autonomous agents (`Vapi`).
    - **Reviews:** Written by analysis engines (`InterviewerAnalyzer`).

Most of our complexity lies in **Prompt Engineering**, **Context Injection**, and **Asynchronous Pipelines**.

---

## 2. Core Domain Models

The system revolves around three primary entities defined in `backend/models`.

### A. The Job (`Job`)
The anchor for everything.
- **Source of Truth:** `jobs` table.
- **Key Fields:** `title`, `raw_description` (the source text), `structured_requirements` (JSON extracted by AI).
- **Relationships:** Has many `Candidates`.

### B. The Candidate (`Candidate`)
A person applying to a Job.
- **Source of Truth:** `candidates` table.
- **Key Fields:**
    - `resume_text`: Raw OCR/parsed text from `ResumeProcessor`.
    - `extracted_data` (JSON): The "Pluto Profile" - e.g., `{ "sold_to_finance": true, "quota_attainment": 95 }`.
    - `score` (0-100): Deterministic score calculated by `PlutoProcessor` based on the extracted data.

### C. The Interview (`Interview`)
A point-in-time interaction between a Candidate and the System.
- **Source of Truth:** `interviews` table.
- **Status Flow:** `scheduled` -> `active` -> `completed`.
- **Key Fields:**
    - `transcript`: The raw text of the conversation.
    - `analytics`: The JSON output of the post-interview analysis (scores, red flags).

---

## 3. Deep Dive: The Voice Interview Lifecycle

This is the most complex flow in the system. It connects the Frontend, Backend, Vapi (Voice Provider), and OpenRouter (LLM).

**The 6-Step Interaction Loop:**

1.  **Initialization (`POST /api/vapi-interview/{id}/init`)**
    - The frontend requests to start an interview.
    - The backend fetches the `Candidate` (for their Resume) and `Job` (for the Description).

2.  **Prompt Injection (Critical)**
    - **File:** `backend/services/interviewer_persona.py`
    - The system generates a **Dynamic System Prompt**. It does *not* use a static bot.
    - It constructs a prompt like: *"You are verifying this Resume [RESUME_TEXT] against this Job [JD_TEXT]. Ask about the gap in 2023."*
    - This prompt is pushed to Vapi's API to configure a dedicated phone number/room for this specific session.

3.  **Connection**
    - **File:** `frontend/src/app/interview/[id]/page.tsx`
    - The frontend initializes the Vapi Web SDK with the `assistantId` returned by step 1.
    - Audio begins streaming via WebRTC.

4.  **The Conversation**
    - Vapi handles the speech-to-speech loop.
    - The LLM (configured in step 2) generates responses based on the injected Resume+JD context.
    - Frontend receives events (`call-start`, `call-end`, `volume-level`) to update the UI.

5.  **Webhook Trigger**
    - **File:** `backend/routers/vapi_interview.py` (`vapi_webhook`)
    - When the call ends, Vapi POSTs the `transcript` to our backend.
    - We identify the interview using the `metadata` link established in step 1.

6.  **Asynchronous Analysis**
    - **File:** `backend/services/interviewer_analyzer.py`
    - A background task is spawned (`_generate_interview_analytics`).
    - It feeds the transcript + JD into an LLM (Model: `gpt-4o` or similar).
    - The LLM produces a `DeepAnalytics` JSON object (Scores 1-100, Behavioral Profile, Red Flags).
    - The result is saved to the DB, ready for visualization.

---

## 4. Deep Dive: "Pluto" (The Intelligence Engine)

"Pluto" is our internal name for the candidate processing pipeline.
**File:** `backend/services/pluto_processor.py`

It operates in two stages:

**Stage 1: Extraction (LLM)**
- Input: Raw Resume Text.
- Process: Uses a schema-enforced LLM call to extract structured facts.
- Output: "Fact Sheet" (e.g., *Is Founder? Yes. Years Exp? 5.*).
- *Why?* LLMs are bad at math but good at reading. We use them just to read.

**Stage 2: Scoring (Deterministic)**
- Input: "Fact Sheet" from Stage 1.
- Process: Plain Python math (`calculate_algo_score`).
- Logic: `score = (years_exp * 10) + (is_founder ? 20 : 0) ...`
- *Why?* This ensures fairness. Every candidate is scored by the exact same math rules, eliminating AI hallucination/bias in ranking.

---

## 5. Deep Dive: Job Architect

The "Job Architect" is an AI aimed at solving the "Blank Page Problem" for recruiters.
**File:** `backend/services/job_architect.py`

- **The Problem:** Recruiters don't know what they want.
- **The Solution:** A consultative chat interface.
- **Architecture:**
    - A recursive chat loop.
    - The AI has tools to "Draft Requirements" or "Ask Clarifying Question".
    - Uses `MarketData` stubs to provide salary insights during the conversation (e.g., *"That budget is low for a Senior Engineer in SF"*).

---

## 6. Frontend Architecture Patterns

We use `Next.js 15` with the **App Router**.

- **Server vs Client Components:**
    - Pages (`page.tsx`) are usually Server Components (fetching initial data).
    - Interactive widgets (`JobArchitectChat.tsx`, `CandidateAnalytics.tsx`) are Client Components (`"use client"`).

- **State Management:**
    - We avoid Redux/complex stores.
    - We use URL state (Next.js `useParams`, `useSearchParams`) for shareability.
    - React `Context` is used only for Auth (`AuthContext`).

- **Styling:**
    - **Tailwind CSS** for layout.
    - **Design Tokens** (`lib/design-tokens.ts`) for consistent "Space/Cyber" theming (colors, gradients).

---

## 7. How to Debug

**"The AI isn't asking the right questions."**
1. Check `backend/services/interviewer_persona.py`.
2. Look at the `system_prompt` generation.
3. Is variables `resume_text` or `job_description` empty?

**"The Score is wrong."**
1. Check `PlutoProcessor.calculate_algo_score`.
2. Did the Extraction step miss the data? (Check `extracted_data` JSON in DB).

**"Voice Latency is high."**
1. This is usually Vapi <-> LLM latency.
2. Check the Vapi Dashboard or region settings in `vapi_interview_assistant.py`.
