# Immersive Candidate Simulation with Vapi & Daily

## 🎯 Objective
Replace the static "Simulate Candidate" placeholder with a **real-time, interactive AI Candidate** that joins the video call, speaks with the interviewer, and mimics a realistic interviewee persona (including imperfections).

This approach enables:
1.  **Realistic Practice**: Interviewers can practice with a "human-like" entity that answers questions dynamically.
2.  **High-Fidelity Transcription**: Because the agent joins as a distinct Daily.co participant, we get a clean, separate audio stream for perfect speaker diarization.
3.  **Automated Debriefs**: The high-quality transcript powers a much more accurate debrief generation.

---

## 🏗️ Architecture

### 1. The "Improv" Backend (`/rooms/{name}/candidate`)
We will create a new endpoint that acts as the bridge between our Daily room and Vapi.

-   **Trigger**: Frontend calls this endpoint when "Simulate Candidate" is clicked.
-   **Actions**:
    1.  **Retrieve Context**: Fetches the stored Resume/JD briefing for the room.
    2.  **Construct Persona**: Builds a system prompt that instructs the AI to be "Imperfectionist" (nervous, uses fillers, maybe weak in certain areas).
    3.  **Dispatch Vapi Call**: Uses Vapi's API to spawn a phone/web call into the Daily room URL.
        -   *Voice*: A realistic voice (e.g., "Generic Male/Female" distinct from the Pre-briefing agent).
        -   *Model*: `gpt-4o` or `claude-3.5-sonnet` for high emotional intelligence.

### 2. Vapi Configuration (The "Actor")
The Vapi agent will be configured with a special System Prompt:

> "You are [Candidate Name]. You are currently in a video interview for [Role].
>
> **Your Persona:**
> - You are slightly nervous but eager.
> - You DO NOT speak like an AI assistant. You speak like a human.
> - Use fillers like 'um', 'uh', 'let me think'.
> - If asked about [Weak Skills], act unsure or give a vague answer.
> - Keep answers relatively short (under 45s) unless probed.
>
> **Context:**
> [Resume Summary]
> [Job Description]"

### 3. Frontend Integration
-   **Video Room**: The existing `daily-react` setup handles the new participant automatically.
-   **Transcription**:
    -   We enable `daily.startTranscription()` on call start.
    -   We listen for `app-message` events containing transcript fragments.
    -   We collect these fragments into a `transcript[]` array in React state.
    -   **Result**: `[{ speaker: "Interviewer", text: "..." }, { speaker: "Candidate AI", text: "..." }]`

### 4. Debrief Pipeline
-   The "End Interview" button now sends the **full transcript** to `/debrief`.
-   The LLM analysis switches from "inferring from questions" to "analyzing the actual conversation".

---

## 🚀 Implementation Plan

1.  **Backend**: Add `vapi.py` service to handle Vapi API interactions.
2.  **API**: Add `POST /rooms/{name}/candidate` endpoint.
3.  **Frontend**: Update `video-room.tsx` to call this endpoint instead of showing the static image.
4.  **Transcription**: Add event listeners for Daily transcription and store the text.
