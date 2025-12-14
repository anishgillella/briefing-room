# Phase 6: Hiring Manager Accountability Dashboard

Track each hiring manager's funnel metrics to identify bottlenecks and improve hiring efficiency.

## Problem Statement

- Some managers never hire (too picky) → roles unfilled for months
- Some managers hire too fast (rubber stamp) → poor quality hires
- No visibility into individual manager performance
- Hiring goals not tracked against actual hires

## Solution

Dashboard showing each manager's hiring funnel, time metrics, and comparison to team averages.

---

## Manager Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HIRING MANAGER DASHBOARD: John Smith (Engineering)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📊 HIRING FUNNEL (Last 90 Days)                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Reviewed  →  Interviewed  →  Offered  →  Hired                   │ │
│  │    45           18              2           1                      │ │
│  │   100%         40%            4.4%        2.2%                    │ │
│  │              (team avg: 50%) (team avg: 8%) ⚠️ Low                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ⏱️ TIMING METRICS                                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Time to first interview: 6 days (team avg: 4 days)               │ │
│  │  Time in pipeline: 34 days (team avg: 21 days) ⚠️ Slow            │ │
│  │  Interview rounds per hire: 4.5 (team avg: 3.2) ⚠️ Too many       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  📈 QUALITY METRICS                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Hired candidates' 6mo rating: 4.2/5 (team avg: 3.8) ✅ Good       │ │
│  │  Hired candidates' retention: 92% (team avg: 85%) ✅ Good          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ⚠️ RECOMMENDATIONS                                                     │
│  • Your offer rate (4.4%) is below team average (8%). Consider         │
│    reviewing rejection reasons with HR.                                  │
│  • Candidates spend 34 days in pipeline vs. 21 avg. Consider faster    │
│    decision-making or dropping a round.                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Hiring managers
CREATE TABLE hiring_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    department TEXT,
    team TEXT,
    
    -- Cached metrics (updated daily)
    total_candidates_reviewed INT DEFAULT 0,
    total_interviews_conducted INT DEFAULT 0,
    total_offers_made INT DEFAULT 0,
    total_hires INT DEFAULT 0,
    
    interview_to_offer_rate FLOAT,
    offer_to_hire_rate FLOAT,
    avg_time_to_first_interview_days FLOAT,
    avg_time_in_pipeline_days FLOAT,
    avg_interviews_per_candidate FLOAT,
    
    -- Quality (from employee outcomes)
    avg_hire_performance_score FLOAT,
    hire_retention_rate FLOAT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team/department averages for comparison
CREATE TABLE team_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    avg_interview_rate FLOAT,
    avg_offer_rate FLOAT,
    avg_hire_rate FLOAT,
    avg_time_to_first_interview FLOAT,
    avg_time_in_pipeline FLOAT,
    avg_interviews_per_candidate FLOAT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link interviews to hiring managers
ALTER TABLE interviews ADD COLUMN hiring_manager_id UUID REFERENCES hiring_managers(id);
```

---

## Metrics Aggregation

```python
def calculate_manager_metrics(manager_id: str, days: int = 90) -> dict:
    """Calculate hiring metrics for a manager over a time period."""
    
    start_date = datetime.now() - timedelta(days=days)
    
    # Get all candidates this manager was involved with
    candidates = get_manager_candidates(manager_id, start_date)
    interviews = get_manager_interviews(manager_id, start_date)
    
    # Funnel metrics
    reviewed = len(candidates)
    interviewed = len(set(i.candidate_id for i in interviews))
    offered = len([c for c in candidates if c.pipeline_status == 'offer'])
    hired = len([c for c in candidates if c.final_decision == 'accepted'])
    
    # Rate calculations
    interview_rate = interviewed / reviewed if reviewed > 0 else 0
    offer_rate = offered / interviewed if interviewed > 0 else 0
    hire_rate = hired / offered if offered > 0 else 0
    
    # Timing metrics
    time_to_first_interview = mean([
        (i.started_at - c.created_at).days
        for c in candidates
        for i in c.interviews
        if i.stage == 'phone_screen' and i.started_at
    ]) if candidates else 0
    
    time_in_pipeline = mean([
        (c.decided_at - c.created_at).days
        for c in candidates
        if c.decided_at
    ]) if candidates else 0
    
    interviews_per_candidate = len(interviews) / interviewed if interviewed > 0 else 0
    
    # Quality metrics (from outcomes)
    outcomes = get_hire_outcomes(manager_id)
    avg_performance = mean([o.review_6mo_score for o in outcomes]) if outcomes else None
    retention = len([o for o in outcomes if o.current_status == 'active']) / len(outcomes) if outcomes else None
    
    return {
        "funnel": {
            "reviewed": reviewed,
            "interviewed": interviewed,
            "offered": offered,
            "hired": hired,
            "interview_rate": interview_rate,
            "offer_rate": offer_rate,
            "hire_rate": hire_rate
        },
        "timing": {
            "time_to_first_interview": time_to_first_interview,
            "time_in_pipeline": time_in_pipeline,
            "interviews_per_candidate": interviews_per_candidate
        },
        "quality": {
            "avg_performance": avg_performance,
            "retention": retention
        }
    }
```

---

## Comparison to Benchmarks

```python
def compare_to_benchmark(manager_metrics: dict, team: str) -> dict:
    """Compare manager metrics to team benchmarks."""
    
    benchmark = get_team_benchmark(team)
    comparisons = {}
    
    # Funnel
    for metric in ["interview_rate", "offer_rate", "hire_rate"]:
        manager_val = manager_metrics["funnel"][metric]
        bench_val = getattr(benchmark, f"avg_{metric}")
        diff = (manager_val - bench_val) / bench_val if bench_val else 0
        
        comparisons[metric] = {
            "value": manager_val,
            "benchmark": bench_val,
            "difference": diff,
            "status": "good" if diff >= -0.2 else "warning" if diff >= -0.5 else "critical"
        }
    
    # Timing (lower is better)
    for metric in ["time_to_first_interview", "time_in_pipeline", "interviews_per_candidate"]:
        manager_val = manager_metrics["timing"][metric]
        bench_val = getattr(benchmark, f"avg_{metric}")
        diff = (manager_val - bench_val) / bench_val if bench_val else 0
        
        comparisons[metric] = {
            "value": manager_val,
            "benchmark": bench_val,
            "difference": diff,
            "status": "good" if diff <= 0.2 else "warning" if diff <= 0.5 else "critical"
        }
    
    return comparisons
```

---

## Recommendations Engine

```python
def generate_manager_recommendations(manager_id: str) -> List[str]:
    """Generate actionable recommendations for a hiring manager."""
    
    metrics = calculate_manager_metrics(manager_id)
    comparisons = compare_to_benchmark(metrics, get_manager_team(manager_id))
    recommendations = []
    
    # Low offer rate
    if comparisons["offer_rate"]["status"] in ["warning", "critical"]:
        recommendations.append(
            f"Your offer rate ({comparisons['offer_rate']['value']*100:.1f}%) is below "
            f"team average ({comparisons['offer_rate']['benchmark']*100:.1f}%). "
            f"Consider reviewing rejection criteria with HR."
        )
    
    # High time in pipeline
    if comparisons["time_in_pipeline"]["status"] in ["warning", "critical"]:
        recommendations.append(
            f"Candidates spend {metrics['timing']['time_in_pipeline']:.0f} days in your pipeline "
            f"vs. {comparisons['time_in_pipeline']['benchmark']:.0f} team average. "
            f"Consider faster scheduling or reducing interview rounds."
        )
    
    # Too many interview rounds
    if comparisons["interviews_per_candidate"]["status"] in ["warning", "critical"]:
        recommendations.append(
            f"You average {metrics['timing']['interviews_per_candidate']:.1f} interviews per candidate "
            f"vs. {comparisons['interviews_per_candidate']['benchmark']:.1f} team average. "
            f"Consider consolidating rounds or panel interviews."
        )
    
    return recommendations
```

---

## Frontend Dashboard

```tsx
// Manager Accountability Dashboard
const ManagerDashboard = ({ managerId }) => {
  const { metrics, comparisons, recommendations } = useManagerMetrics(managerId);
  
  return (
    <div className="space-y-6">
      {/* Funnel */}
      <div className="glass-panel rounded-3xl p-6">
        <h3 className="text-white/60 text-sm uppercase mb-4">Hiring Funnel (90 Days)</h3>
        <div className="flex items-center justify-between">
          {['reviewed', 'interviewed', 'offered', 'hired'].map((stage, i) => (
            <React.Fragment key={stage}>
              <div className="text-center flex-1">
                <div className="text-3xl font-light text-white">
                  {metrics.funnel[stage]}
                </div>
                <div className="text-sm text-white/60 capitalize">{stage}</div>
                {comparisons[`${stage}_rate`] && (
                  <div className={`text-xs ${
                    comparisons[`${stage}_rate`].status === 'good' ? 'text-green-400' :
                    comparisons[`${stage}_rate`].status === 'warning' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {(comparisons[`${stage}_rate`].value * 100).toFixed(1)}%
                    {comparisons[`${stage}_rate`].status !== 'good' && ' ⚠️'}
                  </div>
                )}
              </div>
              {i < 3 && <ChevronRight className="w-6 h-6 text-white/30" />}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      {/* Timing Metrics */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { key: 'time_to_first_interview', label: 'Time to First Interview', unit: 'days' },
          { key: 'time_in_pipeline', label: 'Time in Pipeline', unit: 'days' },
          { key: 'interviews_per_candidate', label: 'Interviews per Hire', unit: '' }
        ].map(metric => (
          <div key={metric.key} className="glass-panel rounded-2xl p-4">
            <div className="text-white/60 text-xs uppercase mb-2">{metric.label}</div>
            <div className={`text-2xl font-light ${
              comparisons[metric.key].status === 'good' ? 'text-green-400' :
              comparisons[metric.key].status === 'warning' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {metrics.timing[metric.key].toFixed(1)}{metric.unit}
            </div>
            <div className="text-xs text-white/40">
              Team avg: {comparisons[metric.key].benchmark.toFixed(1)}{metric.unit}
            </div>
          </div>
        ))}
      </div>
      
      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="glass-panel rounded-3xl p-6 border-l-4 border-yellow-500/50">
          <h3 className="text-yellow-400 font-medium mb-3">Recommendations</h3>
          {recommendations.map((rec, i) => (
            <div key={i} className="text-white/80 text-sm mb-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              {rec}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## Admin Overview

HR/Leadership can see all managers:

```tsx
// All Managers Comparison
<table className="w-full">
  <thead>
    <tr className="text-white/60 text-xs uppercase">
      <th>Manager</th>
      <th>Team</th>
      <th>Reviewed</th>
      <th>Hired</th>
      <th>Hire Rate</th>
      <th>Avg Time</th>
      <th>Quality</th>
    </tr>
  </thead>
  <tbody>
    {managers.map(m => (
      <tr key={m.id} className="border-t border-white/10">
        <td className="py-3 text-white">{m.name}</td>
        <td className="text-white/60">{m.team}</td>
        <td>{m.total_candidates_reviewed}</td>
        <td>{m.total_hires}</td>
        <td className={getStatusColor(m.hire_rate_status)}>
          {(m.hire_rate * 100).toFixed(1)}%
        </td>
        <td className={getStatusColor(m.time_status)}>
          {m.avg_time_in_pipeline.toFixed(0)} days
        </td>
        <td className="text-green-400">{m.avg_hire_performance_score?.toFixed(1)}/5</td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## Implementation Checklist

- [ ] Add `hiring_managers` and `team_benchmarks` tables
- [ ] Create metrics aggregation functions
- [ ] Build comparison to benchmark logic
- [ ] Create recommendations engine
- [ ] Build manager dashboard UI
- [ ] Build admin overview UI
- [ ] Set up daily metrics refresh job
- [ ] Add notifications for critical status

---

## Next: [Phase 7 - Cross-Company Talent Pool](./phase7_talent_pool.md)
