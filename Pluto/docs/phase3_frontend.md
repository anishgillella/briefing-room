# Phase 3: Premium Frontend ("Steve Jobs Edition")

**Goal:** Create a visual experience that feels like a Apple Keynote presentation.
**Stack:** Next.js 15, Tailwind CSS, Framer Motion, shadcn/ui

---

## 🛠️ Implementation Specs

### 1. Design System
- **Theme:** Dark Mode Only (Premium SaaS aesthetic).
- **Backgrounds:** Deep charcoals (`#0a0a0a`) with subtle animated gradients.
- **Cards:** Glassmorphism (`backdrop-blur-xl`, thin borders).

### 2. Core Features (The "Wow" Factors)

#### 🎥 Live Ranking Board (`/`)
- **Entry Animation:** Columns stagger fade-in up.
- **Score Counters:** Numbers scroll up (00 → 92) like a slot machine or odometer on load.
- **Hover Effects:** Cards lift and glow slightly.

#### 🧠 AI Co-Pilot (Floating Widget)
- Determine if we want to hit the backend or just use pre-computed reasons.
- **Simplest "Jobs" approach:** Use the comprehensive reasoning generated in Phase 2 as the context.
- Comparison Mode: Select two candidates to see a diff view (Green vs Red comparisons).

#### 🎬 Career Timeline Component (`/candidate/[id]`)
- Visualization of their path:
  `[Startup (Founder) 2y] --- [Scaleup (VP) 3y] --- [Enterprise (AE) 1y]`
- Use a horizontal timeline with icons.

### 3. Data Integration
- Import `ranked_candidates.json` directly.
- Treat it as a static database (SSG or Server Components).

---

## ✅ Do's
- **DO** use **Framer Motion** for everything. `layoutId` props for smooth shared element transitions between list and detail view.
- **DO** focus on typography. Use `Inter` for UI and `JetBrains Mono` for data/scores.
- **DO** implement a "Compare" drawer that slides up from the bottom.

## ❌ Don'ts
- **DON'T** use default browser alerts or unstyled inputs. Everything must be custom and polished.
- **DON'T** make it look like a spreadsheet. It should look like a Dashboard.
- **DON'T** use extensive client-side data fetching logic. We have a pre-computed JSON dataset—use it for instant loads!
