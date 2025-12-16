"""
Local File-Based Job Profile Repository.
Stores job profiles in a JSON file for local development without database.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path
import logging
import json
import os

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


class LocalJobProfileRepository:
    """Local file-based repository for job profile operations."""

    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent / "data"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.profiles_file = self.data_dir / "job_profiles.json"
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Create the profiles file if it doesn't exist."""
        if not self.profiles_file.exists():
            self._save_all({})

    def _load_all(self) -> Dict[str, Dict]:
        """Load all profiles from file."""
        try:
            with open(self.profiles_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _save_all(self, profiles: Dict[str, Dict]):
        """Save all profiles to file."""
        with open(self.profiles_file, 'w') as f:
            json.dump(profiles, f, indent=2, default=str)

    def _to_dict(self, profile: JobProfile) -> Dict[str, Any]:
        """Convert JobProfile to dictionary for storage."""
        return {
            "id": profile.id,
            "created_at": profile.created_at.isoformat() if profile.created_at else datetime.utcnow().isoformat(),
            "updated_at": profile.updated_at.isoformat() if profile.updated_at else datetime.utcnow().isoformat(),
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

    def _from_dict(self, data: Dict[str, Any]) -> JobProfile:
        """Convert dictionary to JobProfile."""
        from models.voice_ingest.enums import ExtractionSource

        company_data = data.get("company", {})
        requirements_data = data.get("requirements", {})
        traits_data = data.get("traits", [])
        stages_data = data.get("interview_stages", [])
        nuances_data = data.get("nuances", [])
        outreach_data = data.get("outreach", {})
        confidence_data = data.get("field_confidence", [])

        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))

        updated_at = data.get("updated_at")
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))

        return JobProfile(
            id=data.get("id"),
            created_at=created_at or datetime.utcnow(),
            updated_at=updated_at or datetime.utcnow(),
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
            profiles = self._load_all()
            data = self._to_dict(profile)
            data["created_at"] = datetime.utcnow().isoformat()
            data["updated_at"] = datetime.utcnow().isoformat()
            profiles[profile.id] = data
            self._save_all(profiles)
            logger.info(f"Created job profile: {profile.id}")
            return self._from_dict(data)
        except Exception as e:
            logger.error(f"Error creating job profile: {e}")
            return None

    async def get(self, profile_id: str) -> Optional[JobProfile]:
        """Get a job profile by ID."""
        try:
            profiles = self._load_all()
            if profile_id in profiles:
                return self._from_dict(profiles[profile_id])
            return None
        except Exception as e:
            logger.error(f"Error getting job profile {profile_id}: {e}")
            return None

    async def update(self, profile_id: str, profile: JobProfile) -> Optional[JobProfile]:
        """Update an entire job profile."""
        try:
            profiles = self._load_all()
            if profile_id not in profiles:
                return None

            data = self._to_dict(profile)
            data["created_at"] = profiles[profile_id].get("created_at", datetime.utcnow().isoformat())
            data["updated_at"] = datetime.utcnow().isoformat()
            profiles[profile_id] = data
            self._save_all(profiles)
            return self._from_dict(data)
        except Exception as e:
            logger.error(f"Error updating job profile {profile_id}: {e}")
            return None

    async def delete(self, profile_id: str) -> bool:
        """Delete a job profile."""
        try:
            profiles = self._load_all()
            if profile_id in profiles:
                del profiles[profile_id]
                self._save_all(profiles)
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting job profile {profile_id}: {e}")
            return False

    async def list_all(self, limit: int = 20, offset: int = 0) -> List[JobProfile]:
        """List all job profiles, ordered by creation date (newest first)."""
        try:
            profiles = self._load_all()
            sorted_profiles = sorted(
                profiles.values(),
                key=lambda x: x.get("created_at", ""),
                reverse=True
            )
            paginated = sorted_profiles[offset:offset + limit]
            return [self._from_dict(p) for p in paginated]
        except Exception as e:
            logger.error(f"Error listing job profiles: {e}")
            return []

    # ==========================================================================
    # Partial Updates (for tool calls)
    # ==========================================================================

    async def update_requirements(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """Update job requirements fields."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            req_dict = profile.requirements.model_dump()
            for key, value in updates.items():
                req_dict[key] = value

            profile.requirements = HardRequirements(**req_dict)
            profile.update_completion_status()
            await self.update(session_id, profile)
            return True
        except Exception as e:
            logger.error(f"Error updating requirements: {e}")
            return False

    async def update_company_intel(self, session_id: str, company_intel: CompanyIntelligence) -> bool:
        """Update the entire company intelligence."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            profile.company = company_intel
            profile.parallel_research_status = "complete"
            await self.update(session_id, profile)
            return True
        except Exception as e:
            logger.error(f"Error updating company intel: {e}")
            return False

    async def update_research_status(self, session_id: str, status: str) -> bool:
        """Update Parallel.ai research status."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            profile.parallel_research_status = status
            await self.update(session_id, profile)
            return True
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
            await self.update(session_id, profile)
            return True
        except Exception as e:
            logger.error(f"Error adding trait: {e}")
            return False

    async def update_trait(self, session_id: str, trait_name: str, updates: Dict[str, Any]) -> bool:
        """Update a specific trait."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            for trait in profile.traits:
                if trait.name.lower() == trait_name.lower():
                    if "description" in updates:
                        trait.description = updates["description"]
                    if "priority" in updates:
                        from models.voice_ingest.enums import TraitPriority
                        trait.priority = TraitPriority(updates["priority"])
                    if "add_signals" in updates:
                        trait.signals.extend(updates["add_signals"])
                    break

            await self.update(session_id, profile)
            return True
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
            await self.update(session_id, profile)
            return True
        except Exception as e:
            logger.error(f"Error deleting trait: {e}")
            return False

    # ==========================================================================
    # Interview Stage Operations
    # ==========================================================================

    async def add_interview_stage(self, session_id: str, stage: InterviewStage) -> bool:
        """Add an interview stage to the profile."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            profile.add_interview_stage(stage)
            await self.update(session_id, profile)
            return True
        except Exception as e:
            logger.error(f"Error adding interview stage: {e}")
            return False

    async def update_interview_stage(self, session_id: str, stage_name: str, updates: Dict[str, Any]) -> bool:
        """Update a specific interview stage."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            for stage in profile.interview_stages:
                if stage.name.lower() == stage_name.lower():
                    if "description" in updates:
                        stage.description = updates["description"]
                    if "duration_minutes" in updates:
                        stage.duration_minutes = updates["duration_minutes"]
                    if "add_actions" in updates:
                        stage.actions.extend(updates["add_actions"])
                    break

            await self.update(session_id, profile)
            return True
        except Exception as e:
            logger.error(f"Error updating interview stage: {e}")
            return False

    async def delete_interview_stage(self, session_id: str, stage_name: str) -> bool:
        """Delete an interview stage from the profile."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            profile.remove_interview_stage(stage_name)
            await self.update(session_id, profile)
            return True
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
            await self.update(session_id, profile)
            return True
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

            from models.voice_ingest.enums import ExtractionSource
            confidence = FieldConfidence.high_confidence(field_name, ExtractionSource.CONVERSATION)

            profile.field_confidence = [fc for fc in profile.field_confidence if fc.field_name != field_name]
            profile.field_confidence.append(confidence)
            profile.update_completion_status()

            await self.update(session_id, profile)
            return True
        except Exception as e:
            logger.error(f"Error marking field complete: {e}")
            return False

    async def mark_complete(self, session_id: str) -> bool:
        """Mark the entire profile as complete."""
        try:
            profile = await self.get(session_id)
            if not profile:
                return False

            profile.is_complete = True
            profile.missing_required_fields = []
            await self.update(session_id, profile)
            return True
        except Exception as e:
            logger.error(f"Error marking profile complete: {e}")
            return False


# Create global instance
job_profile_repo = LocalJobProfileRepository()
