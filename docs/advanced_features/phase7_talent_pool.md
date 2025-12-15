# Phase 7: Cross-Company Talent Pool

An opt-in, anonymized talent network where candidates can share interview performance across companies.

## Problem Statement

- Same candidates apply to 10 companies, repeat interviews at each
- Companies waste time on candidates already vetted elsewhere
- Candidates repeat stressful interviews unnecessarily
- No shared signal → inefficient market

## Solution

With **candidate consent**, create a network where:
- Candidates can share anonymized interview scores
- Companies can see pre-verified candidates
- Reduces duplicate work for everyone

---

## How It Works

### For Candidates

```
┌─────────────────────────────────────────────────────────────────────────┐
│  YOUR TALENT PROFILE (Opt-In Network)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ✓ Your interview data is anonymized until you match with a company    │
│  ✓ Companies see your verified skills, not your name                   │
│  ✓ You control which interviews are visible                            │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  VISIBLE INTERVIEWS                                                 │ │
│  │                                                                     │ │
│  │  ☑ Acme Corp - Software Engineer (Score: 82)                       │ │
│  │  ☑ Globex Inc - Senior Dev (Score: 78)                             │ │
│  │  ☐ Evil Corp - Tech Lead (Score: 65) [Hidden by you]               │ │
│  │                                                                     │ │
│  │  Overall Verified Score: 80                                         │ │
│  │  Verified Skills: Python ✓, System Design ✓, Leadership ✓          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [Manage Visibility] [Download My Data] [Leave Network]                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### For Companies

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TALENT POOL - Pre-Verified Candidates                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Filters: [Role: Engineer ▼] [Score: 75+ ▼] [Skills: Python ▼]         │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Candidate #4521 (anonymous)                                        │ │
│  │  ───────────────────────────────────────────────────────────────── │ │
│  │  Verified Experience: 7 years                                       │ │
│  │  Verified Skills: Python (3 interviews), AWS (2 interviews)         │ │
│  │  Aggregate Score: 82 (from 4 companies)                             │ │
│  │  Availability: Actively looking                                      │ │
│  │                                                                     │ │
│  │  [Express Interest →]                                               │ │
│  │                                                                     │ │
│  │  Note: Candidate identity revealed upon mutual match                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Candidate #8934 (anonymous)                                        │ │
│  │  ...                                                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Matching Flow

```
Company expresses interest
        │
        ▼
Candidate receives notification
"Acme Corp is interested in your profile"
        │
        ▼
Candidate reviews company
        │
    ┌───┴───┐
    ▼       ▼
 Accept   Decline
    │       │
    ▼       │
Identity    │
revealed    │
    │       │
    ▼       │
Direct      └──► No action
contact
```

---

## Database Schema

```sql
-- Candidate opt-in to talent network
CREATE TABLE talent_network_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    
    -- Anonymization
    anonymous_id TEXT UNIQUE NOT NULL,  -- "Candidate #4521"
    
    -- Profile settings
    is_active BOOLEAN DEFAULT FALSE,  -- Opted in?
    is_available BOOLEAN DEFAULT TRUE,  -- Looking for roles?
    
    -- Aggregated scores (from all visible interviews)
    aggregate_score INT,
    verified_skills JSONB DEFAULT '[]',  -- [{skill, interview_count, avg_score}]
    verified_experience_years FLOAT,
    
    -- Privacy controls
    visible_interview_ids JSONB DEFAULT '[]',  -- Candidate controls which interviews are shared
    hidden_company_ids JSONB DEFAULT '[]',  -- Companies they don't want to match with
    
    -- Contact preferences
    preferred_roles JSONB DEFAULT '[]',
    preferred_locations JSONB DEFAULT '[]',
    salary_range JSONB,  -- {min, max, currency}
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company interest expressions
CREATE TABLE talent_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    company_id UUID NOT NULL,
    anonymous_profile_id TEXT NOT NULL,  -- "Candidate #4521"
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'declined', 'expired')),
    
    -- Company message
    role_title TEXT,
    message_to_candidate TEXT,
    
    -- Timestamps
    expressed_at TIMESTAMPTZ DEFAULT NOW(),
    candidate_responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Matches (after mutual interest)
CREATE TABLE talent_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    company_id UUID NOT NULL,
    
    -- Revealed info
    candidate_email TEXT NOT NULL,
    candidate_name TEXT NOT NULL,
    company_contact_email TEXT NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'matched' CHECK (status IN ('matched', 'interviewing', 'hired', 'passed')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Aggregation Logic

```python
def calculate_talent_profile(candidate_id: str) -> dict:
    """Aggregate verified data from multiple interviews."""
    
    profile = get_talent_profile(candidate_id)
    visible_interviews = profile.visible_interview_ids
    
    # Get analytics from visible interviews only
    analytics_list = get_analytics_for_interviews(visible_interviews)
    
    # Aggregate score
    aggregate_score = mean([a.overall_score for a in analytics_list])
    
    # Verified skills (mentioned in multiple interviews)
    skill_counts = defaultdict(list)
    for a in analytics_list:
        for evidence in a.skill_evidence:
            skill_counts[evidence.skill].append(evidence.confidence)
    
    verified_skills = [
        {
            "skill": skill,
            "interview_count": len(scores),
            "confidence": "high" if len(scores) >= 2 else "medium"
        }
        for skill, scores in skill_counts.items()
        if len(scores) >= 1
    ]
    
    return {
        "aggregate_score": aggregate_score,
        "verified_skills": verified_skills,
        "interview_count": len(analytics_list)
    }
```

---

## Privacy & Compliance

### Candidate Controls

```python
# Candidates have full control
CANDIDATE_RIGHTS = {
    "opt_in": "Must explicitly opt into network",
    "opt_out": "Can leave anytime, data deleted",
    "visibility": "Choose which interviews are visible",
    "block": "Block specific companies from seeing their profile",
    "export": "Download all data (GDPR compliance)",
    "delete": "Right to be forgotten"
}
```

### Data Minimization

```python
# Only share aggregated, non-identifying data
SHARED_DATA = {
    "experience_years": "Rounded to nearest year",
    "skills": "Only skills verified across 2+ interviews",
    "score": "Aggregate, not per-company scores",
    "location": "City only, not address",
    "salary": "Range, not exact number"
}

NEVER_SHARED = {
    "name": "Until matched",
    "email": "Until matched",
    "phone": "Until matched",
    "current_employer": "Never",
    "interview_transcripts": "Never",
    "individual_company_scores": "Never"
}
```

---

## Frontend - Candidate Opt-In

```tsx
// Talent Network Opt-In Modal
<Modal>
  <h2>Join the Talent Network</h2>
  <p className="text-white/60 mb-6">
    Get discovered by companies looking for verified talent. 
    You control what's visible.
  </p>
  
  <div className="space-y-4 mb-6">
    <label className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
      <input type="checkbox" checked onChange={...} />
      <div>
        <div className="text-white">Share verified skills</div>
        <div className="text-white/40 text-sm">
          Skills confirmed across multiple interviews
        </div>
      </div>
    </label>
    
    <label className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
      <input type="checkbox" checked onChange={...} />
      <div>
        <div className="text-white">Share aggregate score</div>
        <div className="text-white/40 text-sm">
          Combined score from all visible interviews
        </div>
      </div>
    </label>
  </div>
  
  <p className="text-xs text-white/40 mb-4">
    Your name and contact info remain hidden until you match with a company.
    You can opt out anytime.
  </p>
  
  <button className="btn-primary w-full">Join Network</button>
</Modal>
```

---

## Frontend - Company Browse

```tsx
// Talent Pool Browser
<div className="space-y-4">
  {/* Filters */}
  <div className="flex gap-4 mb-6">
    <select className="select">
      <option>All Roles</option>
      <option>Engineer</option>
      <option>Designer</option>
    </select>
    <select className="select">
      <option>Score: 70+</option>
      <option>Score: 80+</option>
      <option>Score: 90+</option>
    </select>
    <input 
      type="text" 
      placeholder="Skills: Python, React..."
      className="input flex-1"
    />
  </div>
  
  {/* Candidate Cards */}
  {candidates.map(c => (
    <div key={c.anonymous_id} className="glass-panel rounded-2xl p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-white font-medium">{c.anonymous_id}</h3>
          <p className="text-white/60 text-sm">
            {c.verified_experience_years} years • {c.interview_count} verified interviews
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-light text-green-400">{c.aggregate_score}</div>
          <div className="text-xs text-white/40">Aggregate Score</div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-4">
        {c.verified_skills.map(skill => (
          <span 
            key={skill.skill}
            className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
          >
            {skill.skill} ✓ ({skill.interview_count})
          </span>
        ))}
      </div>
      
      <button 
        onClick={() => expressInterest(c.anonymous_id)}
        className="mt-4 btn-primary"
      >
        Express Interest →
      </button>
    </div>
  ))}
</div>
```

---

## Business Model (Optional)

```
Free Tier:
- Candidates: Free forever
- Companies: Browse 10 profiles/month

Premium:
- Companies: Unlimited browsing, priority matching
- $X per successful hire (placement fee)
```

---

## Legal Considerations

- [ ] Terms of Service update for network participation
- [ ] Privacy policy update explaining data sharing
- [ ] GDPR compliance (right to access, delete, export)
- [ ] Obtain explicit consent for each data type shared
- [ ] Age restrictions (18+)
- [ ] Clear disclosure that this is opt-in only

---

## Implementation Checklist

- [ ] Add talent network tables to schema
- [ ] Build candidate opt-in flow
- [ ] Create visibility controls UI
- [ ] Build aggregation logic
- [ ] Create company browse/filter UI
- [ ] Implement interest expression flow
- [ ] Build matching system
- [ ] Add GDPR compliance (export, delete)
- [ ] Legal review
- [ ] Launch as beta with select companies

---

## Summary

| Feature | Status |
|---------|--------|
| Phase 1: Candidate Feedback | Quick Win |
| Phase 2: Skills Gap Dashboard | Quick Win |
| Phase 3: Warm-Up Mode | Quick Win |
| Phase 4: Interviewer Calibration | Core |
| Phase 5: Predictive Success | Core |
| Phase 6: Manager Accountability | Platform |
| Phase 7: Cross-Company Talent Pool | Revolutionary |
