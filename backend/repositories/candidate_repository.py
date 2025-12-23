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

    def get_by_json_id(self, json_id: str) -> Optional[dict]:
        """Get a candidate by their JSON ID (from Pluto system)."""
        try:
            result = self._get_db().table(self.table_name)\
                .select("*")\
                .eq("json_id", json_id)\
                .single()\
                .execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error getting candidate by json_id {json_id}: {e}")
            return None

    def set_json_id(self, candidate_id: str, json_id: str) -> Optional[dict]:
        """Set the JSON ID for a candidate (for linking Pluto data to DB)."""
        return self.update(candidate_id, {"json_id": json_id})
    
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
        """Create a new candidate. Falls back to upsert if name already exists."""
        try:
            # Remove None values and empty lists for cleaner insert
            clean_data = {k: v for k, v in data.items() if v is not None}

            result = self._get_db().table(self.table_name)\
                .insert(clean_data)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            error_str = str(e)
            # Handle unique constraint violation - fall back to upsert
            if "candidates_name_unique" in error_str or "duplicate key" in error_str.lower():
                name = data.get('name')
                if name:
                    logger.info(f"Candidate '{name}' already exists, updating instead")
                    existing = self.get_by_name(name)
                    if existing:
                        update_data = {k: v for k, v in data.items() if v is not None and k != 'name'}
                        if update_data:
                            return self.update(existing['id'], update_data)
                        return existing
            logger.error(f"Error creating candidate: {e}")
            return None

    def get_or_create_by_name(self, name: str, data: dict) -> Optional[dict]:
        """
        Get existing candidate by name, or create if not exists.
        This prevents duplicate candidates from being created.
        """
        # First, try to find existing candidate
        existing = self.get_by_name(name)
        if existing:
            logger.info(f"Found existing candidate '{name}' with ID {existing['id']}")
            # Optionally update with new data (merge)
            if data:
                update_data = {k: v for k, v in data.items() if v is not None and k != 'name'}
                if update_data:
                    self.update(existing['id'], update_data)
            return existing

        # Create new candidate
        data['name'] = name
        return self.create(data)

    def upsert_by_json_id(self, json_id: str, data: dict) -> Optional[dict]:
        """
        Upsert candidate by json_id - update if exists, create if not.
        This prevents duplicate candidates when syncing from Pluto/JSON system.
        """
        existing = self.get_by_json_id(json_id)
        if existing:
            logger.info(f"Updating existing candidate with json_id={json_id}")
            clean_data = {k: v for k, v in data.items() if v is not None}
            return self.update(existing['id'], clean_data)

        # Try by name as fallback
        name = data.get('name')
        if name:
            existing = self.get_by_name(name)
            if existing:
                logger.info(f"Found candidate by name '{name}', setting json_id={json_id}")
                data['json_id'] = json_id
                clean_data = {k: v for k, v in data.items() if v is not None}
                return self.update(existing['id'], clean_data)

        # Create new
        data['json_id'] = json_id
        return self.create(data)
    
    def update(self, candidate_id: str, data: dict) -> Optional[dict]:
        """Update a candidate."""
        try:
            # Remove None values
            clean_data = {k: v for k, v in data.items() if v is not None}
            
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
        """Bulk create candidates. Falls back to individual creates on constraint violations."""
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
            error_str = str(e)
            # On duplicate key error, fall back to individual creates (which handle upserts)
            if "candidates_name_unique" in error_str or "duplicate key" in error_str.lower():
                logger.info("Bulk insert failed due to duplicates, falling back to individual upserts")
                results = []
                for c in candidates:
                    result = self.create(c)
                    if result:
                        results.append(result)
                return results
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
