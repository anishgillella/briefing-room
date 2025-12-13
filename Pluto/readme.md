# Pluto Technical Assessment - Submission

Built by **Anish Gillella** for the Founding Account Executive matching challenge.

## 🚀 Quick Summary (Approach)

This solution goes beyond simple keyword matching by implementing a **Dual-Layer Deep Matching Engine** and a **Creative Voice Agent** extension.

### Core Solution
1.  **Dual-Layer Scoring System**:
    *   **Algorithmic Layer**: Deterministic scoring based on hard requirements (Finance Sales, Deal Size, Tenure).
    *   **AI Evaluation Layer**: Uses LLMs (`GPT-5-mini` / `Gemini 2.5`) to analyze qualitative signals like "startup hustle", "consultative approach", and "culture fit" from the bio.
2.  **Model Comparison**: The system allows running analysis with different models (e.g., Gemini vs GPT) and saves model-specific outcome files for comparison.

### 💡 Creative Solution (Bonus)
**AI Voice Screener**: To "handle missing data gracefully", I built an **Interactive Voice Agent** (using LiveKit).
*   If a candidate has gaps (e.g., missing quota attainment), the Recruiter can trigger a voice call.
*   The AI Agent interviews the candidate dynamically to fill those gaps.
*   Results update the candidate's profile in real-time.

---

## 📂 Deliverables & Output

The required JSON output is generated automatically after running the analysis.

**Output Location:**
*   Active Run (Frontend View): `backend/data/ranked_candidates.json`
*   Model-Specific Archive: `backend/data/ranked_candidates_openai_gpt_5_mini.json` (or `_google_gemini...`)

---

## 🛠 Tech Stack

*   **Frontend**: Next.js 14, TypeScript, Tailwind CSS (Glassmorphism UI)
*   **Backend**: Python, FastAPI, Pydantic
*   **AI**: OpenRouter (GPT-5-mini, Gemini 2.5 Flash)
*   **Voice**: LiveKit Real-time API

## 🏃‍♂️ How to Run

1.  **Setup Backend**:
    ```bash
    cd pluto
    pip install -r backend/requirements.txt
    cp .env.example .env  # Add OPENROUTER_API_KEY and LIVEKIT credentials
    ```

2.  **Start Services**:
    ```bash
    # Terminal 1: Backend
    python -m uvicorn backend.server:app --reload --port 8000

    # Terminal 2: Agent (for Voice Feature)
    python -m backend.livekit_agent dev
    
    # Terminal 3: Frontend
    cd frontend && npm run dev
    ```

3.  **View App**: Open `http://localhost:3000`

---

## 🧠 Scoring Logic Breakdown

We implemented a weighted scoring system based on the provided Job Description:

| Criteria | Weight | Logic |
|----------|--------|-------|
| **CFO/Finance Sales** | **Critical** | +25 pts. Must sell to Finance leaders. |
| **Experience** | High | 10 pts/year (capped at 30). |
| **Founder DNA** | High | +20 pts. Shows ownership/hustle. |
| **Startup Usage** | Medium | +10 pts. Scrappiness indicator. |
| **Deal Size** | Medium | +15 pts for >$100k ACV. |
| **Red Flags** | Penalty | -5 pts per flag (job hopping, etc). |

The **Combined Score** = `(Algorithmic Score + AI Evaluation Score) / 2`.

---

## 🎨 Design Decisions

*   **Why Dual Scoring?** Algorithmic ensures we don't miss hard requirements, while AI catches the specific "vibe" and qualitative skills requested in the JD.
*   **Why Voice Agent?** Resumes are often incomplete. Instead of discarding partial matches, the agent actively fills data gaps.
*   **Why GPT-5-mini?** Selected for high reasoning capability at low latency for real-time scoring.

