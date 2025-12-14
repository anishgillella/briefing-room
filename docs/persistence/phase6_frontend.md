# Phase 6: Frontend Updates

This document covers updating the frontend to display the **Interview History tab** and **Accept/Reject** functionality.

## Simplified UX Flow

```
Candidate Page
├── Tab: Profile (bio, skills, initial scores)
├── Tab: Interview History ⭐ NEW
│   ├── Stage Progress Indicator (visual pipeline)
│   ├── Phone Screen [Completed] - Score 72 [expand]
│   ├── Technical [Completed] - Score 85 [expand]
│   ├── Behavioral [Not Started]
│   │   └── [Start Interview] button
│   └── Final Decision Section
│       ├── [Accept ✅] (disabled until all 3 done)
│       └── [Reject ❌] (disabled until all 3 done)
└── Tab: Pre-Brief (context for current stage)
```

---

## Step 1: Stage Progress Indicator

Add a visual pipeline at the top of the candidate page:

```tsx
interface StageStatus {
  stage: 'phone_screen' | 'technical' | 'behavioral';
  label: string;
  status: 'completed' | 'in_progress' | 'pending';
  score?: number;
}

const STAGES: StageStatus[] = [
  { stage: 'phone_screen', label: 'Phone Screen', status: 'pending' },
  { stage: 'technical', label: 'Technical', status: 'pending' },
  { stage: 'behavioral', label: 'Behavioral', status: 'pending' },
];

// Component
<div className="flex items-center justify-between mb-6">
  {stages.map((stage, i) => (
    <React.Fragment key={stage.stage}>
      <div className={`flex flex-col items-center p-4 rounded-xl flex-1 ${
        stage.status === 'completed' 
          ? 'bg-green-500/10 border-2 border-green-500/50' 
          : stage.status === 'in_progress'
          ? 'bg-yellow-500/10 border-2 border-yellow-500/50'
          : 'bg-white/5 border border-white/10'
      }`}>
        <div className="flex items-center gap-2 mb-1">
          {stage.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-400" />}
          {stage.status === 'in_progress' && <Clock className="w-4 h-4 text-yellow-400" />}
          <span className="text-sm font-medium text-white">{stage.label}</span>
        </div>
        {stage.score && (
          <span className={`text-2xl font-light ${
            stage.score >= 80 ? 'text-green-400' :
            stage.score >= 60 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {stage.score}
          </span>
        )}
      </div>
      {i < stages.length - 1 && (
        <ChevronRight className="w-6 h-6 text-white/30 mx-2" />
      )}
    </React.Fragment>
  ))}
</div>
```

---

## Step 2: Interview History Tab

A new tab that shows all prior interview analytics:

```tsx
// Interview History Tab Content
<div className="space-y-6">
  {/* Summary Card */}
  <div className="glass-panel rounded-3xl p-6">
    <div className="flex justify-between items-center">
      <div>
        <h3 className="text-white/60 text-xs uppercase tracking-wider">Average Score</h3>
        <span className="text-4xl font-light text-white">{averageScore}</span>
      </div>
      <div className="flex gap-2">
        {interviews.map(i => (
          <div key={i.stage} className="text-center px-3">
            <div className="text-lg font-medium text-white">{i.analytics?.overall_score || '-'}</div>
            <div className="text-xs text-white/40">{i.stage}</div>
          </div>
        ))}
      </div>
    </div>
  </div>

  {/* Individual Stage Cards */}
  {interviews.map((interview) => (
    <details key={interview.id} className="glass-panel rounded-2xl p-4">
      <summary className="cursor-pointer flex justify-between items-center">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-white font-medium">{formatStage(interview.stage)}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-xl font-medium ${
            interview.analytics?.overall_score >= 80 ? 'text-green-400' :
            interview.analytics?.overall_score >= 60 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {interview.analytics?.overall_score}
          </span>
          <span className="text-xs px-2 py-1 rounded bg-white/10 text-white/60">
            {interview.analytics?.recommendation}
          </span>
        </div>
      </summary>
      
      <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
        {/* Synthesis */}
        <div>
          <h4 className="text-white/40 text-xs uppercase mb-2">Summary</h4>
          <p className="text-white/80 text-sm">{interview.analytics?.synthesis}</p>
        </div>
        
        {/* Question Analytics (collapsed) */}
        <div>
          <h4 className="text-white/40 text-xs uppercase mb-2">Questions Asked</h4>
          <div className="space-y-2">
            {interview.analytics?.question_analytics?.map((qa, i) => (
              <div key={i} className="text-sm p-3 bg-black/20 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-white/80">{qa.question}</span>
                  <span className="text-white/40">{qa.quality_score}/100</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Topics to Probe (for next stage) */}
        {interview.analytics?.topics_to_probe?.length > 0 && (
          <div>
            <h4 className="text-white/40 text-xs uppercase mb-2">Flagged for Follow-up</h4>
            <div className="flex flex-wrap gap-2">
              {interview.analytics.topics_to_probe.map((topic, i) => (
                <span key={i} className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  ))}

  {/* Start Next Interview Button */}
  {nextStage && (
    <button
      onClick={() => startInterview(nextStage)}
      className="w-full py-4 bg-purple-500 hover:bg-purple-600 rounded-2xl text-white font-medium flex items-center justify-center gap-2"
    >
      <Play className="w-5 h-5" />
      Start {formatStage(nextStage)} Interview
    </button>
  )}

  {/* Final Decision Section */}
  {allStagesComplete && (
    <div className="glass-panel rounded-3xl p-6 border-2 border-purple-500/30">
      <h3 className="text-white font-medium mb-4">Final Decision</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <button
          onClick={() => submitDecision('accepted')}
          className="py-4 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-xl text-green-400 font-medium flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-5 h-5" />
          Accept Candidate
        </button>
        <button
          onClick={() => submitDecision('rejected')}
          className="py-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-red-400 font-medium flex items-center justify-center gap-2"
        >
          <XCircle className="w-5 h-5" />
          Reject Candidate
        </button>
      </div>
      
      <textarea
        placeholder="Add notes about the decision (optional)..."
        value={decisionNotes}
        onChange={(e) => setDecisionNotes(e.target.value)}
        className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white/80 text-sm resize-none"
        rows={3}
      />
    </div>
  )}
</div>
```

---

## Step 3: API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /candidates/{id}/interviews` | GET | Get all interviews with analytics |
| `POST /candidates/{id}/interview/start` | POST | Auto-start next stage interview |
| `PATCH /candidates/{id}/decision` | PATCH | Submit Accept/Reject decision |

---

## Step 4: Backend Auto-Increment Logic

The "Start Interview" button doesn't require stage selection. Backend determines next stage:

```python
@router.post("/candidates/{candidate_id}/interview/start")
async def start_next_interview(candidate_id: str):
    """Start an interview for the next incomplete stage."""
    
    STAGE_ORDER = ['phone_screen', 'technical', 'behavioral']
    
    # Get completed stages
    completed = await get_completed_stages(candidate_id)
    
    # Find next stage
    next_stage = None
    for stage in STAGE_ORDER:
        if stage not in completed:
            next_stage = stage
            break
    
    if not next_stage:
        raise HTTPException(status_code=400, detail="All stages complete")
    
    # Create interview
    interview = await create_interview(candidate_id, next_stage)
    
    # Update candidate pipeline_status
    await update_candidate_status(candidate_id, next_stage)
    
    return {
        "interview_id": interview.id,
        "stage": next_stage,
        "room_name": interview.room_name,
        "token": generate_livekit_token(interview.room_name)
    }
```

---

## Step 5: Decision Submission

```python
@router.patch("/candidates/{candidate_id}/decision")
async def submit_decision(candidate_id: str, decision: str, notes: str = ""):
    """Submit Accept/Reject decision after all stages complete."""
    
    # Validate all stages complete
    completed = await get_completed_stages(candidate_id)
    if len(completed) < 3:
        raise HTTPException(status_code=400, detail="Complete all stages first")
    
    # Update candidate
    await update_candidate(candidate_id, {
        "final_decision": decision,  # 'accepted' or 'rejected'
        "decision_notes": notes,
        "decided_at": datetime.now(),
        "pipeline_status": decision
    })
    
    return {"status": "ok", "decision": decision}
```

---

## Step 6: New Types

Add to `frontend/src/types/index.ts`:

```typescript
export type InterviewStage = 'phone_screen' | 'technical' | 'behavioral';

export interface Interview {
  id: string;
  candidate_id: string;
  stage: InterviewStage;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  interviewer_name?: string;
  started_at?: string;
  ended_at?: string;
  analytics?: Analytics;
  transcript?: Transcript;
}

export interface CandidateDecision {
  final_decision: 'accepted' | 'rejected' | null;
  decision_notes?: string;
  decided_at?: string;
}
```

---

## Summary

| Feature | Implementation |
|---------|----------------|
| **Stage Progress** | Visual 3-step pipeline at top |
| **Interview History Tab** | Expandable cards per stage with analytics |
| **Auto-Increment** | Backend determines next stage |
| **Start Interview Button** | Single button, no stage dropdown |
| **Accept/Reject** | Dual buttons enabled after 3 stages |
| **Decision Notes** | Textarea for optional feedback |

---

## Completion Checklist

- [ ] Phase 1: Schema (fixed 3-stage enum)
- [ ] Phase 2: Supabase project configured
- [ ] Phase 3: Python models updated
- [ ] Phase 4: Existing data migrated
- [ ] Phase 5: Backend routes with auto-increment
- [ ] Phase 6: Interview History tab + Accept/Reject UI
