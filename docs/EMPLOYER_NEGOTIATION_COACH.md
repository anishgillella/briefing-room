# Employer Negotiation Coach - Design Document

## Overview

A voice-based coaching feature that helps employers prepare for offer calls with candidates. After completing all 3 interview rounds, employers can receive personalized coaching on how to present offers, explain equity, handle negotiations, and close candidates.

---

## Feature Goals

1. **Increase offer acceptance rates** by preparing employers with candidate-specific insights
2. **Reduce negotiation friction** by anticipating candidate concerns and objections
3. **Provide market context** so offers are competitive and well-positioned
4. **Build employer confidence** through practice and preparation

---

## User Flow

```
Interview Round 1 → Interview Round 2 → Interview Round 3 → Offer Prep
       ↓                    ↓                    ↓              ↓
   Transcript           Transcript           Transcript    Coaching Session
   Analytics            Analytics            Analytics     Summary & Script
```

---

## Implementation Phases

### Phase 1: Transcript Paste Tab

**Goal:** Allow users to input interview transcripts manually (in addition to voice).

**Location:** New tab within existing interview page for each round.

**UI Components:**
- Tab bar addition: `[ Voice Interview ] [ Paste Transcript ] [ Analysis ] [ Transcript ]`
- Textarea with placeholder text explaining supported formats
- "Process Transcript" button
- Success/error feedback states

**Technical Implementation:**
- New component: `TranscriptPasteTab.tsx`
- API endpoint to save pasted transcript
- Transcript parsing logic to extract speaker turns
- Integration with existing `Transcript` model

**Files to Create/Modify:**
- `frontend/src/components/interview/TranscriptPasteTab.tsx` (new)
- `frontend/src/app/candidates/[id]/interview/page.tsx` (modify - add tab)
- `backend/routers/db_interviews.py` (modify - add paste endpoint)
- `backend/services/transcript_parser.py` (new - parse various formats)

**Acceptance Criteria:**
- [ ] User can paste plain text transcript
- [ ] System parses speaker labels (e.g., "John: Hello...")
- [ ] Transcript is saved to database
- [ ] UI switches to Analysis tab after processing
- [ ] Error handling for malformed transcripts

---

### Phase 2: Market Data Query

**Goal:** Fetch compensation benchmarks for the role/company using existing web search API.

**Data to Retrieve:**
- Salary ranges for similar roles at similar-stage companies
- Equity benchmarks (typical % for role level, vesting standards)
- Location-based adjustments
- Recent market trends

**Technical Implementation:**
- New method in `parallel_ai.py`: `research_compensation()`
- Search queries targeting Levels.fyi, Glassdoor, Blind, Carta
- LLM extraction to structure the data into usable format

**Files to Create/Modify:**
- `backend/services/parallel_ai.py` (modify - add research_compensation method)
- `backend/services/compensation_extractor.py` (new - extract structured comp data)
- `backend/models/compensation.py` (new - data models for comp data)

**Acceptance Criteria:**
- [ ] Can query market data for any role/location/stage combination
- [ ] Returns structured salary range (min, median, max, percentiles)
- [ ] Returns equity benchmarks
- [ ] Caches results to avoid redundant API calls
- [ ] Graceful fallback if data unavailable

---

### Phase 3: Offer Prep Page

**Goal:** Central page for reviewing candidate context and initiating coaching.

**Route:** `/candidates/[id]/offer-prep`

**UI Sections:**

#### Section 1: Candidate Intelligence Card
- What candidate values (extracted from transcripts)
- Key quotes from interviews
- Risk factors and concerns
- Close probability score

#### Section 2: Market Positioning Card
- Role/location/stage context
- Salary range visualization (bar showing where offer sits)
- Equity benchmark comparison
- Percentile indicator

#### Section 3: Your Offer Card
- Base salary
- Equity details
- Bonus/benefits
- Start date
(Input fields if not already in system)

#### Section 4: Start Coaching CTA
- Primary button to initiate voice session
- Duration estimate (~12 min)
- Brief description of what to expect

**Technical Implementation:**
- New page component with context aggregation
- API endpoint to fetch all required data
- State management for offer details input

**Files to Create/Modify:**
- `frontend/src/app/candidates/[id]/offer-prep/page.tsx` (new)
- `frontend/src/components/offer-prep/CandidateIntelligenceCard.tsx` (new)
- `frontend/src/components/offer-prep/MarketPositioningCard.tsx` (new)
- `frontend/src/components/offer-prep/OfferDetailsCard.tsx` (new)
- `frontend/src/components/offer-prep/CoachingSessionPanel.tsx` (new)
- `backend/routers/offer_prep.py` (new - API endpoints)
- `backend/services/candidate_intelligence.py` (new - aggregate candidate insights)

**Acceptance Criteria:**
- [ ] Page loads with all candidate context
- [ ] Market data displays correctly
- [ ] User can input/edit offer details
- [ ] Close probability calculates from available data
- [ ] "Start Coaching" button initiates voice session

---

### Phase 4: Coaching VAPI Assistant

**Goal:** Create voice agent that coaches employers on offer presentation.

**Agent Capabilities:**
1. Review candidate insights and priorities
2. Explain how to position the offer
3. Coach on equity explanation (tailored to candidate sophistication)
4. Discuss salary strategy and negotiation room
5. Anticipate objections and prepare responses
6. Optional role-play practice

**System Prompt Structure:**
```
You are an expert negotiation coach helping an employer prepare for an offer call.

CANDIDATE CONTEXT:
{candidate_name}
{role_title}
{priorities_from_interviews}
{key_quotes}
{risk_factors}
{competing_offers}

MARKET DATA:
{salary_range}
{equity_benchmarks}
{percentile_position}

OFFER DETAILS:
{base_salary}
{equity_package}
{benefits}

YOUR ROLE:
- Help the employer understand what matters most to this candidate
- Coach them on how to present the offer compellingly
- Prepare them for likely questions and objections
- Optionally role-play as the candidate for practice
- Keep the session focused and actionable (~12 minutes)
```

**Technical Implementation:**
- New VAPI assistant configuration
- Dynamic system prompt builder with context injection
- WebSocket integration for real-time transcript
- Session state management

**Files to Create/Modify:**
- `backend/services/coaching_agent.py` (new - coaching logic and prompt builder)
- `backend/routers/coaching.py` (new - API endpoints for coaching session)
- `frontend/src/components/offer-prep/CoachingVoiceInterface.tsx` (new)
- `frontend/src/hooks/useCoachingSession.ts` (new)

**Acceptance Criteria:**
- [ ] VAPI assistant created with coaching persona
- [ ] System prompt dynamically populated with context
- [ ] Voice session works end-to-end
- [ ] Real-time transcript displays in UI
- [ ] Session can be ended gracefully

---

### Phase 5: Post-Coaching Summary

**Goal:** Generate and save actionable output after coaching session.

**Summary Components:**

#### Offer Script
- Personalized opening
- Equity explanation talking points
- Handling specific competitor comparisons
- Closing statement

#### Key Reminders
- Top 3-5 things to remember
- Candidate-specific tips
- What to emphasize, what to avoid

#### Objection Responses
- Anticipated objections based on interviews
- Suggested responses for each
- Negotiation boundaries

**Technical Implementation:**
- LLM-based summary generation from coaching transcript
- Storage in database linked to candidate
- UI component to display and interact with summary

**Files to Create/Modify:**
- `backend/services/coaching_summary.py` (new - generate summary from transcript)
- `backend/models/coaching_summary.py` (new - data model)
- `backend/routers/coaching.py` (modify - add summary endpoint)
- `frontend/src/components/offer-prep/CoachingSummary.tsx` (new)
- Database migration for coaching_summaries table

**Acceptance Criteria:**
- [ ] Summary generates automatically when session ends
- [ ] Offer script is personalized and actionable
- [ ] Objection responses are specific to candidate
- [ ] User can copy script to clipboard
- [ ] User can re-do coaching if needed
- [ ] Summary persists and is accessible later

---

### Phase 6: Stage Indicator & Candidate Page Card

**Goal:** Integrate offer prep into the candidate journey UI.

**Stage Indicator Enhancement:**
- Show 4th stage "Offer Prep" after Round 3 completes
- Visual progression: `○ R1 ── ○ R2 ── ○ R3 ── ◉ Offer Prep`
- Pulse animation when offer prep is unlocked

**Candidate Detail Page Card:**
- New card appears when all 3 rounds complete
- Shows close probability
- Primary CTA: "Prepare for Offer Call"
- Links to offer prep page

**Technical Implementation:**
- Modify stage indicator component
- Add conditional card to candidate detail page
- Logic to determine when all rounds complete

**Files to Create/Modify:**
- `frontend/src/components/candidates/StageIndicator.tsx` (new or modify existing)
- `frontend/src/app/candidates/[id]/page.tsx` (modify - add offer prep card)
- `frontend/src/components/candidates/OfferPrepCard.tsx` (new)

**Acceptance Criteria:**
- [ ] 4th stage appears only after Round 3 completes
- [ ] Stage indicator shows correct state for each stage
- [ ] Offer prep card displays close probability
- [ ] Card links to offer prep page
- [ ] Animations follow existing design patterns

---

## Data Models

### CompensationData
```python
class CompensationData(BaseModel):
    role_title: str
    location: str
    company_stage: str
    salary_min: int
    salary_median: int
    salary_max: int
    salary_percentile_25: int
    salary_percentile_75: int
    equity_min_percent: float
    equity_max_percent: float
    equity_typical_percent: float
    vesting_standard: str  # e.g., "4 years with 1 year cliff"
    data_sources: List[str]
    retrieved_at: datetime
```

### CandidateIntelligence
```python
class CandidateIntelligence(BaseModel):
    candidate_id: str
    priorities: List[CandidatePriority]  # {name, importance, evidence}
    key_quotes: List[KeyQuote]  # {text, round, context}
    risk_factors: List[RiskFactor]  # {description, severity, source}
    competing_offers: List[str]
    close_probability: float
    decision_timeline: Optional[str]
    generated_at: datetime
```

### CoachingSummary
```python
class CoachingSummary(BaseModel):
    id: str
    candidate_id: str
    session_transcript: str
    offer_script: OfferScript  # {opening, equity_explanation, competitor_handling, closing}
    key_reminders: List[str]
    objection_responses: List[ObjectionResponse]  # {objection, response}
    created_at: datetime
```

---

## API Endpoints

### Offer Prep
- `GET /api/offer-prep/{candidate_id}/context` - Fetch all context for offer prep
- `POST /api/offer-prep/{candidate_id}/offer-details` - Save offer details
- `GET /api/offer-prep/{candidate_id}/market-data` - Fetch compensation benchmarks

### Coaching
- `POST /api/coaching/{candidate_id}/start` - Start coaching session
- `POST /api/coaching/{candidate_id}/end` - End session and generate summary
- `GET /api/coaching/{candidate_id}/summary` - Fetch saved summary

### Transcripts
- `POST /api/interviews/{interview_id}/paste-transcript` - Save pasted transcript

---

## Design System Compliance

All new components will follow existing patterns:

- **Colors:** Purple primary (#8b5cf6), cyan accent (#22d3ee), dark background (#000)
- **Glass effects:** `bg-white/5`, `border-white/10`, `backdrop-blur-xl`
- **Border radius:** `rounded-2xl` for cards, `rounded-xl` for inputs
- **Typography:** Inter font, white text with opacity variants
- **Animations:** `animate-fade-in`, `animate-pulse`, `animate-scale-in`
- **Spacing:** 4-6 unit gaps, consistent padding

---

## Dependencies

- Existing: VAPI, Parallel.ai, LiveKit, Supabase
- No new external services required

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Market data may be incomplete | Graceful fallback with "data unavailable" state |
| Transcript parsing may fail | Support multiple formats, show clear error messages |
| Coaching session too long | Timer and gentle prompts to wrap up |
| VAPI rate limits | Queue sessions if needed |

---

## Success Metrics

- Offer acceptance rate improvement
- Time from final interview to offer
- User satisfaction with coaching quality
- Coaching session completion rate

---

## Timeline

Phases are independent and can be implemented sequentially. Each phase should be fully functional before moving to the next.

**Implementation Order:**
1. Phase 1: Transcript Paste Tab
2. Phase 2: Market Data Query
3. Phase 3: Offer Prep Page
4. Phase 4: Coaching VAPI Assistant
5. Phase 5: Post-Coaching Summary
6. Phase 6: Stage Indicator & Card

---

## Appendix: UI Mockups

See detailed ASCII mockups in the conversation thread above, including:
- Offer Prep Page layout
- Transcript Paste Tab
- Coaching Session interface
- Post-Coaching Summary display
- Candidate Page integration
