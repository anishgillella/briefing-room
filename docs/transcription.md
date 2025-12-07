# Real-Time Transcription & Debrief Integration

## 🎯 Objective
Leverage Daily.co's real-time transcription features to caption the interview and feed a **verbatim transcript** into the Debrief generator. This replaces the "question inference" method with "actual conversation analysis."

## 🏗️ Architecture

### 1. Daily.co Transcription
-   **Trigger**: We call `callObject.startTranscription()` when the interview begins.
-   **Events**: Daily sends `app-message` events for transcript fragments (or `transcription-started` / `transcription-message` depending on the specific Daily configuration).
    -   *Note*: Daily's modern transcription usually emits specific `transcription-message` events if enabled via `startTranscription`, or `app-message` if using a custom bot. We will use the standard `startTranscription()` which emits `transcription-started`, `transcription-stopped`, and `app-message` (often containing the Deepgram payload) or potentially the newer direct events.
    -   **Correction**: Daily's React hooks (`useDailyEvent`) support `transcription-message` directly if the `enable_transcription` property is set.

### 2. Frontend State (`video-room.tsx`)
-   **Storage**: We maintain a `transcript[]` array in the component state.
    ```typescript
    interface TranscriptLine {
      speakerId: string; // 'interviewer' or 'candidate'
      text: string;
      timestamp: string;
      isFinal: boolean; 
    }
    ```
-   **Collection**:
    -   Listen for `transcription-message`.
    -   Append new lines / update partial lines.
    -   Store the *full session transcript* in memory (or SessionStorage for safety).

### 3. Debrief Integration (`api.ts` & Backend)
-   **Data Transfer**: Update `generateDebrief` to accept a `transcript` string/array instead of (or in addition to) `chatHistory`.
-   **Backend Analysis**:
    -   The prompt for `gpt-4o-mini` is updated to analyze the **Transcript** primarily.
    -   This allows detecting: *Tone, specific technical answers, communication style*.

## 🚀 Implementation Plan

1.  **Frontend**: Add `useDailyEvent("transcription-message", ...)` listener.
2.  **Frontend**: Add "Start Transcription" logic (auto-start on join or button).
    -   *Constraint*: Transcription costs money. We should probably trigger it automatically if the user has a "Pro" room, or offer a toggle. For "Simulate", we'll auto-enable.
3.  **API**: Update `generateDebrief` signature in `api.ts`.
4.  **Backend**: Update `DebriefRequest` model in `rooms.py` to accept `transcript`.
5.  **Backend**: Update the System Prompt in `rooms.py` to analyze the transcript.
