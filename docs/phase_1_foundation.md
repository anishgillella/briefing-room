# Phase 1 Design: Foundation & Video Room

## 1. Overview
This phase establishes the core application structure, the video call infrastructure using Daily.co, and the mechanism for distinguishing between the **Host** (the interviewer) and the **Candidate** (the interviewee).

## 2. User Flow & Simulation Strategy
To enable testing, we will use a **Link-Based Role System**.

1.  **Home Screen**:
    *   **UI**: Clean, minimalist. Centered card with a "Start Briefing" button.
    *   **Action**: Clicking "Start" creates a Daily.co room and redirects the user to the **Host Room**.

2.  **Host Room (`/room/[id]?role=host`)**:
    *   **UI**: The main video interface.
    *   **Simulation Controls**: A "Candidate Link" button in the control bar.
    *   **Action**: Copy this link and open it in Incognito/different browser to simulate the Candidate joining. This creates a real second participant event, which triggers the Agent to leave.

3.  **Candidate Room (`/room/[id]?role=candidate`)**:
    *   **UI**: Simple video preview and "Join Call" button.
    *   **Behavior**: When this user joins, the Host's client detects the `participant-joined` event and triggers the Agent to leave.

## 3. Visual Aesthetic: "Clean & Light"
Modern, airy design inspired by Linear (Light Mode) or Notion.

*   **Color Palette**:
    *   **Background**: White (`#FFFFFF`) or subtle gray (`#F9FAFB`).
    *   **Text**: Dark Slate (`#1E293B`) for primary, softer gray (`#64748B`) for secondary.
    *   **Accents**: Professional Blue/Indigo (`#4F46E5`) for primary actions.
    *   **Borders**: Very subtle (`#E2E8F0`).
*   **Typography**: `Inter` or `Geist Sans` for a crisp, technical feel.
*   **Layout**:
    *   **Video Grid**: Minimalist floating video tiles. No heavy borders.
    *   **Controls**: Floating pill-shaped control bar at the bottom.

## 4. Tech Stack
*   **Next.js (App Router)**: Industry standard for React apps. Perfect for routing and API handling.
*   **Daily.co (Custom Object)**: Using `daily-js` Custom Call Object (not Prebuilt UI). We need full control to programmatically handle the "vanish" logic.
*   **Tailwind CSS**: Essential for achieving the "Clean & Light" look quickly.
*   **State Management**: React Context + Hooks.

## 5. Implementation Steps (Phase 1)
1.  **Scaffold**: `create-next-app` with Tailwind.
2.  **API**: Create `/api/create-room` to talk to Daily.co API.
3.  **UI Components**: Build the `Button`, `VideoTile`, and `ControlBar` components with the "Clean & Light" theme.
4.  **Room Logic**:
    *   Initialize Daily call object.
    *   Handle device permissions (Camera/Mic).
    *   Render local video.
    *   Render remote participants (placeholder for now).

## 6. Key Terminology
*   **Host**: The person conducting the interview (formerly "Interviewer").
*   **Candidate**: The person being interviewed.
