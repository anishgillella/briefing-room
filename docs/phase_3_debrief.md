# Phase 3 Design: The Debrief & Polish

## 1. Overview
This phase focuses on the post-interview experience: automatically generating a comprehensive debrief artifact that summarizes the call, scores the candidate, and provides actionable recommendations.

## 2. User Flow

### End of Interview
1. **Trigger**: Host clicks "End Interview" in the video call control bar.
2. **Action**:
   - Call ends for all participants.
   - Application automatically redirects Host to `/debrief/[id]/generating`.
   - Backend triggers the "Generate Debrief" workflow.

### Generation State
- **UI**: Clean loading screen with progress indicators.
  - "Fetching transcript..."
  - "Analyzing conversation..."
  - "Generating insights..."
  - "Finalizing debrief..."
- **Technical**: This process may take 10-30 seconds depending on transcript length.

### The Debrief View (`/debrief/[id]`)
- **Access**: Shareable URL (public read access for demo).
- **Layout**: "Clean & Light" document style (Notion-like).
- **Core Sections**:
  1.  **Candidate Header**: Name, Role, Date.
  2.  **Executive Summary**: High-level overview of the interview.
  3.  **Scoring Rubric**: 5-point scale with reasoning for each category.
  4.  **Strengths & Concerns**: Bullet points with evidence from the transcript.
  5.  **Recommendation**: Hire / Advance / Pass.
  6.  **Chat History**: (Optional) Log of questions asked to the Agent during the call.

## 3. Data Sources & Intelligence
To generate a high-quality debrief, the LLM will ingest:
1.  **Job Description**: (From Phase 2 Supabase `jobs` table) - *What we wanted.*
2.  **Resume**: (From Phase 2 Supabase `candidates` table) - *Who they claimed to be.*
3.  **Call Transcript**: (From Daily.co) - *What actually happened.*
4.  **Agent Chat History**: (From Supabase `chat_logs`) - *What the host was curious/concerned about.*

## 4. Scoring Rubric (Standard)
The system will evaluate the candidate on a 1-5 scale for:
1.  **Technical Skills**: Depth of knowledge, problem-solving.
2.  **Communication**: Clarity, articulation, listening.
3.  **Cultural Fit**: Values alignment, collaboration style.
4.  **Role Alignment**: Experience vs. requirements.
5.  **Overall Impression**: Holistic score.

**Reasoning**: Each score must be accompanied by a 1-2 sentence justification citing evidence from the call.

## 5. Technical Architecture

### Database Updates (Supabase)
```sql
-- Store the final debrief
CREATE TABLE debriefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id),
  summary TEXT,
  recommendation TEXT, -- 'HIRE', 'ADVANCE', 'PASS'
  scores JSONB, -- { "technical": 4, "communication": 5, ... }
  transcript_text TEXT, -- Raw transcript for reference
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store chat history for context
CREATE TABLE chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id),
  sender TEXT, -- 'host' or 'agent'
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### LLM Prompt Strategy (OpenAI GPT-4)
```javascript
const systemPrompt = `You are an expert interviewer and hiring manager.
Analyze the following interview data to produce a structured debrief.

JOB DESCRIPTION: ${jdText}
RESUME: ${resumeText}
TRANSCRIPT: ${transcriptText}
HOST SIDEBAR QUESTIONS: ${chatLogText}

Output JSON format:
{
  "summary": "...",
  "recommendation": "ADVANCE",
  "scores": {
    "technical": { "score": 4, "reasoning": "..." },
    "communication": { "score": 5, "reasoning": "..." },
    ...
  },
  "strengths": ["..."],
  "concerns": ["..."]
}`;
```

### Transcript Handling
- Use Daily.co's transcription API.
- If unavailable in the free tier/custom object setup easily, fallback to browser-based Speech Recognition (Web Speech API) or a mock transcript for the prototype to ensure reliability. *Decision: Attempt Daily.co first, fallback to mock if API costs/complexity block progress.*

## 6. Visual Design
- **Scorecards**: Simple, rounded cards with a colored badge for the score (Green 4-5, Yellow 3, Red 1-2).
- **Typography**: Readable serif for body text (like a formal report) or clean sans-serif (Inter).
- **Actions**:
  - "Copy Link" button (top right).
  - "Back to Home" button.

## 7. Implementation Steps (Phase 3)
1.  **End Call Flow**: Handle the "Leave" event and redirect.
2.  **Transcript Retrieval**: Implement fetching from Daily.co or capture buffer.
3.  **Generation API**: `/api/generate-debrief` endpoint calling OpenAI.
4.  **Debrief UI**: Build the display page with Tailwind.
5.  **Polish**: Add loading skeletons and error states.

## 8. Future Work (Out of Scope)
- PDF Download (User opted for web-only).
- Auth/Permissions for viewing debriefs.
- Email delivery.
