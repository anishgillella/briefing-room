# Design Decisions & Trade-offs

This document captures key architectural and design decisions made during development.

---

## 1. Dual Scoring System (Algo + AI)

**Decision:** Use both algorithmic scoring (0-100) and AI evaluation (0-100), averaged for final score.

**Trade-offs:**
| Approach | Pros | Cons |
|----------|------|------|
| Algo only | Instant, deterministic, cheap | Misses nuanced signals |
| AI only | Rich reasoning, handles edge cases | Slow, expensive, non-deterministic |
| **Dual (chosen)** | Best of both, transparent breakdown | More complex, 2x scoring logic |

**Rationale:** Algo catches objective criteria (years exp, ACV), AI catches subjective signals (culture fit, red flags). Simple average = transparent, no "black box" weighting.

---

## 2. Model Selection

**Decision:** 
- Extraction: `google/gemini-2.5-flash` 
- Scoring: `openai/gpt-5-mini`

**Trade-offs:**
| Model | Speed | Cost | Quality |
|-------|-------|------|---------|
| Gemini Flash | ⚡ Very fast (~1s) | 💰 Very cheap | ✅ Good for extraction |
| GPT-5-mini | 🐢 Slower (~10s) | 💰💰 Moderate | ✅ Better reasoning |
| GPT-4o | 🐢🐢 Slowest | 💰💰💰 Expensive | ✅✅ Best quality |

**Rationale:** Extraction is structured data parsing (Flash sufficient). Scoring requires reasoning about candidate fit (GPT-5-mini worthwhile).

---

## 3. Streaming Pipeline Architecture

**Decision:** Process in small batches (5), stream results as they complete.

**Trade-offs:**
| Approach | First Result | Total Time | Complexity |
|----------|--------------|------------|------------|
| Sequential (all extract → all score) | ~70s | ~70s | Simple |
| **Streaming batches (chosen)** | ~10s | ~50s | Moderate |
| Fully parallel (all at once) | ~15s | ~15s | High + rate limits |

**Rationale:** Streaming provides best UX (early results) without hitting API rate limits. Batch size 5 balances parallelism vs. API quotas.

---

## 4. Progressive Loading UX

**Decision:** Show extracted data immediately while scoring runs in background.

**Implementation:**
1. Upload → Extraction (~12s) → **Show preview cards**
2. Scoring runs in background → Update cards with scores
3. Interview questions generated **on-demand** (lazy loading)

**Trade-offs:**
- ✅ User sees meaningful data in ~12s instead of 70s
- ✅ Perceived performance vastly improved
- ❌ Slightly more complex frontend state management

---

## 5. Interview Questions: Eager vs Lazy

**Decision:** Generate interview questions during scoring (eager), but could switch to on-demand.

**Trade-offs:**
| Approach | Speed | UX | API Calls |
|----------|-------|-----|-----------|
| Eager (current) | Slower initial load | Questions ready when needed | 2x per candidate |
| **Lazy (recommended)** | Faster initial load | Brief delay on click | 1 per candidate clicked |

**Future optimization:** Switch to lazy loading to reduce initial scoring time by ~50%.

---

## 6. Pydantic for All LLM Outputs

**Decision:** Strict Pydantic models for all LLM responses.

**Trade-offs:**
- ✅ Type safety, validation, clear contracts
- ✅ Catches malformed responses immediately
- ✅ Self-documenting API
- ❌ Slightly more boilerplate code

**Rationale:** LLM outputs are unpredictable. Pydantic catches errors before they propagate downstream.

---

## 7. Data Preservation Strategy

**Decision:** Preserve all original CSV columns, fill missing values in-place, add new extracted columns.

**Trade-offs:**
- ✅ Original data untouched (can always reference)
- ✅ No data loss
- ❌ Larger output files

**Implementation:** 
- Original column empty? → Fill with extracted value
- Original has data? → Keep original
- New semantic fields → Add as new columns

---

## 8. Red Flag Detection

**Decision:** Integrate red flag detection into extraction phase, not as separate pass.

**Trade-offs:**
- ✅ Single LLM call handles both extraction + red flags
- ✅ Context available for better red flag detection
- ❌ Slightly larger prompt

**Red flags detected:**
- Job hopping (avg tenure < 18 months)
- Title inflation
- Employment gaps > 6 months
- Overqualified (expects > $200k OTE)

---

## 9. Bio Summary in First Person

**Decision:** Generate bio summaries in first person ("I am...", "I have...").

**Rationale:** Reads more naturally in candidate profiles, feels more personal, better for potential candidate-facing applications.

---

## 10. Batch Size: 5 vs 10 vs 20

**Decision:** Batch size of 5 for optimal streaming UX.

**Analysis:**
| Batch Size | Batches for 21 candidates | First visible | Rate limit risk |
|------------|---------------------------|---------------|-----------------|
| 5 | 5 batches | ~5s | Low |
| 10 | 3 batches | ~8s | Medium |
| 20 | 2 batches | ~15s | High |

**Rationale:** Smaller batches = faster first results = better perceived performance.

---

## 11. API Provider: OpenRouter

**Decision:** Use OpenRouter as unified API gateway for multiple LLM providers.

**Trade-offs:**
- ✅ Single API key for Gemini, OpenAI, Anthropic, etc.
- ✅ Easy model switching without code changes
- ✅ Built-in fallback support
- ❌ Slight latency overhead (~50ms)
- ❌ Dependency on third-party service

---

## 12. Frontend Stack

**Decision:** Next.js 16 + Tailwind CSS + Custom glassmorphism theme.

**Trade-offs:**
- ✅ Modern React with App Router
- ✅ Fast development with Tailwind
- ✅ Premium dark theme with animations
- ❌ Tailwind v4 has some breaking changes from v3

---

## Summary

The key principle throughout: **optimize for user experience first**, then performance, then simplicity. Stream results early, show progress, keep the user engaged with tips while they wait.
