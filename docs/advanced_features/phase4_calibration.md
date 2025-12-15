# Phase 4: Interviewer Calibration Mode

Train interviewers to maintain consistent hiring standards through calibration exercises.

## Problem Statement

- Different interviewers have different standards ("bar raisers" vs. "rubber stampers")
- Unconscious bias affects scoring
- New interviewers don't know company standards
- Interview scores aren't comparable across interviewers

## Solution

Before interviewing real candidates, interviewers evaluate sample interview recordings and compare their scores to a senior panel's "gold standard."

---

## Calibration Flow

```
┌─────────────────────────────────────────────────────────────┐
│  INTERVIEWER CALIBRATION CENTER                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Complete 3 calibration exercises to start interviewing:    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Exercise 1: Technical Interview Sample               │   │
│  │ [▶️ Watch 10-min clip]                                │   │
│  │ Status: ✅ Completed - Your Score: 72 (Standard: 68) │   │
│  │ Deviation: +4 (Within acceptable range)              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Exercise 2: Behavioral Interview Sample              │   │
│  │ [▶️ Watch 12-min clip]                                │   │
│  │ Status: ⏳ In Progress                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Exercise 3: Edge Case (Borderline Candidate)         │   │
│  │ [🔒 Complete Exercise 2 first]                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Your Calibration Score: 82%                                │
│  "You tend to score technical skills slightly higher        │
│   than the panel average."                                  │
│                                                             │
│  [Continue to Interviewing →] (enabled at 75%+ score)       │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Calibration video samples
CREATE TABLE calibration_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,  -- Stored in Supabase Storage
    duration_sec INT NOT NULL,
    
    -- Expected scores (from senior panel)
    gold_standard_score INT NOT NULL CHECK (gold_standard_score BETWEEN 0 AND 100),
    gold_standard_recommendation TEXT,  -- "Hire", "No Hire", etc.
    gold_standard_notes JSONB,  -- Detailed reasoning
    
    -- Metadata
    interview_type TEXT CHECK (interview_type IN ('phone_screen', 'technical', 'behavioral')),
    difficulty TEXT CHECK (difficulty IN ('clear_pass', 'clear_fail', 'borderline')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interviewer calibration attempts
CREATE TABLE calibration_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    interviewer_id UUID NOT NULL,  -- User ID
    sample_id UUID NOT NULL REFERENCES calibration_samples(id),
    
    -- Interviewer's scores
    given_score INT CHECK (given_score BETWEEN 0 AND 100),
    given_recommendation TEXT,
    given_notes TEXT,
    
    -- Comparison to gold standard
    score_deviation INT,  -- given_score - gold_standard_score
    passed BOOLEAN,  -- Within acceptable deviation (±15)
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interviewer calibration status
CREATE TABLE interviewer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    
    -- Calibration
    calibration_score FLOAT,  -- 0-100
    calibration_completed_at TIMESTAMPTZ,
    calibration_valid_until TIMESTAMPTZ,  -- Requires recalibration every 6 months
    
    -- Patterns (from calibration + real interviews)
    scoring_bias TEXT,  -- "neutral", "lenient", "strict"
    technical_bias FLOAT,  -- +/- deviation on technical questions
    behavioral_bias FLOAT,
    
    -- Stats
    total_interviews INT DEFAULT 0,
    hire_rate FLOAT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Calibration Scoring Logic

```python
def calculate_calibration_score(attempts: List[CalibrationAttempt]) -> float:
    """Calculate overall calibration score from attempts."""
    
    if not attempts:
        return 0.0
    
    scores = []
    for attempt in attempts:
        # Perfect match = 100, ±15 deviation = 70, ±30 = 40, >30 = 0
        deviation = abs(attempt.score_deviation)
        if deviation <= 5:
            scores.append(100)
        elif deviation <= 10:
            scores.append(85)
        elif deviation <= 15:
            scores.append(70)
        elif deviation <= 20:
            scores.append(55)
        elif deviation <= 30:
            scores.append(40)
        else:
            scores.append(0)
    
    return sum(scores) / len(scores)


def check_calibration_valid(interviewer_id: str) -> bool:
    """Check if interviewer is calibrated and not expired."""
    profile = get_interviewer_profile(interviewer_id)
    
    if not profile.calibration_completed_at:
        return False
    
    if profile.calibration_score < 75:
        return False
    
    if datetime.now() > profile.calibration_valid_until:
        return False
    
    return True
```

---

## Bias Detection

After multiple real interviews, detect patterns:

```python
def analyze_interviewer_bias(interviewer_id: str) -> dict:
    """Analyze interviewer's scoring patterns."""
    
    # Get all interviews by this interviewer
    interviews = get_interviewer_interviews(interviewer_id)
    
    # Compare to panel average
    avg_score = mean([i.analytics.overall_score for i in interviews])
    panel_avg = get_company_average_score()
    
    # Detect bias direction
    if avg_score > panel_avg + 10:
        bias = "lenient"
        message = "You tend to score candidates higher than peers."
    elif avg_score < panel_avg - 10:
        bias = "strict"
        message = "You tend to score candidates lower than peers."
    else:
        bias = "neutral"
        message = "Your scoring is well-calibrated with peers."
    
    return {
        "bias": bias,
        "your_average": avg_score,
        "company_average": panel_avg,
        "message": message,
        "recommendations": generate_bias_recommendations(bias)
    }
```

---

## Frontend UI

### Calibration Center

```tsx
<div className="max-w-4xl mx-auto p-6">
  <h1 className="text-2xl font-bold text-white mb-6">Interviewer Calibration</h1>
  
  {/* Progress */}
  <div className="glass-panel rounded-2xl p-6 mb-6">
    <div className="flex justify-between items-center mb-4">
      <span className="text-white/60">Calibration Progress</span>
      <span className="text-2xl font-light text-white">
        {completedCount}/3 Exercises
      </span>
    </div>
    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
      <div 
        className="h-full bg-purple-500"
        style={{ width: `${(completedCount / 3) * 100}%` }}
      />
    </div>
  </div>
  
  {/* Exercises */}
  {samples.map((sample, i) => (
    <div key={sample.id} className={`glass-panel rounded-2xl p-6 mb-4 ${
      sample.status === 'completed' ? 'border border-green-500/30' :
      sample.status === 'in_progress' ? 'border border-yellow-500/30' :
      'opacity-50'
    }`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-white font-medium">{sample.title}</h3>
          <p className="text-white/60 text-sm">{sample.description}</p>
        </div>
        {sample.status === 'completed' && (
          <div className="text-right">
            <div className="text-green-400">Completed</div>
            <div className="text-sm text-white/60">
              Your score: {sample.attempt.given_score}
              <span className={sample.attempt.score_deviation > 0 ? 'text-yellow-400' : 'text-green-400'}>
                ({sample.attempt.score_deviation > 0 ? '+' : ''}{sample.attempt.score_deviation})
              </span>
            </div>
          </div>
        )}
      </div>
      
      {sample.status === 'not_started' && i === completedCount && (
        <button 
          onClick={() => startExercise(sample.id)}
          className="mt-4 btn-primary"
        >
          Start Exercise
        </button>
      )}
    </div>
  ))}
  
  {/* Final Score */}
  {calibrationComplete && (
    <div className="glass-panel rounded-2xl p-6 border-2 border-green-500/30">
      <div className="text-center">
        <div className="text-5xl font-light text-green-400 mb-2">
          {calibrationScore}%
        </div>
        <div className="text-white/60 mb-4">Calibration Score</div>
        <p className="text-white/80 text-sm mb-6">{biasMessage}</p>
        <button className="btn-primary">Start Interviewing →</button>
      </div>
    </div>
  )}
</div>
```

---

## Calibration Sample Management

Admins can create calibration samples:

```python
@router.post("/calibration/samples")
async def create_calibration_sample(
    title: str,
    video_file: UploadFile,
    gold_standard_score: int,
    gold_standard_recommendation: str,
    interview_type: str,
    difficulty: str
):
    """Admin: Create a new calibration sample with gold standard scores."""
    
    # Upload video to storage
    video_url = await upload_to_storage(video_file, "calibration_videos")
    
    # Create sample record
    sample = await create_sample({
        "title": title,
        "video_url": video_url,
        "gold_standard_score": gold_standard_score,
        "gold_standard_recommendation": gold_standard_recommendation,
        "interview_type": interview_type,
        "difficulty": difficulty
    })
    
    return sample
```

---

## Recalibration Triggers

```python
# Automatic recalibration required when:
RECALIBRATION_TRIGGERS = {
    "time_elapsed": timedelta(days=180),  # Every 6 months
    "score_drift": 15,  # If running average deviates >15 from panel
    "low_hire_rate": 0.02,  # If hire rate <2% (too strict)
    "high_hire_rate": 0.50,  # If hire rate >50% (too lenient)
}
```

---

## Implementation Checklist

- [ ] Add calibration tables to schema
- [ ] Create calibration sample upload admin UI
- [ ] Build calibration exercise UI (video + scoring form)
- [ ] Implement calibration scoring logic
- [ ] Add bias detection analytics
- [ ] Integrate calibration check into interview start flow
- [ ] Set up recalibration reminders (email/notification)

---

## Next: [Phase 5 - Predictive Success Score](./phase5_predictive_score.md)
