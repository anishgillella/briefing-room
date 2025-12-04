# Phase 2 Design: The Intelligent Agent

## 1. Overview
This phase implements the core "magic" of Briefing Room: an AI agent that briefs the host via voice before the candidate joins, then vanishes instantly and transforms into an optional chat assistant available only to the host during the interview.

## 2. User Flow

### Pre-Interview Setup (Home Screen)
1. **Upload Job Description**:
   - Support PDF upload or text paste
   - Extract text using `pdf-parse`
   - Store in Supabase `jobs` table

2. **Upload Candidate Resume**:
   - PDF upload only
   - Extract text using `pdf-parse`
   - Store in Supabase `candidates` table

3. **Start Briefing**:
   - Create Daily.co room
   - Link JD + Resume to room in Supabase
   - Redirect host to `/room/[id]?role=host`

### Voice Briefing Phase (Host Only)
1. **Host Joins Empty Room**:
   - Video call loads
   - Host sees "Start Briefing" button with waveform/orb visual

2. **Host Clicks "Start Briefing"**:
   - Vapi assistant joins as audio participant
   - Waveform/orb animates when agent speaks
   - Agent provides intelligent briefing (dynamically generated from uploaded JD + Resume):
     - Example: _"Good morning. Let me brief you on [Candidate Name], who's interviewing for [Job Title]..."_
     - Highlights: Key qualifications matching the JD requirements
     - Watch-fors: Potential gaps or concerns
   - **Note**: All dialogue is generated from the actual uploaded documents, not hardcoded scenarios
   
3. **Two-Way Conversation**:
   - Host can ask questions via voice
   - _"What about her leadership experience?"_
   - Agent responds contextually from resume + JD

### The Vanish Moment
1. **Candidate Joins Call**:
   - Daily.co fires `participant-joined` event
   - **Instant actions** (no delay):
     - Vapi agent disconnects from call
     - Waveform/orb disappears
     - Sidebar chat panel fades in (host only)

2. **Visual State**:
   - Candidate sees: Normal video call with host
   - Host sees: Normal video call + subtle chat sidebar

### Optional Chat Assistant (During Interview)
> [!NOTE]
> **Design Decision**: We chose **text-based chat** over voice for the optional feature because:
> - Voice during the interview would be confusing (Who is the agent talking to?)
> - Text is private, non-disruptive, and doesn't interfere with the conversation
> - The README says "in any way you wish" - text is the cleanest solution

1. **Host-Only Sidebar**:
   - Appears on right side after agent vanishes
   - Clean, minimalist chat UI (matches Clean & Light theme)
   - Placeholder: _"I'm here if you need me. Ask anything about the candidate or the role."_

2. **How It Works**:
   - Host types question: _"What was their last company?"_
   - Send to OpenAI API (not Vapi) with context:
     ```
     System: You are a briefing assistant. Answer questions about this interview.
     JD: [full text]
     Resume: [full text]
     User: What was their last company?
     ```
   - Stream response back to chat sidebar
   - **Candidate cannot see or hear any of this**

## 3. Technical Architecture

### Data Layer: Supabase Schema
```sql
-- Job descriptions
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,  -- Extracted from PDF
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidates
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  resume_text TEXT NOT NULL,  -- Extracted from PDF
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms (links jobs + candidates + Daily.co)
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id),
  candidate_id UUID REFERENCES candidates(id),
  daily_room_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Voice Agent: Vapi Configuration
```javascript
// When host clicks "Start Briefing"
const vapiConfig = {
  model: "gpt-4-turbo",
  voice: "jennifer-playht",  // Professional, warm female voice
  systemPrompt: `You are a professional briefing assistant. Your role is to brief the interviewer (host) on the candidate before they arrive.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText}

Provide a concise, structured briefing:
1. Candidate background summary
2. Key strengths matching the JD
3. Potential concerns or gaps
4. Suggested talking points

Be formal and concise. Speak naturally, not like reading a document.`,
  firstMessage: "Let me brief you on this candidate.",
};
```

### Chat Assistant: OpenAI API
```javascript
// When host asks a question in sidebar
const chatCompletion = await openai.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [
    {
      role: "system",
      content: `You are a briefing assistant helping the host during an interview.
      
      JOB DESCRIPTION:
      ${jobDescription}
      
      CANDIDATE RESUME:
      ${resumeText}
      
      Answer questions concisely. Be helpful but brief.`
    },
    {
      role: "user",
      content: userQuestion
    }
  ],
  stream: true  // For real-time UI updates
});
```

### Daily.co Event Handling
```javascript
// Detect candidate joining
callObject.on("participant-joined", (event) => {
  if (event.participant.user_name === "candidate") {
    // Instant vanish
    vapiSession.disconnect();
    setShowWaveform(false);
    setShowChatSidebar(true);
  }
});
```

## 4. Visual Design: Agent Representation

### Waveform/Orb Component
- **Idle State**: Gentle pulsing circle (indigo gradient)
- **Speaking State**: Animated waveform bars (synchronized to audio)
- **Size**: 120px × 120px centered in video grid
- **Animation**: Smooth CSS transitions (200ms ease)

### Chat Sidebar
- **Position**: Right edge of screen, overlays video area
- **Width**: 320px
- **Background**: Frosted glass effect (`backdrop-blur`) over white/90% opacity
- **Messages**: 
  - User: Right-aligned, indigo background
  - Agent: Left-aligned, gray background
- **Input**: Bottom-fixed text input with send button

## 5. Implementation Steps (Phase 2)

1. **Supabase Setup**:
   - Create schema
   - Set up RLS policies (public read for demo)
   - Generate API keys

2. **Home Screen Upload Flow**:
   - Build upload UI (drag-drop for PDFs)
   - `/api/upload-jd` endpoint (extracts text, saves to DB)
   - `/api/upload-resume` endpoint

3. **Voice Briefing**:
   - Integrate Vapi SDK
   - Build "Start Briefing" button
   - Render waveform/orb component
   - Handle voice conversation

4. **Vanish Logic**:
   - Listen to `participant-joined`
   - Disconnect Vapi gracefully
   - Trigger sidebar animation

5. **Chat Sidebar**:
   - Build chat UI component
   - `/api/chat` endpoint (OpenAI streaming)
   - Real-time message rendering

## 6. Context Window Budget
- **Resume**: ~1,500-3,000 tokens
- **Job Description**: ~400-750 tokens
- **System Prompt**: ~200-300 tokens
- **Conversation**: ~500-1,000 tokens
- **Total**: ~2,600-5,050 tokens (4% of GPT-4's 128k limit)

✅ **Plenty of headroom for complex resumes and long conversations**

## 7. API Keys Required
- Daily.co API Key
- Vapi Public + Private Keys
- OpenAI API Key (for chat assistant)
- Supabase Project URL + Anon Key

## 8. Error Handling (Future Work)
- PDF extraction failures → fallback to manual text input
- Agent fails to join → retry logic or skip to chat mode
- Network issues during briefing → reconnection handling
