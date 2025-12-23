"""
Analytics repository for database operations.
"""
from typing import Optional, List
from datetime import datetime
import logging
import uuid

from db.client import get_db

logger = logging.getLogger(__name__)


class AnalyticsRepository:
    """Repository for interview analytics and transcripts."""
    
    def __init__(self):
        self.analytics_table = "analytics"
        self.transcripts_table = "transcripts"
        self.questions_table = "questions_asked"
    
    def _get_db(self):
        """Get database client."""
        return get_db()
    
    # --- Analytics ---
    
    def get_analytics_by_interview(self, interview_id: str) -> Optional[dict]:
        """Get analytics for an interview."""
        try:
            result = self._get_db().table(self.analytics_table)\
                .select("*")\
                .eq("interview_id", interview_id)\
                .single()\
                .execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error getting analytics: {e}")
            return None
    
    def create_analytics(self, data: dict) -> Optional[dict]:
        """Create analytics for an interview."""
        try:
            if "id" not in data:
                data["id"] = str(uuid.uuid4())
            
            result = self._get_db().table(self.analytics_table)\
                .insert(data)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error creating analytics: {e}")
            return None
    
    def update_analytics(self, interview_id: str, data: dict) -> Optional[dict]:
        """Update analytics for an interview."""
        try:
            result = self._get_db().table(self.analytics_table)\
                .update(data)\
                .eq("interview_id", interview_id)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error updating analytics: {e}")
            return None

    def save_analytics(self, interview_id: str, analytics_data: dict) -> Optional[dict]:
        """Save or update analytics for an interview (upsert).

        Supports both old format (nested with 'overall' key) and new format (flat DeepAnalytics).
        """
        try:
            # Check if analytics already exist for this interview
            existing = self.get_analytics_by_interview(interview_id)

            # Detect format: new DeepAnalytics format has 'overall_score' at top level
            is_new_format = "overall_score" in analytics_data and "overall" not in analytics_data

            if is_new_format:
                # New DeepAnalytics format - store complete data
                data = {
                    "interview_id": interview_id,
                    "overall_score": analytics_data.get("overall_score"),
                    "recommendation": analytics_data.get("recommendation"),
                    "synthesis": analytics_data.get("overall_synthesis", ""),
                    "question_analytics": analytics_data.get("question_analytics", []),
                    "skill_evidence": analytics_data.get("skill_evidence", []),
                    "behavioral_profile": analytics_data.get("behavioral_profile", {}),
                    "communication_metrics": analytics_data.get("communication_metrics", {}),
                    # Store full analytics in topics_to_probe for complete retrieval
                    # This includes: red_flags, highlights, role_competencies, cultural_fit, enthusiasm
                    "topics_to_probe": {
                        "topics": analytics_data.get("topics_to_probe", []),
                        "red_flags": analytics_data.get("red_flags", []),
                        "highlights": analytics_data.get("highlights", []),
                        "role_competencies": analytics_data.get("role_competencies", []),
                        "cultural_fit": analytics_data.get("cultural_fit", {}),
                        "enthusiasm": analytics_data.get("enthusiasm", {}),
                        # Store full data as backup
                        "_full_analytics": analytics_data
                    }
                }
            else:
                # Legacy format with 'overall' nested key
                overall = analytics_data.get("overall", {})
                data = {
                    "interview_id": interview_id,
                    "overall_score": overall.get("overall_score"),
                    "recommendation": overall.get("recommendation"),
                    "synthesis": overall.get("recommendation_reasoning", ""),
                    "question_analytics": analytics_data.get("qa_pairs", []),
                    "skill_evidence": analytics_data.get("highlights", {}).get("areas_to_probe", []),
                    "behavioral_profile": {
                        "communication_score": overall.get("communication_score"),
                        "technical_score": overall.get("technical_score"),
                        "cultural_fit_score": overall.get("cultural_fit_score"),
                        "confidence": overall.get("confidence"),
                        "red_flags": overall.get("red_flags", []),
                        "highlights": overall.get("highlights", []),
                    },
                    "communication_metrics": analytics_data.get("highlights", {}),
                    "topics_to_probe": analytics_data  # Store full data as backup
                }

            if existing:
                # Update existing analytics
                result = self._get_db().table(self.analytics_table)\
                    .update(data)\
                    .eq("interview_id", interview_id)\
                    .execute()
            else:
                # Create new analytics
                data["id"] = str(uuid.uuid4())
                result = self._get_db().table(self.analytics_table)\
                    .insert(data)\
                    .execute()

            logger.info(f"Analytics saved for interview {interview_id}")
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error saving analytics: {e}")
            return None

    def get_full_analytics(self, interview_id: str) -> Optional[dict]:
        """Get full analytics including all new fields (red_flags, highlights, etc.)."""
        try:
            analytics = self.get_analytics_by_interview(interview_id)
            if not analytics:
                return None

            # Reconstruct full analytics from stored data
            topics_data = analytics.get("topics_to_probe", {})

            # Check if we have full analytics stored
            if isinstance(topics_data, dict) and "_full_analytics" in topics_data:
                return topics_data["_full_analytics"]

            # Otherwise reconstruct from individual fields
            result = {
                "overall_score": analytics.get("overall_score"),
                "recommendation": analytics.get("recommendation"),
                "overall_synthesis": analytics.get("synthesis"),
                "question_analytics": analytics.get("question_analytics", []),
                "skill_evidence": analytics.get("skill_evidence", []),
                "behavioral_profile": analytics.get("behavioral_profile", {}),
                "communication_metrics": analytics.get("communication_metrics", {}),
                "topics_to_probe": topics_data.get("topics", []) if isinstance(topics_data, dict) else topics_data,
                "red_flags": topics_data.get("red_flags", []) if isinstance(topics_data, dict) else [],
                "highlights": topics_data.get("highlights", []) if isinstance(topics_data, dict) else [],
                "role_competencies": topics_data.get("role_competencies", []) if isinstance(topics_data, dict) else [],
                "cultural_fit": topics_data.get("cultural_fit", {}) if isinstance(topics_data, dict) else {},
                "enthusiasm": topics_data.get("enthusiasm", {}) if isinstance(topics_data, dict) else {},
            }
            return result
        except Exception as e:
            logger.error(f"Error getting full analytics: {e}")
            return None
    
    # --- Transcripts ---
    
    def get_transcript_by_interview(self, interview_id: str) -> Optional[dict]:
        """Get transcript for an interview."""
        try:
            result = self._get_db().table(self.transcripts_table)\
                .select("*")\
                .eq("interview_id", interview_id)\
                .single()\
                .execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error getting transcript: {e}")
            return None
    
    def create_transcript(self, interview_id: str, turns: List[dict], full_text: str = "") -> Optional[dict]:
        """Create transcript for an interview."""
        try:
            data = {
                "id": str(uuid.uuid4()),
                "interview_id": interview_id,
                "turns": turns,
                "full_text": full_text or self._build_full_text(turns)
            }
            
            result = self._get_db().table(self.transcripts_table)\
                .insert(data)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error creating transcript: {e}")
            return None
    
    def update_transcript(self, interview_id: str, turns: List[dict]) -> Optional[dict]:
        """Update transcript with new turns."""
        try:
            result = self._get_db().table(self.transcripts_table)\
                .update({
                    "turns": turns,
                    "full_text": self._build_full_text(turns)
                })\
                .eq("interview_id", interview_id)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error updating transcript: {e}")
            return None
    
    def _build_full_text(self, turns: List[dict]) -> str:
        """Build searchable full text from turns."""
        return "\n".join([
            f"{t.get('speaker', 'unknown')}: {t.get('text', '')}"
            for t in turns
        ])
    
    # --- Questions Asked ---
    
    def add_question_asked(
        self, 
        interview_id: str, 
        question_text: str,
        topic: Optional[str] = None,
        answer_quality: Optional[int] = None
    ) -> Optional[dict]:
        """Record a question that was asked."""
        try:
            data = {
                "id": str(uuid.uuid4()),
                "interview_id": interview_id,
                "question_text": question_text,
                "topic": topic,
                "answer_quality": answer_quality,
                "follow_up_needed": answer_quality is not None and answer_quality < 7
            }
            
            result = self._get_db().table(self.questions_table)\
                .insert(data)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error adding question: {e}")
            return None
    
    def bulk_add_questions(self, interview_id: str, questions: List[dict]) -> List[dict]:
        """Bulk add questions from analytics."""
        try:
            data = [
                {
                    "id": str(uuid.uuid4()),
                    "interview_id": interview_id,
                    "question_text": q.get("question", ""),
                    "topic": q.get("topic", "General"),
                    "answer_quality": q.get("quality_score", 50) // 10,  # Convert 0-100 to 0-10
                    "follow_up_needed": q.get("quality_score", 50) < 70
                }
                for q in questions
            ]
            
            result = self._get_db().table(self.questions_table)\
                .insert(data)\
                .execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error bulk adding questions: {e}")
            return []
    
    # --- Aggregate Queries ---
    
    def get_candidate_analytics_summary(self, candidate_id: str) -> dict:
        """Get aggregate analytics for a candidate across all interviews."""
        try:
            from repositories.interview_repository import InterviewRepository
            interview_repo = InterviewRepository()
            
            interviews = interview_repo.get_candidate_interviews(candidate_id)
            
            scores = []
            total_questions = 0
            all_skills = []
            
            for interview in interviews:
                analytics = interview.get("analytics")
                if analytics:
                    if isinstance(analytics, list) and analytics:
                        analytics = analytics[0]
                    if analytics.get("overall_score"):
                        scores.append(analytics["overall_score"])
                    total_questions += len(analytics.get("question_analytics", []))
                    for se in analytics.get("skill_evidence", []):
                        all_skills.append(se.get("skill"))
            
            return {
                "average_score": sum(scores) / len(scores) if scores else None,
                "stages_completed": len(interviews),
                "total_questions": total_questions,
                "verified_skills": list(set(all_skills)),
                "score_history": [
                    {
                        "stage": i["stage"],
                        "score": (i.get("analytics", [{}])[0].get("overall_score") 
                                  if isinstance(i.get("analytics"), list) and i.get("analytics")
                                  else None)
                    }
                    for i in interviews
                ]
            }
        except Exception as e:
            logger.error(f"Error getting analytics summary: {e}")
            return {}
