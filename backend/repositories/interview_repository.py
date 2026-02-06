"""
Interview repository for database operations.
Handles multi-stage interview tracking and context accumulation.
"""
from typing import Optional, List
from datetime import datetime
import logging
import uuid

from db.client import get_db

logger = logging.getLogger(__name__)

# Stage order for auto-increment
STAGE_ORDER = ["round_1", "round_2", "round_3"]


class InterviewRepository:
    """Repository for interview operations with multi-stage support."""
    
    def __init__(self):
        self.table_name = "interviews"
    
    def _get_db(self):
        """Get database client."""
        return get_db()
    
    def get_by_id(self, interview_id: str) -> Optional[dict]:
        """Get an interview by ID."""
        try:
            result = self._get_db().table(self.table_name)\
                .select("*")\
                .eq("id", interview_id)\
                .single()\
                .execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error getting interview {interview_id}: {e}")
            return None
    
    def get_by_room_name(self, room_name: str) -> Optional[dict]:
        """Get an interview by LiveKit room name."""
        try:
            result = self._get_db().table(self.table_name)\
                .select("*")\
                .eq("room_name", room_name)\
                .single()\
                .execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error getting interview by room {room_name}: {e}")
            return None
    
    def get_by_access_token(self, access_token: str) -> Optional[dict]:
        """Get an interview by secure access token."""
        try:
            result = self._get_db().table(self.table_name)\
                .select("*")\
                .eq("access_token", access_token)\
                .single()\
                .execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error getting interview by token: {e}")
            return None
    
    def get_candidate_interviews(
        self, 
        candidate_id: str, 
        job_posting_id: Optional[str] = None
    ) -> List[dict]:
        """Get all interviews for a candidate (optionally filtered by job)."""
        try:
            query = self._get_db().table(self.table_name)\
                .select("*, analytics(*), transcripts(*)")\
                .eq("candidate_id", candidate_id)
            
            if job_posting_id:
                query = query.eq("job_posting_id", job_posting_id)
            
            result = query.order("stage").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting candidate interviews: {e}")
            return []

    def get_candidate_interviews_batch(
        self,
        candidate_ids: List[str],
    ) -> dict:
        """
        Get all interviews for multiple candidates in a SINGLE query.
        
        Returns a dict mapping candidate_id -> list of interviews with analytics.
        This avoids N+1 queries when fetching scores for multiple candidates.
        """
        if not candidate_ids:
            return {}
            
        try:
            result = self._get_db().table(self.table_name)\
                .select("*, analytics(*), transcripts(*)")\
                .in_("candidate_id", candidate_ids)\
                .order("stage")\
                .execute()
            
            # Group by candidate_id
            interviews_by_candidate: dict = {}
            for interview in (result.data or []):
                cid = interview.get("candidate_id")
                if cid not in interviews_by_candidate:
                    interviews_by_candidate[cid] = []
                interviews_by_candidate[cid].append(interview)
            
            return interviews_by_candidate
        except Exception as e:
            logger.error(f"Error batch fetching candidate interviews: {e}")
            return {}
    
    def get_completed_stages(
        self, 
        candidate_id: str, 
        job_posting_id: Optional[str] = None
    ) -> List[str]:
        """Get list of completed stage names for a candidate (optionally filtered by job)."""
        try:
            query = self._get_db().table(self.table_name)\
                .select("stage")\
                .eq("candidate_id", candidate_id)\
                .eq("status", "completed")
            
            if job_posting_id:
                query = query.eq("job_posting_id", job_posting_id)
            
            result = query.execute()
            return [r["stage"] for r in result.data] if result.data else []
        except Exception as e:
            logger.error(f"Error getting completed stages: {e}")
            return []
    
    def get_next_stage(
        self, 
        candidate_id: str, 
        job_posting_id: Optional[str] = None
    ) -> Optional[str]:
        """Determine the next incomplete stage for a candidate+job."""
        completed = self.get_completed_stages(candidate_id, job_posting_id)
        for stage in STAGE_ORDER:
            if stage not in completed:
                return stage
        return None  # All stages complete
    
    def all_stages_complete(
        self, 
        candidate_id: str, 
        job_posting_id: Optional[str] = None
    ) -> bool:
        """Check if all 3 stages are complete for a candidate+job."""
        completed = self.get_completed_stages(candidate_id, job_posting_id)
        return len(completed) >= 3
    
    def create(self, data: dict) -> Optional[dict]:
        """Create a new interview."""
        try:
            # Generate room name if not provided
            if "room_name" not in data:
                data["room_name"] = f"interview_{data['candidate_id']}_{data['stage']}_{int(datetime.now().timestamp())}"
            
            # Generate ID if not provided
            if "id" not in data:
                data["id"] = str(uuid.uuid4())
            
            result = self._get_db().table(self.table_name)\
                .insert(data)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            error_str = str(e)
            # Handle unique constraint violation - return existing interview
            if "interviews_candidate_job_stage_key" in error_str or "duplicate key" in error_str.lower():
                candidate_id = data.get("candidate_id")
                stage = data.get("stage")
                job_posting_id = data.get("job_posting_id")
                if candidate_id and stage:
                    logger.info(f"Interview already exists for candidate {candidate_id}, stage {stage}, returning existing")
                    return self.get_existing_interview(candidate_id, stage, job_posting_id)
            logger.error(f"Error creating interview: {e}")
            return None

    def get_existing_interview(
        self,
        candidate_id: str,
        stage: str,
        job_posting_id: Optional[str] = None
    ) -> Optional[dict]:
        """Get an existing interview for a candidate+stage+job combo."""
        try:
            query = self._get_db().table(self.table_name)\
                .select("*")\
                .eq("candidate_id", candidate_id)\
                .eq("stage", stage)

            if job_posting_id:
                query = query.eq("job_posting_id", job_posting_id)

            result = query.execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error getting existing interview: {e}")
            return None

    def start_next_interview(
        self,
        candidate_id: str,
        job_posting_id: Optional[str] = None,
        interviewer_name: Optional[str] = None
    ) -> Optional[dict]:
        """Auto-create or resume interview for the next stage of a job application."""
        next_stage = self.get_next_stage(candidate_id, job_posting_id)
        if not next_stage:
            logger.info(f"All stages complete for candidate {candidate_id}")
            return None

        # Check if an interview already exists for this stage (scheduled/active)
        existing = self.get_existing_interview(candidate_id, next_stage, job_posting_id)
        if existing:
            logger.info(f"Resuming existing {next_stage} interview for candidate {candidate_id}")
            return existing

        # Create new interview
        data = {
            "candidate_id": candidate_id,
            "stage": next_stage,
            "status": "scheduled",
            "interviewer_name": interviewer_name
        }

        if job_posting_id:
            data["job_posting_id"] = job_posting_id

        return self.create(data)
    
    def update(self, interview_id: str, data: dict) -> Optional[dict]:
        """Update an interview."""
        try:
            result = self._get_db().table(self.table_name)\
                .update(data)\
                .eq("id", interview_id)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error updating interview {interview_id}: {e}")
            return None
    
    def start_interview(self, interview_id: str) -> Optional[dict]:
        """Mark interview as active."""
        return self.update(interview_id, {
            "status": "active",
            "started_at": datetime.utcnow().isoformat()
        })
    
    def complete_interview(self, interview_id: str) -> Optional[dict]:
        """Mark interview as completed."""
        interview = self.get_by_id(interview_id)
        if not interview:
            return None
        
        # Calculate duration if started_at exists
        duration_sec = None
        if interview.get("started_at"):
            try:
                started = datetime.fromisoformat(interview["started_at"].replace("Z", "+00:00"))
                duration_sec = int((datetime.utcnow() - started.replace(tzinfo=None)).total_seconds())
            except:
                pass
        
        return self.update(interview_id, {
            "status": "completed",
            "ended_at": datetime.utcnow().isoformat(),
            "duration_sec": duration_sec
        })
    
    def get_questions_asked(self, candidate_id: str) -> List[dict]:
        """Get all questions asked to a candidate across all stages."""
        try:
            # Get all interview IDs for this candidate
            interviews = self._get_db().table(self.table_name)\
                .select("id")\
                .eq("candidate_id", candidate_id)\
                .execute()
            
            if not interviews.data:
                return []
            
            interview_ids = [i["id"] for i in interviews.data]
            
            # Get all questions for these interviews
            result = self._get_db().table("questions_asked")\
                .select("*")\
                .in_("interview_id", interview_ids)\
                .execute()
            
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting questions asked: {e}")
            return []
    
    def get_topics_to_probe(self, candidate_id: str) -> List[str]:
        """Get accumulated topics to probe from all prior stages."""
        try:
            interviews = self.get_candidate_interviews(candidate_id)
            all_topics = []
            for interview in interviews:
                if interview.get("analytics") and interview["analytics"]:
                    analytics = interview["analytics"]
                    if isinstance(analytics, list) and analytics:
                        analytics = analytics[0]
                    topics = analytics.get("topics_to_probe", [])
                    if topics:
                        all_topics.extend(topics)
            return list(set(all_topics))  # Deduplicate
        except Exception as e:
            logger.error(f"Error getting topics to probe: {e}")
            return []
    
    def get_interview_context(self, candidate_id: str, current_stage: str) -> dict:
        """Get full context for interviewer before a stage."""
        interviews = self.get_candidate_interviews(candidate_id)
        questions_asked = self.get_questions_asked(candidate_id)
        topics_to_probe = self.get_topics_to_probe(candidate_id)

        # Filter prior interviews (stages before current)
        current_idx = STAGE_ORDER.index(current_stage) if current_stage in STAGE_ORDER else 0
        prior_interviews = [
            i for i in interviews
            if STAGE_ORDER.index(i["stage"]) < current_idx
        ] if interviews else []

        return {
            "prior_interviews": prior_interviews,
            "questions_to_avoid": [q["question_text"] for q in questions_asked],
            "topics_to_explore": topics_to_probe,
            "score_history": [
                {
                    "stage": i["stage"],
                    "score": i.get("analytics", [{}])[0].get("overall_score")
                            if isinstance(i.get("analytics"), list) and i.get("analytics")
                            else None
                }
                for i in prior_interviews
            ]
        }

    def delete(self, interview_id: str) -> bool:
        """
        Delete an interview and all associated data.
        Cascade deletes in DB will handle transcripts, analytics, questions_asked, etc.
        """
        try:
            result = self._get_db().table(self.table_name)\
                .delete()\
                .eq("id", interview_id)\
                .execute()
            return len(result.data) > 0 if result.data else False
        except Exception as e:
            logger.error(f"Error deleting interview {interview_id}: {e}")
            return False

    def get_previous_completed_stage(self, candidate_id: str) -> Optional[str]:
        """
        Get the most recently completed stage for a candidate.
        Used to determine pipeline status after deleting an interview.
        """
        completed = self.get_completed_stages(candidate_id)
        if not completed:
            return None
        # Return the highest completed stage
        for stage in reversed(STAGE_ORDER):
            if stage in completed:
                return stage
        return None
