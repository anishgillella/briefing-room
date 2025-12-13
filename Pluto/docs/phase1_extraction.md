# Phase 1: Data Extraction & Enrichment

**Status:** ✅ COMPLETE
**Runtime:** ~12 seconds (21 candidates, 5 parallel batches)
**Output:** `backend/data/result.csv`

---

## Implementation Summary

### Stack
- Python 3.12
- `google/gemini-2.5-flash` via OpenRouter
- Pydantic for schema validation
- Async/await for parallel processing

### Key Files
- `backend/models.py` - Pydantic schemas
- `backend/config.py` - Environment configuration  
- `backend/extract_data.py` - Main pipeline

### How to Run
```bash
cd talentpluto
python -m backend.extract_data
```

---

## Output Schema (result.csv)

| Column | Type | Source |
|--------|------|--------|
| id | string | Row index |
| name | string | CSV/Enrichment |
| job_title | string | CSV/Enrichment |
| location_city | string | CSV/Enrichment |
| location_state | string | CSV/Enrichment |
| years_sales_experience | float | CSV |
| skills | string (pipe-separated) | Enrichment |
| bio_summary | string | **LLM** |
| sold_to_finance | bool | **LLM** |
| is_founder | bool | **LLM** |
| startup_experience | bool | **LLM** |
| enterprise_experience | bool | **LLM** |
| max_acv_mentioned | int | **LLM** |
| quota_attainment | float | **LLM** |
| industries | string (pipe-separated) | **LLM** |
| sales_methodologies | string (pipe-separated) | **LLM** |
| red_flag_job_hopping | bool | **LLM** |
| red_flag_title_inflation | bool | **LLM** |
| red_flag_gaps | bool | **LLM** |
| red_flag_overqualified | bool | **LLM** |
| red_flag_count | int | Computed |
| red_flag_concerns | string (pipe-separated) | **LLM** |

---

## Performance

- **21 candidates** processed
- **5 parallel batches** (batch size = 5)
- **~1 second per batch** (API latency)
- **Total time:** ~12 seconds
- **Cost:** ~$0.05 (Gemini 2.5 Flash is very cheap)

---

## Edge Cases Handled

✅ "Unknown User" → Replaced with actual name from enrichment
✅ Missing job titles → Pulled from current_employers
✅ NaN values → Safe type conversion with defaults
✅ JSON parsing errors → Graceful fallback
✅ API failures → Retry with backoff
