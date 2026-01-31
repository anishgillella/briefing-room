"""
Interviewer Analytics API Routes.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from repositories.manager_repository import get_manager_repository
from repositories.interviewer_analytics_repository import get_interviewer_analytics_repository
from services.interviewer_analyzer import get_interviewer_analyzer
from db.client import get_db

router = APIRouter(prefix="/api/interviewers", tags=["interviewers"])


@router.get("")
async def list_interviewers():
    """Get all interviewers (for dropdown). These are hiring managers with interviewer role."""
    repo = get_manager_repository()
    managers = repo.get_all()
    
    # Filter to those who can interview (role = 'interviewer' or 'both')
    interviewers = [m for m in managers if m.get("role") in ["interviewer", "both", None]]

    # Deduplicate by Name (since we have multiple IDs for same person in DB)
    unique_interviewers = []
    seen_names = set()
    for interviewer in interviewers:
        if interviewer["name"] not in seen_names:
            unique_interviewers.append(interviewer)
            seen_names.add(interviewer["name"])
    
    return {"interviewers": unique_interviewers}


@router.get("/analytics/team")
async def get_team_analytics():
    """Get analytics for ALL interviewers - team-wide view for managers.
    
    Optimized: Uses batch query to fetch all analytics in ONE query.
    """
    manager_repo = get_manager_repository()
    analytics_repo = get_interviewer_analytics_repository()
    
    managers = manager_repo.get_all()
    interviewers = [m for m in managers if m.get("role") in ["interviewer", "both", None]]
    
    if not interviewers:
        return {"team_averages": {}, "interviewers": []}
    
    # Batch fetch all metrics in ONE query instead of N queries
    interviewer_ids = [i["id"] for i in interviewers]
    metrics_map = analytics_repo.get_batch_aggregated_metrics(interviewer_ids)
    
    team_data = []
    team_totals = {
        "total_interviews": 0,
        "avg_question_quality": 0,
        "avg_topic_coverage": 0,
        "avg_consistency": 0,
        "avg_bias_score": 0,
        "avg_candidate_experience": 0,
        "avg_overall": 0
    }
    
    for interviewer in interviewers:
        metrics = metrics_map.get(interviewer["id"], {"total_interviews": 0})
        
        if metrics["total_interviews"] > 0:
            team_data.append({
                "interviewer": {
                    "id": interviewer["id"],
                    "name": interviewer["name"],
                    "team": interviewer.get("team"),
                    "department": interviewer.get("department")
                },
                "metrics": metrics
            })
            
            # Aggregate for team totals
            team_totals["total_interviews"] += metrics["total_interviews"]
    
    # Calculate team averages
    if team_data:
        n = len(team_data)
        team_totals["avg_question_quality"] = round(sum(d["metrics"]["avg_question_quality"] for d in team_data) / n, 1)
        team_totals["avg_topic_coverage"] = round(sum(d["metrics"]["avg_topic_coverage"] for d in team_data) / n, 1)
        team_totals["avg_consistency"] = round(sum(d["metrics"]["avg_consistency"] for d in team_data) / n, 1)
        team_totals["avg_bias_score"] = round(sum(d["metrics"]["avg_bias_score"] for d in team_data) / n, 1)
        team_totals["avg_candidate_experience"] = round(sum(d["metrics"]["avg_candidate_experience"] for d in team_data) / n, 1)
        team_totals["avg_overall"] = round(sum(d["metrics"]["avg_overall"] for d in team_data) / n, 1)
    
    return {
        "team_averages": team_totals,
        "interviewers": team_data
    }


@router.get("/{interviewer_id}")
async def get_interviewer(interviewer_id: str):
    """Get a single interviewer by ID."""
    repo = get_manager_repository()
    interviewer = repo.get_by_id(interviewer_id)
    if not interviewer:
        raise HTTPException(status_code=404, detail="Interviewer not found")
    return interviewer


@router.get("/{interviewer_id}/analytics")
async def get_interviewer_analytics(interviewer_id: str):
    """
    Get aggregated analytics for an interviewer.
    
    Enhanced with:
    - Team benchmarks (comparison to team average)
    - Trend data (recent vs older interviews)
    - Badges/achievements
    """
    manager_repo = get_manager_repository()
    analytics_repo = get_interviewer_analytics_repository()
    
    # Verify interviewer exists
    interviewer = manager_repo.get_by_id(interviewer_id)
    if not interviewer:
        raise HTTPException(status_code=404, detail="Interviewer not found")
    
    # Get aggregated metrics
    metrics = analytics_repo.get_aggregated_metrics(interviewer_id)
    
    # Get ALL individual analytics for trends and details
    all_analytics = analytics_repo.get_by_interviewer(interviewer_id, limit=50)
    
    # ==========================================================================
    # TEAM BENCHMARKS
    # ==========================================================================
    all_managers = manager_repo.get_all()
    all_interviewers = [m for m in all_managers if m.get("role") in ["interviewer", "both", None]]
    interviewer_ids = [i["id"] for i in all_interviewers if i["id"] != interviewer_id]
    
    # Get team averages
    team_metrics = analytics_repo.get_batch_aggregated_metrics(interviewer_ids)
    
    team_avg = {
        "avg_question_quality": 0,
        "avg_topic_coverage": 0,
        "avg_consistency": 0,
        "avg_bias_score": 0,
        "avg_candidate_experience": 0,
        "avg_overall": 0
    }
    
    valid_team = [m for m in team_metrics.values() if m.get("total_interviews", 0) > 0]
    if valid_team:
        n = len(valid_team)
        team_avg["avg_question_quality"] = round(sum(m["avg_question_quality"] for m in valid_team) / n, 1)
        team_avg["avg_topic_coverage"] = round(sum(m["avg_topic_coverage"] for m in valid_team) / n, 1)
        team_avg["avg_consistency"] = round(sum(m["avg_consistency"] for m in valid_team) / n, 1)
        team_avg["avg_bias_score"] = round(sum(m["avg_bias_score"] for m in valid_team) / n, 1)
        team_avg["avg_candidate_experience"] = round(sum(m["avg_candidate_experience"] for m in valid_team) / n, 1)
        team_avg["avg_overall"] = round(sum(m["avg_overall"] for m in valid_team) / n, 1)
    
    # Calculate benchmarks (difference from team average)
    benchmarks = {}
    if valid_team and metrics.get("total_interviews", 0) > 0:
        for key in ["avg_question_quality", "avg_topic_coverage", "avg_consistency", "avg_bias_score", "avg_candidate_experience", "avg_overall"]:
            diff = round(metrics.get(key, 0) - team_avg.get(key, 0), 1)
            # For bias, lower is better (inverted)
            is_better = diff > 0 if key != "avg_bias_score" else diff < 0
            benchmarks[key] = {
                "value": metrics.get(key, 0),
                "team_avg": team_avg.get(key, 0),
                "diff": diff,
                "is_better": is_better,
                "percentile": _calculate_percentile(metrics.get(key, 0), [m.get(key, 0) for m in valid_team], key == "avg_bias_score")
            }
    
    # ==========================================================================
    # TREND DATA (recent 5 vs previous interviews)
    # ==========================================================================
    trends = {}
    if len(all_analytics) >= 3:
        recent = all_analytics[:min(5, len(all_analytics))]
        older = all_analytics[5:] if len(all_analytics) > 5 else []
        
        if older:
            def avg_field(items, field):
                vals = [i.get(field, 0) for i in items if i.get(field) is not None]
                return sum(vals) / len(vals) if vals else 0
            
            for field in ["question_quality_score", "topic_coverage_score", "consistency_score", "bias_score", "candidate_experience_score", "overall_score"]:
                recent_avg = avg_field(recent, field)
                older_avg = avg_field(older, field)
                diff = recent_avg - older_avg
                # For bias, decrease is good
                improving = diff > 0 if field != "bias_score" else diff < 0
                
                trends[field] = {
                    "recent_avg": round(recent_avg, 1),
                    "older_avg": round(older_avg, 1),
                    "diff": round(diff, 1),
                    "improving": improving,
                    "direction": "improving" if improving else "declining" if abs(diff) > 2 else "stable"
                }
    
    # ==========================================================================
    # BADGES / ACHIEVEMENTS
    # ==========================================================================
    badges = []
    
    if metrics.get("total_interviews", 0) >= 5:
        # Consistency badge
        if metrics.get("avg_consistency", 0) >= 85:
            badges.append({
                "id": "consistent_performer",
                "name": "Consistent Performer",
                "icon": "🎯",
                "description": "Maintains high consistency across interviews"
            })
        
        # Low bias badge
        if metrics.get("avg_bias_score", 100) <= 15:
            badges.append({
                "id": "bias_free",
                "name": "Bias-Free",
                "icon": "⚖️",
                "description": "Demonstrates minimal bias in evaluations"
            })
        
        # High quality badge
        if metrics.get("avg_question_quality", 0) >= 85:
            badges.append({
                "id": "question_master",
                "name": "Question Master",
                "icon": "💡",
                "description": "Asks excellent, insightful questions"
            })
        
        # Candidate experience badge
        if metrics.get("avg_candidate_experience", 0) >= 85:
            badges.append({
                "id": "candidate_favorite",
                "name": "Candidate Favorite",
                "icon": "⭐",
                "description": "Creates positive candidate experiences"
            })
        
        # Improving performer
        if trends.get("overall_score", {}).get("direction") == "improving":
            badges.append({
                "id": "rising_star",
                "name": "Rising Star",
                "icon": "📈",
                "description": "Showing consistent improvement"
            })
        
        # Interview volume
        if metrics.get("total_interviews", 0) >= 20:
            badges.append({
                "id": "interview_veteran",
                "name": "Interview Veteran",
                "icon": "🏆",
                "description": "Conducted 20+ interviews"
            })
    
    # ==========================================================================
    # COACHING INSIGHTS
    # ==========================================================================
    coaching = []
    
    if metrics.get("total_interviews", 0) > 0:
        # Focus areas based on weakest scores
        scores = {
            "question_quality": metrics.get("avg_question_quality", 0),
            "topic_coverage": metrics.get("avg_topic_coverage", 0),
            "consistency": metrics.get("avg_consistency", 0),
            "candidate_experience": metrics.get("avg_candidate_experience", 0)
        }
        
        weakest = min(scores, key=scores.get)
        
        coaching_tips = {
            "question_quality": "Focus on asking more open-ended, probing questions that reveal depth of experience.",
            "topic_coverage": "Ensure all key competency areas are covered - technical, behavioral, cultural fit, and problem-solving.",
            "consistency": "Use a structured interview framework to maintain consistency across candidates.",
            "candidate_experience": "Allow more time for candidate questions and provide clearer next-step information."
        }
        
        if scores[weakest] < 80:
            coaching.append({
                "area": weakest.replace("_", " ").title(),
                "score": scores[weakest],
                "tip": coaching_tips[weakest]
            })
        
        # Bias coaching if needed
        if metrics.get("avg_bias_score", 0) > 25:
            coaching.append({
                "area": "Bias Awareness",
                "score": metrics.get("avg_bias_score", 0),
                "tip": "Review bias indicators and focus on objective, skills-based questioning."
            })
    
    return {
        "interviewer": {
            "id": interviewer_id,
            "name": interviewer.get("name"),
            "team": interviewer.get("team"),
            "department": interviewer.get("department")
        },
        "aggregated": metrics,
        "recent_interviews": all_analytics[:10],  # Most recent 10
        "benchmarks": benchmarks,
        "team_average": team_avg,
        "trends": trends,
        "badges": badges,
        "coaching": coaching
    }


def _calculate_percentile(value: float, all_values: list, inverted: bool = False) -> int:
    """Calculate percentile rank. For inverted metrics (bias), lower is better."""
    if not all_values:
        return 50
    
    if inverted:
        # For bias, count how many have HIGHER scores (worse)
        better_count = sum(1 for v in all_values if v > value)
    else:
        # For normal metrics, count how many have LOWER scores (worse)
        better_count = sum(1 for v in all_values if v < value)
    
    return round((better_count / len(all_values)) * 100)


@router.get("/{interviewer_id}/analytics/history")
async def get_interviewer_analytics_history(interviewer_id: str, limit: int = 20):
    """Get analytics history for an interviewer."""
    analytics_repo = get_interviewer_analytics_repository()
    history = analytics_repo.get_by_interviewer(interviewer_id, limit=limit)
    return {"history": history}


@router.get("/interviews/{interview_id}/analytics")
async def get_interview_analytics(interview_id: str):
    """Get interviewer analytics for a specific interview."""
    analytics_repo = get_interviewer_analytics_repository()
    analytics = analytics_repo.get_by_interview(interview_id)
    
    if not analytics:
        raise HTTPException(status_code=404, detail="Analytics not found for this interview")
    
    return {"analytics": analytics}


@router.post("/interviews/{interview_id}/analyze")
async def analyze_interview(interview_id: str, background_tasks: BackgroundTasks, force: bool = False):
    """Trigger LLM analysis for an interview. Runs in background.
    
    Args:
        force: If True, delete existing analytics and re-analyze
    """
    db = get_db()
    
    # Get interview
    result = db.table("interviews").select("*, transcripts(*)").eq("id", interview_id).single().execute()
    interview = result.data
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    interviewer_id = interview.get("interviewer_id")
    if not interviewer_id:
        raise HTTPException(status_code=400, detail="Interview has no interviewer assigned")
    
    # Check if already analyzed
    analytics_repo = get_interviewer_analytics_repository()
    existing = analytics_repo.get_by_interview(interview_id)
    
    if existing and not force:
        return {"status": "already_analyzed", "analytics": existing}
    
    # If forcing re-analysis, delete existing
    if existing and force:
        db.table("interviewer_analytics").delete().eq("interview_id", interview_id).execute()
    
    # Schedule background analysis
    background_tasks.add_task(
        _run_analysis,
        interview_id=interview_id,
        interviewer_id=interviewer_id,
        interview=interview
    )
    
    return {"status": "analysis_started", "interview_id": interview_id}


async def _run_analysis(interview_id: str, interviewer_id: str, interview: dict):
    """Background task to run LLM analysis."""
    import logging
    import re
    logger = logging.getLogger(__name__)
    
    try:
        # Extract transcript text - handle multiple formats
        transcripts = interview.get("transcripts") or []
        transcript_text = ""
        questions = []
        
        # Format 1: transcripts table with full_text field
        for t in transcripts:
            if t.get("full_text"):
                transcript_text = t.get("full_text", "")
                # Extract questions from interviewer turns
                if t.get("turns"):
                    for turn in t.get("turns", []):
                        role = turn.get("role", turn.get("speaker", ""))
                        text = turn.get("text", "")
                        if role.lower() == "interviewer" and "?" in text:
                            questions.append(text)
                break
        
        # Format 2: legacy format with speaker/text on each transcript entry
        if not transcript_text:
            for t in transcripts:
                speaker = t.get("speaker", t.get("role", "unknown"))
                text = t.get("text", "")
                if speaker.lower() == "interviewer":
                    transcript_text += f"Interviewer: {text}\n"
                    if "?" in text:
                        questions.append(text)
                else:
                    transcript_text += f"Candidate: {text}\n"
        
        if not transcript_text:
            logger.warning(f"No transcript found for interview {interview_id}")
            return
        
        # Extract questions from transcript_text if turns didn't yield any
        if not questions and transcript_text:
            # Pattern: "interviewer: ... ?" 
            pattern = r'interviewer:\s*([^:]+\?)'
            matches = re.findall(pattern, transcript_text, re.IGNORECASE)
            questions = matches[:20]  # Limit to 20 questions
        
        logger.info(f"Analyzing interview {interview_id}: {len(transcript_text)} chars, {len(questions)} questions")
        
        # Run analysis
        analyzer = get_interviewer_analyzer()
        result = await analyzer.analyze_interview(transcript_text, questions)
        
        # Save to database
        analytics_repo = get_interviewer_analytics_repository()
        analytics_repo.save_analytics(interview_id, interviewer_id, result)
        
        logger.info(f"Successfully analyzed interview {interview_id}. Score: {result.overall_score}")
        
    except Exception as e:
        logger.error(f"Failed to analyze interview {interview_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
