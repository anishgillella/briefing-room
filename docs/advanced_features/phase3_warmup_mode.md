# Phase 3: Candidate Warm-Up Mode

A 3-minute AI warm-up conversation before the real interview to help candidates perform at their best.

## Problem Statement

- Candidates are nervous in the first 5 minutes of interviews
- First impressions are often based on anxiety, not ability
- Interview performance ≠ job performance due to interview stress

## Solution

Before the interviewer joins, an AI assistant has a brief, friendly warm-up conversation with the candidate to reduce nerves and get them talking.

---

## User Experience

### Candidate View

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Welcome! Your interview will start in 3 minutes.       │
│                                                             │
│  I'm here to help you warm up. No pressure, just a quick   │
│  chat to get you comfortable before your interviewer joins.│
│                                                             │
│  "What's something you're excited about in your current    │
│   role or a recent project you worked on?"                 │
├─────────────────────────────────────────────────────────────┤
│  [Candidate speaking...]                                    │
│                                                             │
│  "That sounds interesting! Your interviewer will join in   │
│   about 90 seconds. You've got this! 💪"                   │
└─────────────────────────────────────────────────────────────┘
```

### Interviewer View

```
┌─────────────────────────────────────────────────────────────┐
│  Warm-Up Summary (pre-interview):                          │
│                                                             │
│  ✓ Candidate completed warm-up                             │
│  ✓ Seemed: Relaxed / Nervous / Energetic                   │
│  ✓ Mentioned: "Machine learning project at current company"│
│                                                             │
│  💡 Good opener: "I heard you're working on ML - tell me   │
│     more about that project."                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Warm-Up Conversation Flow

```
1. Welcome (10 sec)
   "Hey [Name]! I'm just going to ask a couple easy questions 
    to warm up before your interviewer joins."

2. Easy Question #1 (60 sec)
   Random from pool:
   - "What's something you're excited about recently at work?"
   - "What got you interested in this role?"
   - "Tell me about a hobby or interest outside of work."

3. Positive Acknowledgment (10 sec)
   "That's great! [Brief acknowledgment of what they said]"

4. Easy Question #2 (60 sec) - Optional
   "One more quick one - if you could learn any new skill 
    instantly, what would it be?"

5. Handoff (20 sec)
   "Perfect! Your interviewer [Name] will join in about 
    30 seconds. They'll start by introducing themselves. 
    You've got this! 💪"

6. Interviewer Joins
   → AI quietly exits
   → Interviewer sees warm-up summary
```

---

## Database Schema

```sql
CREATE TABLE warmup_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id),
    
    -- Timing
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_sec INT,
    
    -- Conversation
    transcript JSONB DEFAULT '[]',
    
    -- AI Analysis
    candidate_mood TEXT CHECK (candidate_mood IN ('relaxed', 'nervous', 'energetic', 'neutral')),
    topics_mentioned JSONB DEFAULT '[]',  -- ["ML project", "current company"]
    suggested_opener TEXT,  -- For interviewer
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## LiveKit Integration

The warm-up uses the same LiveKit room but with an AI-only participant:

```python
async def run_warmup_session(room_name: str, candidate_name: str):
    """Run 3-minute warm-up with candidate."""
    
    # Connect AI to room
    room = await connect_to_room(room_name, identity="warmup_assistant")
    
    # Play welcome message
    await speak(f"Hey {candidate_name}! I'm just going to ask a couple easy questions...")
    
    # Ask warm-up question
    question = random.choice(WARMUP_QUESTIONS)
    await speak(question)
    
    # Listen for response (60 sec max)
    response = await listen_for_response(max_duration=60)
    
    # Acknowledge
    acknowledgment = await generate_acknowledgment(response)
    await speak(acknowledgment)
    
    # Handoff
    await speak("Perfect! Your interviewer will join in about 30 seconds. You've got this!")
    
    # Analyze for interviewer
    analysis = await analyze_warmup(response)
    save_warmup_session(room_name, analysis)
    
    # Disconnect AI
    await disconnect()
```

---

## AI Analysis

```python
WARMUP_ANALYSIS_PROMPT = """
Analyze this warm-up conversation transcript.

TRANSCRIPT:
{transcript}

OUTPUT:
{{
  "candidate_mood": "relaxed" | "nervous" | "energetic" | "neutral",
  "topics_mentioned": ["topic1", "topic2"],
  "suggested_opener": "A natural follow-up question the interviewer could ask",
  "notes": "Any observations the interviewer should know"
}}
"""
```

---

## Frontend Integration

### Before Interview Starts

```tsx
// Interview waiting room
{warmupStatus === 'in_progress' && (
  <div className="glass-panel rounded-3xl p-6 text-center">
    <Bot className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-pulse" />
    <h3 className="text-white text-lg mb-2">Warming Up Candidate...</h3>
    <p className="text-white/60 text-sm">
      Our AI is having a quick chat with {candidate.name} to help them relax.
      You'll be able to join in {timeRemaining} seconds.
    </p>
    <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
      <div 
        className="h-full bg-blue-500 transition-all duration-1000"
        style={{ width: `${warmupProgress}%` }}
      />
    </div>
  </div>
)}

// Warmup complete - show summary
{warmupStatus === 'completed' && warmupSummary && (
  <div className="glass-panel rounded-3xl p-6 mb-4 bg-green-500/5 border border-green-500/20">
    <div className="flex items-center gap-2 mb-3">
      <CheckCircle className="w-5 h-5 text-green-400" />
      <span className="text-green-400 font-medium">Candidate Warmed Up</span>
    </div>
    <p className="text-white/80 text-sm mb-2">
      Mood: <span className="capitalize">{warmupSummary.candidate_mood}</span>
    </p>
    {warmupSummary.topics_mentioned.length > 0 && (
      <p className="text-white/60 text-sm mb-2">
        Mentioned: {warmupSummary.topics_mentioned.join(', ')}
      </p>
    )}
    {warmupSummary.suggested_opener && (
      <div className="p-3 bg-yellow-500/10 rounded-xl">
        <Lightbulb className="w-4 h-4 text-yellow-400 inline mr-2" />
        <span className="text-yellow-200 text-sm">
          Suggested opener: "{warmupSummary.suggested_opener}"
        </span>
      </div>
    )}
  </div>
)}
```

---

## Configuration Options

```python
WARMUP_CONFIG = {
    "enabled": True,
    "duration_sec": 180,  # 3 minutes
    "questions_count": 1,  # 1-2 questions
    "auto_start": True,  # Start when candidate joins
    "interviewer_wait": 30,  # Seconds before interviewer can join
}
```

---

## Warm-Up Question Pool

```python
WARMUP_QUESTIONS = [
    # Work-related (low-stakes)
    "What's something you're excited about in your current role?",
    "What got you interested in this opportunity?",
    "Tell me about a project you've enjoyed working on recently.",
    
    # Personal (optional, based on settings)
    "Do you have any hobbies or interests outside of work?",
    "If you could learn any skill instantly, what would it be?",
    "What's the best thing that's happened to you this week?",
]
```

---

## Implementation Checklist

- [ ] Add `warmup_sessions` table to schema
- [ ] Create warm-up AI agent (similar to interview agent)
- [ ] Build warm-up analysis prompt
- [ ] Integrate with LiveKit room lifecycle
- [ ] Add interviewer waiting room UI
- [ ] Add warm-up summary display
- [ ] Make warm-up opt-in/opt-out configurable

---

## Next: [Phase 4 - Interviewer Calibration](./phase4_calibration.md)
