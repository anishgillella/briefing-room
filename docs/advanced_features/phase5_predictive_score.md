# Phase 5: Predictive Hiring Success Score

Train a model on actual hiring outcomes to predict which candidates will succeed on the job.

## Problem Statement

- Interview scores don't always predict on-the-job success
- Companies hire based on interview performance, not job performance
- No feedback loop to improve interview processes
- "Good interviewer" ≠ "Good employee"

## Solution

Track hired candidates' actual performance (6-month reviews) and correlate back to interview data to identify patterns that predict success.

---

## The Feedback Loop

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Interview  │────►│    Hired     │────►│  6-Month     │
│   Analytics  │     │              │     │   Review     │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │    ML Model  │
                                          │   Training   │
                                          └──────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────┐
│  INSIGHTS:                                                   │
│  • Candidates who mention metrics → 2.3x higher retention   │
│  • "Tell me about yourself" score NOT correlated with success│
│  • System design score → highest correlation with performance│
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Employee outcomes (post-hire)
CREATE TABLE employee_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    
    -- Employment
    hire_date DATE NOT NULL,
    current_status TEXT CHECK (current_status IN ('active', 'resigned', 'terminated', 'promoted')),
    departure_date DATE,
    tenure_months INT,
    
    -- Performance Reviews
    review_3mo_score INT CHECK (review_3mo_score BETWEEN 1 AND 5),
    review_6mo_score INT CHECK (review_6mo_score BETWEEN 1 AND 5),
    review_12mo_score INT CHECK (review_12mo_score BETWEEN 1 AND 5),
    
    -- Success Metrics
    performance_rating TEXT CHECK (performance_rating IN ('exceeds', 'meets', 'below')),
    promoted BOOLEAN DEFAULT FALSE,
    promotion_months INT,  -- Months until first promotion
    
    -- Manager Feedback
    manager_notes TEXT,
    would_rehire BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Predictive model features
CREATE TABLE interview_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    
    -- Extracted features from interview
    mentioned_metrics BOOLEAN,  -- Did they quantify achievements?
    structured_answers BOOLEAN,  -- Used STAR or similar framework?
    asked_questions INT,  -- How many questions did they ask?
    enthusiasm_score FLOAT,  -- Sentiment analysis
    response_length_avg FLOAT,  -- Average words per response
    
    -- Question-level correlations
    q_tell_me_about_yourself FLOAT,
    q_why_this_company FLOAT,
    q_biggest_challenge FLOAT,
    q_system_design FLOAT,
    q_coding FLOAT,
    q_leadership FLOAT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model predictions
CREATE TABLE success_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    
    -- Prediction
    predicted_success_score FLOAT,  -- 0-100
    confidence FLOAT,  -- 0-1
    
    -- Top factors
    positive_factors JSONB DEFAULT '[]',  -- ["mentioned metrics", "asked 5 questions"]
    negative_factors JSONB DEFAULT '[]',  -- ["short answers", "no enthusiasm"]
    
    -- Comparison
    percentile_rank INT,  -- Top X% of candidates
    
    model_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Feature Extraction

```python
def extract_interview_features(candidate_id: str) -> dict:
    """Extract predictive features from interview data."""
    
    interviews = get_completed_interviews(candidate_id)
    analytics_list = [get_analytics(i.id) for i in interviews]
    transcripts_list = [get_transcript(i.id) for i in interviews]
    
    features = {}
    
    # Quantifiable achievements
    features["mentioned_metrics"] = any(
        re.search(r'\d+%|\$\d+|million|thousand', t.full_text, re.I)
        for t in transcripts_list
    )
    
    # Question count (curiosity)
    features["asked_questions"] = sum(
        t.full_text.count("?") for t in transcripts_list
        if "candidate" in t.get("speaker", "")
    )
    
    # Response length
    candidate_turns = [
        turn for t in transcripts_list for turn in t.turns
        if turn["speaker"] == "candidate"
    ]
    features["response_length_avg"] = mean([
        len(turn["text"].split()) for turn in candidate_turns
    ]) if candidate_turns else 0
    
    # Enthusiasm (sentiment)
    features["enthusiasm_score"] = analyze_sentiment(
        " ".join([t.full_text for t in transcripts_list])
    )
    
    # Question-specific scores
    for qa in analytics_list:
        for question in qa.question_analytics:
            topic_key = f"q_{question.topic.lower().replace(' ', '_')}"
            if topic_key not in features:
                features[topic_key] = question.quality_score
    
    return features
```

---

## Model Training

```python
from sklearn.ensemble import GradientBoostingClassifier
import pandas as pd

def train_success_model():
    """Train model on hired candidates with known outcomes."""
    
    # Get all hired candidates with outcomes
    data = get_candidates_with_outcomes()
    
    if len(data) < 50:
        raise ValueError("Need at least 50 outcomes to train model")
    
    # Prepare features
    X = pd.DataFrame([
        get_interview_features(c.candidate_id) for c in data
    ])
    
    # Target: success = review_6mo_score >= 4 AND still employed
    y = [
        1 if (c.review_6mo_score >= 4 and c.current_status == 'active')
        else 0
        for c in data
    ]
    
    # Train model
    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=4,
        min_samples_leaf=5
    )
    model.fit(X, y)
    
    # Feature importance
    importance = dict(zip(X.columns, model.feature_importances_))
    
    # Save model
    save_model(model, f"success_model_v{datetime.now().strftime('%Y%m%d')}")
    
    return model, importance
```

---

## Success Score Generation

```python
def generate_success_prediction(candidate_id: str) -> dict:
    """Generate success prediction for a candidate."""
    
    model = load_latest_model()
    features = extract_interview_features(candidate_id)
    
    # Predict probability
    proba = model.predict_proba([list(features.values())])[0][1]
    score = int(proba * 100)
    
    # Get top factors
    feature_contributions = get_feature_contributions(model, features)
    positive = [f for f, v in feature_contributions.items() if v > 0][:3]
    negative = [f for f, v in feature_contributions.items() if v < 0][:3]
    
    # Percentile rank
    all_scores = get_all_candidate_scores()
    percentile = percentileofscore(all_scores, score)
    
    return {
        "predicted_success_score": score,
        "confidence": model_confidence(proba),
        "positive_factors": positive,
        "negative_factors": negative,
        "percentile_rank": int(percentile)
    }
```

---

## Outcome Input UI

HR/Managers input outcomes at review milestones:

```tsx
// Employee Outcome Form
<div className="glass-panel rounded-3xl p-6">
  <h3 className="text-white font-medium mb-4">6-Month Review: {employee.name}</h3>
  
  <div className="space-y-4">
    <div>
      <label className="text-white/60 text-sm">Performance Rating</label>
      <div className="flex gap-2 mt-2">
        {['Below', 'Meets', 'Exceeds'].map(rating => (
          <button
            key={rating}
            onClick={() => setRating(rating)}
            className={`px-4 py-2 rounded-xl ${
              selectedRating === rating
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-white/60'
            }`}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
    
    <div>
      <label className="text-white/60 text-sm">Score (1-5)</label>
      <input
        type="range"
        min="1"
        max="5"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        className="w-full"
      />
      <div className="text-center text-white">{score}/5</div>
    </div>
    
    <div>
      <label className="text-white/60 text-sm">Would you rehire this person?</label>
      <div className="flex gap-4 mt-2">
        <button onClick={() => setWouldRehire(true)} className="btn-ghost">Yes</button>
        <button onClick={() => setWouldRehire(false)} className="btn-ghost">No</button>
      </div>
    </div>
    
    <button onClick={submitOutcome} className="btn-primary w-full">
      Submit Review
    </button>
  </div>
</div>
```

---

## Analytics Dashboard

```tsx
// Predictive Insights Dashboard
<div className="grid grid-cols-2 gap-6">
  {/* Top Predictive Factors */}
  <div className="glass-panel rounded-3xl p-6">
    <h3 className="text-white/60 text-sm uppercase mb-4">Top Success Predictors</h3>
    {topFactors.map((factor, i) => (
      <div key={i} className="flex justify-between items-center py-3 border-b border-white/10">
        <span className="text-white">{formatFactorName(factor.name)}</span>
        <span className={factor.correlation > 0 ? 'text-green-400' : 'text-red-400'}>
          {factor.correlation > 0 ? '+' : ''}{(factor.correlation * 100).toFixed(0)}%
        </span>
      </div>
    ))}
  </div>
  
  {/* Model Performance */}
  <div className="glass-panel rounded-3xl p-6">
    <h3 className="text-white/60 text-sm uppercase mb-4">Model Accuracy</h3>
    <div className="text-center">
      <div className="text-5xl font-light text-green-400">{modelAccuracy}%</div>
      <div className="text-white/60">Prediction Accuracy</div>
      <div className="text-sm text-white/40 mt-2">
        Based on {outcomeCount} hired candidates
      </div>
    </div>
  </div>
</div>
```

---

## Candidate Profile Integration

Show prediction on candidate page:

```tsx
{successPrediction && (
  <div className="glass-panel rounded-3xl p-6 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
    <div className="flex justify-between items-start">
      <div>
        <h3 className="text-white/60 text-sm uppercase">Predicted Success</h3>
        <div className="text-4xl font-light text-white mt-1">
          {successPrediction.predicted_success_score}%
        </div>
        <div className="text-sm text-white/40">
          Top {100 - successPrediction.percentile_rank}% of candidates
        </div>
      </div>
      <TrendingUp className="w-8 h-8 text-green-400" />
    </div>
    
    <div className="mt-4 grid grid-cols-2 gap-4">
      <div>
        <div className="text-green-400 text-xs uppercase mb-2">Positive Signals</div>
        {successPrediction.positive_factors.map((f, i) => (
          <div key={i} className="text-sm text-white/80">✓ {f}</div>
        ))}
      </div>
      <div>
        <div className="text-yellow-400 text-xs uppercase mb-2">To Watch</div>
        {successPrediction.negative_factors.map((f, i) => (
          <div key={i} className="text-sm text-white/80">⚠ {f}</div>
        ))}
      </div>
    </div>
  </div>
)}
```

---

## Implementation Checklist

- [ ] Add `employee_outcomes`, `interview_features`, `success_predictions` tables
- [ ] Build feature extraction pipeline
- [ ] Create outcome input UI for HR/managers
- [ ] Implement initial model training (requires 50+ outcomes)
- [ ] Build prediction generation API
- [ ] Add prediction display to candidate profile
- [ ] Create insights dashboard
- [ ] Set up model retraining pipeline (weekly/monthly)

---

## Next: [Phase 6 - Manager Accountability Dashboard](./phase6_manager_dashboard.md)
