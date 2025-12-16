"""
Job Profile repository for Voice Ingest.
Handles CRUD operations for job profiles created through voice onboarding.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import json

from db.client import get_db
from models.voice_ingest import (
    JobProfile,
    CompanyIntelligence,
    HardRequirements,
    CandidateTrait,
    InterviewStage,
    NuanceCapture,
    OutreachConfig,
    FieldConfidence,
)

logger = logging.getLogger(__name__)


class JobProfileRepository:
    """Repository for job profile operations."""

    def __init__(self):
        self.table_name = "job_profiles"

    def _get_db(self):
        """Get database client."""
        return get_db()

    def _to_db_format(self, profile: JobProfile) -> Dict[str, Any]:
        """Convert JobProfile to database format."""
        return {
            "id": profile.id,
            "recruiter_first_name": profile.recruiter_first_name,
            "recruiter_last_name": profile.recruiter_last_name,
            "company": profile.company.model_dump() if profile.company else {},
            "requirements": profile.requirements.model_dump() if profile.requirements else {},
            "traits": [t.model_dump() for t in profile.traits],
            "interview_stages": [s.model_dump() for s in profile.interview_stages],
            "nuances": [n.model_dump() for n in profile.nuances],
            "outreach": profile.outreach.model_dump() if profile.outreach else {},
            "extraction_source": profile.extraction_source.value if profile.extraction_source else "conversation",
            "field_confidence": [fc.model_dump() for fc in profile.field_confidence],
            "is_complete": profile.is_complete,
            "missing_required_fields": profile.missing_required_fields,
            "parallel_research_status": profile.parallel_research_status,
        }

    def _from_db_format(self, data: Dict[str, Any]) -> JobProfile:
        """Convert database record to JobProfile."""
        from models.voice_ingest.enums import ExtractionSource

        # Parse JSONB fields
        company_data = data.get("company", {})
        requirements_data = data.get("requirements", {})
        traits_data = data.get("traits", [])
        stages_data = data.get("interview_stages", [])
        nuances_data = data.get("nuances", [])
        outreach_data = data.get("outreach", {})
        confidence_data = data.get("field_confidence", [])

        return JobProfile(
            id=data.get("id"),
            created_at=datetime.fromisoformat(data["created_at"].replace("Z", "+00:00")) if data.get("created_at") else datetime.utcnow(),
            updated_at=datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00")) if data.get("updated_at") else datetime.utcnow(),
            recruiter_first_name=data.get("recruiter_first_name", ""),
            recruiter_last_name=data.get("recruiter_last_name", ""),
            company=CompanyIntelligence(**company_data) if company_data else CompanyIntelligence(name="", website=""),
            requirements=HardRequirements(**requirements_data) if requirements_data else HardRequirements(),
            traits=[CandidateTrait(**t) for t in traits_data] if traits_data else [],
            interview_stages=[InterviewStage(**s) for s in stages_data] if stages_data else [],
            nuances=[NuanceCapture(**n) for n in nuances_data] if nuances_data else [],
            outreach=OutreachConfig(**outreach_data) if outreach_data else OutreachConfig(),
            extraction_source=ExtractionSource(data.get("extraction_source", "conversation")),
            field_confidence=[FieldConfidence(**fc) for fc in confidence_data] if confidence_data else [],
            is_complete=data.get("is_complete", False),
            missing_required_fields=data.get("missing_required_fields", []),
            parallel_research_status=data.get("parallel_research_status", "pending"),
        )

    # ==========================================================================
    # CRUD Operations
    # ==========================================================================

    async def create(self, profile: JobProfile) -> Optional[JobProfile]:
        """Create a new job profile."""
        try:
            db_data = self._to_db_format(profile)
            result = self._get_db().table(self.table_name)\
                .insert(db_data)\
                .execute()

            if result.data:
                return self._from_db_format(result.data[0])
            return None
        except Exception as e:
            logger.error(f"Error creating job profile: {e}")
            return None

    async def get(self, profile_id: str) -> Optional[JobProfile]:
        """Get a job profile by ID."""
        try:
            result = self._get_db().table(self.table_name)\
                .select("*")\
                .eq("id", profile_id)\
                .single()\
                .execute()

            if result.data:
                return self._from_db_format(result.data)
            return None
        except Exception as e:
            logger.error(f"Error getting job profile {profile_id}: {e}")
            return None

    async def update(self, profile_id: str, profile: JobProfile) -> Optional[JobProfile]:
        """Update an entire job profile."""
        try:
            db_data = self._to_db_format(profile)
            # Remove id from update data
            db_data.pop("id", None)

            result = self._get_db().table(self.table_name)\
                .update(db_data)\
                .eq("id", profile_id)\
                .execute()

            if result.data:
                return self._from_db_format(result.data[0])
            return None
        except Exception as e:
            logger.error(f"Error updating job profile {profile_id}: {e}")
            return None

    async def delete(self, profile_id: str) -> bool:
        """Delete a job profile."""
        try:
            self._get_db().table(self.table_name)\
                .delete()\
                .eq("id", profile_id)\
                .execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting job profile {profile_id}: {e}")
            return False

    async def list_all(self, limit: int = 20, offset: int = 0) -> List[JobProfile]:
        """
        List all job profiles, ordered by creation date (newest first).

        Args:
            limit: Maximum number of profiles to return
            offset: Number of profiles to skip (for pagination)

        Returns:
            List of JobProfile objects
        """
        try:
            result = self._get_db().table(self.table_name)\
                .select("*")\
                .order("created_at", desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()

            if result.data:
                return [self._from_db_format(row) for row in result.data]
            return []
        except Exception as e:
            logger.error(f"Error listing job profiles: {e}")
            return []

    # ==========================================================================
    # Partial Updates (for tool calls)
    # ==========================================================================

    async def update_company_field(
        self,
        session_id: str,
        field: str,
        value: Any
    ) -> bool:
        """Update a single field in the company JSONB."""
        try:
            # Get current company data
            profile = await self.get(session_id)
            if not profile:
                return False

            # Update the field
            company_dict = profile.company.model_dump()
            company_dict[field] = value

            # Save back
            result = self._get_db().table(self.table_name)\
                .update({"company": company_dict})\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error updating company field {field}: {e}")
            return False

    async def update_requirements(
        self,
        session_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update job requirements fields."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            # Update requirements
            req_dict = profile.requirements.model_dump()
            for key, value in updates.items():
                req_dict[key] = value

            # Recalculate completion
            profile.requirements = HardRequirements(**req_dict)
            profile.update_completion_status()

            # Save
            result = self._get_db().table(self.table_name)\
                .update({
                    "requirements": req_dict,
                    "is_complete": profile.is_complete,
                    "missing_required_fields": profile.missing_required_fields
                })\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error updating requirements: {e}")
            return False

    async def update_company_intel(
        self,
        session_id: str,
        company_intel: CompanyIntelligence
    ) -> bool:
        """Update the entire company intelligence (from Parallel.ai)."""
        try:
            result = self._get_db().table(self.table_name)\
                .update({
                    "company": company_intel.model_dump(),
                    "parallel_research_status": "complete"
                })\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error updating company intel: {e}")
            return False

    async def update_research_status(
        self,
        session_id: str,
        status: str
    ) -> bool:
        """Update Parallel.ai research status."""
        try:
            result = self._get_db().table(self.table_name)\
                .update({"parallel_research_status": status})\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error updating research status: {e}")
            return False

    # ==========================================================================
    # Trait Operations
    # ==========================================================================

    async def add_trait(self, session_id: str, trait: CandidateTrait) -> bool:
        """Add a trait to the profile."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            profile.add_trait(trait)

            traits_data = [t.model_dump() for t in profile.traits]
            result = self._get_db().table(self.table_name)\
                .update({
                    "traits": traits_data,
                    "is_complete": profile.is_complete,
                    "missing_required_fields": profile.missing_required_fields
                })\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error adding trait: {e}")
            return False

    async def update_trait(
        self,
        session_id: str,
        trait_name: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update a specific trait."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            # Find and update the trait
            for trait in profile.traits:
                if trait.name.lower() == trait_name.lower():
                    if "description" in updates:
                        trait.description = updates["description"]
                    if "priority" in updates:
                        from models.voice_ingest.enums import TraitPriority
                        trait.priority = TraitPriority(updates["priority"])
                    if "add_signals" in updates:
                        trait.signals.extend(updates["add_signals"])
                    if "add_anti_signals" in updates:
                        trait.anti_signals.extend(updates["add_anti_signals"])
                    break

            traits_data = [t.model_dump() for t in profile.traits]
            result = self._get_db().table(self.table_name)\
                .update({"traits": traits_data})\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error updating trait: {e}")
            return False

    async def delete_trait(self, session_id: str, trait_name: str) -> bool:
        """Delete a trait from the profile."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            profile.remove_trait(trait_name)

            traits_data = [t.model_dump() for t in profile.traits]
            result = self._get_db().table(self.table_name)\
                .update({
                    "traits": traits_data,
                    "is_complete": profile.is_complete,
                    "missing_required_fields": profile.missing_required_fields
                })\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error deleting trait: {e}")
            return False

    # ==========================================================================
    # Interview Stage Operations
    # ==========================================================================

    async def add_interview_stage(
        self,
        session_id: str,
        stage: InterviewStage
    ) -> bool:
        """Add an interview stage to the profile."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            profile.add_interview_stage(stage)

            stages_data = [s.model_dump() for s in profile.interview_stages]
            result = self._get_db().table(self.table_name)\
                .update({
                    "interview_stages": stages_data,
                    "is_complete": profile.is_complete,
                    "missing_required_fields": profile.missing_required_fields
                })\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error adding interview stage: {e}")
            return False

    async def update_interview_stage(
        self,
        session_id: str,
        stage_name: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update a specific interview stage."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            # Find and update the stage
            for stage in profile.interview_stages:
                if stage.name.lower() == stage_name.lower():
                    if "description" in updates:
                        stage.description = updates["description"]
                    if "duration_minutes" in updates:
                        stage.duration_minutes = updates["duration_minutes"]
                    if "interviewer_role" in updates:
                        stage.interviewer_role = updates["interviewer_role"]
                    if "add_actions" in updates:
                        stage.actions.extend(updates["add_actions"])
                    break

            stages_data = [s.model_dump() for s in profile.interview_stages]
            result = self._get_db().table(self.table_name)\
                .update({"interview_stages": stages_data})\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error updating interview stage: {e}")
            return False

    async def delete_interview_stage(
        self,
        session_id: str,
        stage_name: str
    ) -> bool:
        """Delete an interview stage from the profile."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            profile.remove_interview_stage(stage_name)

            stages_data = [s.model_dump() for s in profile.interview_stages]
            result = self._get_db().table(self.table_name)\
                .update({
                    "interview_stages": stages_data,
                    "is_complete": profile.is_complete,
                    "missing_required_fields": profile.missing_required_fields
                })\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error deleting interview stage: {e}")
            return False

    # ==========================================================================
    # Nuance Operations
    # ==========================================================================

    async def add_nuance(self, session_id: str, nuance: NuanceCapture) -> bool:
        """Add a nuance to the profile."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            profile.add_nuance(nuance)

            nuances_data = [n.model_dump() for n in profile.nuances]
            result = self._get_db().table(self.table_name)\
                .update({"nuances": nuances_data})\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error adding nuance: {e}")
            return False

    # ==========================================================================
    # Completion Operations
    # ==========================================================================

    async def mark_field_complete(self, session_id: str, field_name: str) -> bool:
        """Mark a specific field as confirmed/complete."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            # Update field confidence
            from models.voice_ingest.enums import ExtractionSource
            confidence = FieldConfidence.high_confidence(
                field_name,
                ExtractionSource.CONVERSATION
            )

            # Remove old confidence for this field if exists
            profile.field_confidence = [
                fc for fc in profile.field_confidence
                if fc.field_name != field_name
            ]
            profile.field_confidence.append(confidence)

            # Update completion status
            profile.update_completion_status()

            result = self._get_db().table(self.table_name)\
                .update({
                    "field_confidence": [fc.model_dump() for fc in profile.field_confidence],
                    "is_complete": profile.is_complete,
                    "missing_required_fields": profile.missing_required_fields
                })\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error marking field complete: {e}")
            return False

    async def mark_complete(self, session_id: str) -> bool:
        """Mark the entire profile as complete."""
        try:
            result = self._get_db().table(self.table_name)\
                .update({
                    "is_complete": True,
                    "missing_required_fields": []
                })\
                .eq("id", session_id)\
                .execute()

            return bool(result.data)
        except Exception as e:
            logger.error(f"Error marking profile complete: {e}")
            return False

    # ==========================================================================
    # Query Operations
    # ==========================================================================

    async def get_incomplete_profiles(self, limit: int = 50) -> List[JobProfile]:
        """Get incomplete profiles for follow-up."""
        try:
            result = self._get_db().table(self.table_name)\
                .select("*")\
                .eq("is_complete", False)\
                .order("created_at", desc=True)\
                .limit(limit)\
                .execute()

            return [self._from_db_format(r) for r in result.data] if result.data else []
        except Exception as e:
            logger.error(f"Error getting incomplete profiles: {e}")
            return []

    async def get_profiles_by_recruiter(
        self,
        first_name: str,
        last_name: str
    ) -> List[JobProfile]:
        """Get all profiles created by a recruiter."""
        try:
            result = self._get_db().table(self.table_name)\
                .select("*")\
                .eq("recruiter_first_name", first_name)\
                .eq("recruiter_last_name", last_name)\
                .order("created_at", desc=True)\
                .execute()

            return [self._from_db_format(r) for r in result.data] if result.data else []
        except Exception as e:
            logger.error(f"Error getting profiles by recruiter: {e}")
            return []


# Global instance
job_profile_repo = JobProfileRepository()
