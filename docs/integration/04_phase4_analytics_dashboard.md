# Phase 4: Analytics Dashboard

## Goal
Build a reporting dashboard for hiring managers to track pipeline health and candidate metrics.

---

## 4.1 Dashboard Views

### Pipeline Overview
- Candidates by status (funnel view)
- Conversion rates: Uploaded → Scored → Interviewed → Hired
- Average time in each stage

### Candidate Leaderboard
- Top candidates by combined score
- Filter by: JD, date range, interview status
- Drill-down to individual profiles

### Interview Insights
- Average interview duration
- Common strengths/weaknesses across candidates
- AI recommendation distribution

---

## 4.2 Aggregation Queries

### Pipeline Metrics
```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(final_score) as avg_score
FROM candidates
WHERE job_description_id = :jd_id
GROUP BY status;
```

### Interview Performance
```sql
SELECT 
  c.name,
  i.duration_minutes,
  a.overall_score,
  a.recommendation
FROM candidates c
JOIN interviews i ON c.id = i.candidate_id
JOIN analytics a ON i.id = a.interview_id
WHERE i.status = 'completed';
```

---

## 4.3 Endpoints

```python
GET /api/analytics/pipeline/{jd_id}
GET /api/analytics/leaderboard
GET /api/analytics/interview-insights
GET /api/analytics/export/csv
```

---

## 4.4 Frontend Components

| Component | Description |
|-----------|-------------|
| `PipelineFunnel` | Visual funnel chart |
| `LeaderboardTable` | Sortable candidate table |
| `InsightsCards` | Summary stat cards |
| `TrendChart` | Time-series of hires |

---

## Success Criteria

- [ ] Pipeline funnel displays correctly
- [ ] Leaderboard shows top candidates
- [ ] Can filter by JD and date range
- [ ] CSV export works
- [ ] Performance < 500ms for dashboard load
