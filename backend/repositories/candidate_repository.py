"""
Candidate repository for database operations.
"""
from typing import Optional, List
from uuid import UUID
import logging

from db.client import get_db
from models.candidate import Candidate

logger = logging.getLogger(__name__)


class CandidateRepository:
    """Repository for candidate CRUD operations."""
    
    def __init__(self):
        self.table_name = "candidates"
    
    def _get_db(self):
        """Get database client."""
        return get_db()
    
    def get_by_id(self, candidate_id: str) -> Optional[dict]:
        """Get a candidate by ID."""
        try:
            result = self._get_db().table(self.table_name)\
                .select("*")\
                .eq("id", candidate_id)\
                .single()\
                .execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error getting candidate {candidate_id}: {e}")
            return None
    
    def get_by_name(self, name: str) -> Optional[dict]:
        """Get a candidate by name (case-insensitive partial match)."""
        try:
            result = self._get_db().table(self.table_name)\
                .select("*")\
                .ilike("name", f"%{name}%")\
                .limit(1)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error getting candidate by name {name}: {e}")
            return None
    
    def get_all(
        self, 
        limit: int = 50, 
        offset: int = 0,
        tier: Optional[str] = None,
        status: Optional[str] = None,
        job_posting_id: Optional[str] = None
    ) -> List[dict]:
        """Get all candidates with optional filtering."""
        try:
            query = self._get_db().table(self.table_name)\
                .select("*")\
                .order("combined_score", desc=True)
            
            if tier:
                query = query.eq("tier", tier)
            if status:
                query = query.eq("pipeline_status", status)
            if job_posting_id:
                query = query.eq("job_posting_id", job_posting_id)
            
            query = query.range(offset, offset + limit - 1)
            result = query.execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error listing candidates: {e}")
            return []
    
    def create(self, data: dict) -> Optional[dict]:
        """Create a new candidate."""
        try:
            # Remove None values and empty lists for cleaner insert
            clean_data = {k: v for k, v in data.items() if v is not None}
            
            result = self._get_db().table(self.table_name)\
                .insert(clean_data)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error creating candidate: {e}")
            return None
    
    def update(self, candidate_id: str, data: dict) -> Optional[dict]:
        """Update a candidate."""
        try:
            from datetime import datetime
            
            # Remove None values and convert datetime to string
            clean_data = {}
            for k, v in data.items():
                if v is not None:
                    if isinstance(v, datetime):
                        clean_data[k] = v.isoformat()
                    else:
                        clean_data[k] = v
            
            result = self._get_db().table(self.table_name)\
                .update(clean_data)\
                .eq("id", candidate_id)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error updating candidate {candidate_id}: {e}")
            return None
    
    def delete(self, candidate_id: str) -> bool:
        """Delete a candidate."""
        try:
            result = self._get_db().table(self.table_name)\
                .delete()\
                .eq("id", candidate_id)\
                .execute()
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Error deleting candidate {candidate_id}: {e}")
            return False
    
    def update_pipeline_status(self, candidate_id: str, status: str) -> Optional[dict]:
        """Update candidate's pipeline status."""
        return self.update(candidate_id, {"pipeline_status": status})
    
    def set_decision(
        self, 
        candidate_id: str, 
        decision: str, 
        notes: Optional[str] = None
    ) -> Optional[dict]:
        """Set final hiring decision for a candidate."""
        from datetime import datetime
        
        data = {
            "final_decision": decision,
            "pipeline_status": decision,  # 'accepted' or 'rejected'
            "decided_at": datetime.utcnow().isoformat()
        }
        if notes:
            data["decision_notes"] = notes
        
        return self.update(candidate_id, data)
    
    def bulk_create(self, candidates: List[dict]) -> List[dict]:
        """Bulk create candidates."""
        try:
            # Clean data
            clean_candidates = []
            for c in candidates:
                clean_data = {k: v for k, v in c.items() if v is not None}
                clean_candidates.append(clean_data)
            
            result = self._get_db().table(self.table_name)\
                .insert(clean_candidates)\
                .execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error bulk creating candidates: {e}")
            return []
    
    def count(
        self,
        tier: Optional[str] = None,
        status: Optional[str] = None
    ) -> int:
        """Count candidates with optional filtering."""
        try:
            query = self._get_db().table(self.table_name)\
                .select("id", count="exact")
            
            if tier:
                query = query.eq("tier", tier)
            if status:
                query = query.eq("pipeline_status", status)
            
            result = query.execute()
            return result.count or 0
        except Exception as e:
            logger.error(f"Error counting candidates: {e}")
            return 0
    
    def delete_all(self) -> int:
        """Delete all candidates. Returns count of deleted records."""
        try:
            # Delete all records by matching any id (neq empty string won't match any real UUID)
            result = self._get_db().table(self.table_name)\
                .delete()\
                .neq("id", "00000000-0000-0000-0000-000000000000")\
                .execute()
            deleted_count = len(result.data) if result.data else 0
            logger.info(f"Deleted {deleted_count} candidates")
            return deleted_count
        except Exception as e:
            logger.error(f"Error deleting all candidates: {e}")
            return 0
    
    def delete_by_job_posting(self, job_posting_id: str) -> int:
        """Delete all candidates for a specific job posting. Returns count of deleted records."""
        try:
            result = self._get_db().table(self.table_name)\
                .delete()\
                .eq("job_posting_id", job_posting_id)\
                .execute()
            deleted_count = len(result.data) if result.data else 0
            logger.info(f"Deleted {deleted_count} candidates for job_posting_id={job_posting_id}")
            return deleted_count
        except Exception as e:
            logger.error(f"Error deleting candidates for job posting {job_posting_id}: {e}")
            return 0
