# Talentpluto Technical Assessment

## Overview
We're building an AI-powered talent marketplace that connects companies with exceptional professionals. A core challenge we face is intelligently matching candidates to job opportunities based on multiple criteria.

## Challenge
Your task is to build a matching algorithm that ranks real candidate profiles against a job description and explains why each candidate is (or isn't) a good fit. You are provided with ~20 candidates with detailed information.

**Goal:** Match and rank the candidates to the best of your abilities. You are heavily encouraged to use AI as you see fit.

## Requirements
Build a simple web page that:
- Scores each candidate from **0-100** based on their fit for the role.
- Ranks candidates from **best to worst** match.
- Provides **clear reasoning** for each score.
- Handles **edge cases and missing data** gracefully.

### Tech Stack
- **Preferred:** Next.js, React, and TypeScript.
- *Note:* You are welcome to use your preferred tech stack if you do not have experience with ours.

## Deliverables
1. **Source Code:** Email a zip file to `tony@talentpluto.com` with a quick summary (can be in a README.md file).
2. **Ranked Output:** A JSON file containing your ranked candidates.

We will set up a call afterwards to discuss your approach/process.

---

## Reference: Job Description
**Role:** Founding Account Executive (AE) – AI SaaS Marketplace

### About the Company
We are an innovative, AI-powered SaaS marketplace revolutionizing how go-to-market teams connect and grow. Backed by top investors and experiencing rapid growth, our team is cash flow positive and on track to triple in size this year.

### Key Responsibilities
- Own the full sales cycle: prospecting, qualifying, presenting, and closing deals with mid-market and enterprise clients.
- Engage with finance and accounting leaders (CFOs, Controllers, etc.) to understand their needs and deliver tailored solutions.
- Drive inbound and outbound sales calls, converting leads into long-term customers.
- Represent the company at industry events and conferences as needed.
- Collaborate closely with founders and cross-functional teams to refine sales processes and go-to-market strategy.

### Required Qualifications
- **Experience:** 1+ years of closing experience as an Account Executive, ideally in SaaS, fintech, or recruiting tech.
- **Target Audience:** Proven track record of selling to finance and accounting stakeholders (CFOs, Controllers, etc.).
- **Skills:** Exceptional communication, relationship-building, and consultative selling skills.
- **Mindset:** Demonstrated drive, ambition, and hunger to succeed in a fast-paced startup environment.
- **Autonomy:** Ability to thrive with minimal structure and proactively solve problems.
- **Travel:** Willingness to travel occasionally for events or client meetings.

### Preferred Qualifications
- 2+ years of closing experience as an Account Executive.
- Background in finance, accounting, or fintech sales.
- Experience selling to similar ICPs (finance leaders, payroll, fintech, SaaS).
- Startup experience and demonstrated scrappiness/hustle.
- Degree in finance or related field.

### Benefits & Perks
- Competitive base salary plus uncapped commission (typical OTE $180K–$200K).
- Health insurance coverage.
- Flexible remote work options.
- Professional development and growth opportunities.
- Collaborative, high-impact team environment.

## Engineering Challenges

During the development of Pluto, we encountered and overcame several significant technical and UX challenges:

### 1. Dynamic Extraction Schema ("JD Compiler")
**Challenge:** Job descriptions vary wildly. Hardcoding extraction fields (e.g., "SaaS Experience") works for one role but fails for another (e.g., "Python Skills").
**Solution:** We built a "JD Compiler" step. An LLM first analyzes the JD to generate a *suggested* schema (JSON). The user can then review and edit these fields in the UI before candidates are processed. This required a dynamic backend pipeline that could accept an arbitrary list of extraction targets.

### 2. Latency & Two-Step Processing
**Challenge:** Scoring 20+ candidates with a sophisticated LLM chain (Extraction -> Evaluation -> Ranking) takes time (1-2 minutes). Users might think the app froze.
**Solution:** We split the pipeline into two distinct phases:
1.  **Extraction (Fast):** Quickly parses the CSV and extracts raw data (Experience, Title, Skills). Results appear almost instantly in a table.
2.  **Scoring (Deep):** A manual "Start AI Scoring" trigger initiates the deeper evaluation. We implemented a polling mechanism to update the UI in real-time as each candidate is scored, keeping the user engaged with progress bars and incremental updates.

### 3. Data Quality & "Empty State" Handling
**Challenge:** Some resume summaries in the provided dataset were extremely sparse or missing. Initially, this resulted in empty "Final Cards" and summaries, breaking the UI.
**Solution:** We implemented "Robust Inference" in the prompt engineering. We instructed the LLM to infer a summary from the *Job Title* and *Years of Experience* if the *Bio* was insufficient. We also added frontend fallbacks to display "Evaluation pending" instead of broken layouts.

### 4. Type Safety with Dynamic Data
**Challenge:** TypeScript enforces strict schemas, but our "JD Compiler" feature introduced dynamic fields (custom user-defined criteria) that technically didn't exist in our compile-time interfaces.
**Solution:** We utilized flexible interfaces (e.g., `Record<string, unknown>`) and robust runtime checks. We also synced the `Status` and `Candidate` interfaces carefully to ensure that dynamic fields extracted by the backend were correctly typed and rendered in the frontend grid without causing build errors.

### 5. Complex State Management
**Challenge:** Managing the transition between "Landing" -> "Upload" -> "Configure" -> "Processing" -> "Scoring" -> "Results" within a single page application became complex.
**Solution:** We consolidated state into a robust `Status` object and a finite state machine pattern in `page.tsx`. This ensured that the UI always correctly reflected the backend's state, specifically handling the "Waiting for Confirmation" intermediate state unique to our two-step process.

### 6. Frontend-Backend Data Serialization
**Challenge:** Sending complex objects (like our list of `ExtractionField` objects) from a React frontend to a FastAPI backend via `FormData` proved tricky. Pydantic does not automatically parse JSON strings embedded in form fields, leading to 422 Validation Errors.
**Solution:** We had to explicitly stringify the JSON payload on the frontend (`JSON.stringify(extractionFields)`) and then manually parse it on the backend using `json.loads` within the endpoint logic, rather than relying on FastAPI's automatic dependency injection for that specific field. This required careful coordination between the `FormData` construction and the Pydantic model definitions.