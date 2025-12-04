# Briefing Room

An AI agent that briefs interviewers before candidates arrive, then vanishes the instant they join.

---

## The Insight

The 5 minutes before an interview are valuable and often wasted. The interviewer walks in cold. The candidate is a PDF they skimmed.

Let's make those minutes collaborative, calm, and effective.

---

## Core Pillars

We care about both preparation and outcomes.

### The Agent

The agent should feel like a teammate, not an assistant. The instant the candidate joins, the agent is gone.

### The Debrief

Most startups don't write debriefs. Ending the call should produce an artifact that can be shared, summarizing the call and recommending next steps with evidence.

---

## Requirements

- A video call that two people can join: the interviewer and the candidate
- The agent joins but is only visible and audible to the interviewer
- The agent leaves the moment the candidate joins
- **Optional**: the agent can remain available to the interviewer during the call in any way you wish
- Ending the call produces an artifact that could be shared with a colleague, summarizing the call and recommending next steps

---

## Evaluation Criteria

We're measuring:

- **Robustness** — Does it work reliably?
- **Delightfulness** — Is it pleasant to use?
- **Utility** — Does it solve the problem?
- **Creativity** — What unique touches did you add?

---

## Suggested Tech Stack

Feel free to deviate based on your expertise:

- **App**: Next.js
- **Video**: [Daily.co](https://daily.co)
- **Voice**: [Vapi](https://vapi.ai)
- **Persistence**: Supabase (if needed)

Ship what works.

---

## Deliverables

1. **Repository** — Share a repo with your implementation
2. **Demo Video** — A ~5 minute Loom showing the full flow and explaining design choices
3. **README** — Include:
   - Setup instructions (should take ~10 minutes)
   - Required environment variables
   - Tradeoffs you made
   - What you'd do with 2 more days

---

## Setup

<!-- Add your setup instructions here -->

### Prerequisites

```bash
# List required tools/versions
```

### Installation

```bash
# Installation steps
```

### Environment Variables

```bash
# Required environment variables
```

### Running Locally

```bash
# Commands to run the project
```

---

## Design Decisions & Tradeoffs

<!-- Document your key decisions and tradeoffs here -->

---

## Future Improvements

<!-- What you'd do with 2 more days -->

---

## Notes

- **API Costs**: We'll cover any SDK or API costs. Ask us if you need keys.
- **Peace of Mind**: This is not intended to be real work for our existing product. To give you peace of mind, we will happily pay you a day rate of your choosing if we do want to merge it in.

---

## Philosophy

This is a canvas, not a checklist. Show us how you scope. Show us how you ship.

This is a bare-bones spec with freedom to add features. It mirrors how we work at Superposition: we want to see how you scope and ship.
