"""
Person Repository - Database operations for Person entities.

Handles CRUD operations for persons with email-based deduplication.
"""

import json
from typing import List, Optional, Any, Dict
from uuid import UUID
from datetime import datetime

from models.streamlined.person import Person, PersonCreate, PersonUpdate
from db.client import get_db


class PersonRepository:
    """Repository for Person database operations."""

    def __init__(self):
        self.client = get_db()
        self.table = "persons"

    def _prepare_data_for_db(self, person_data: PersonCreate) -> Dict[str, Any]:
        """Prepare person data for database insertion, handling JSON fields."""
        data = {
            "name": person_data.name,
            "email": person_data.email,
            "phone": person_data.phone,
            "resume_url": person_data.resume_url,
            "linkedin_url": person_data.linkedin_url,
            "headline": person_data.headline,
            "summary": person_data.summary,
            "current_title": person_data.current_title,
            "current_company": person_data.current_company,
            "location": person_data.location,
            "years_experience": person_data.years_experience,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        # Handle list/dict fields that need JSON serialization for Supabase
        if person_data.skills:
            data["skills"] = person_data.skills
        if person_data.work_history:
            data["work_history"] = person_data.work_history
        if person_data.education:
            data["education"] = person_data.education
        if person_data.enrichment_data:
            data["enrichment_data"] = person_data.enrichment_data

        # Remove None values to avoid overwriting existing data
        return {k: v for k, v in data.items() if v is not None}

    async def create(self, person_data: PersonCreate) -> Person:
        """
        Create a new person.

        Args:
            person_data: PersonCreate model

        Returns:
            Created Person with generated ID and timestamps
        """
        data = self._prepare_data_for_db(person_data)

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create person")

        return Person(**result.data[0])

    def create_sync(self, person_data: PersonCreate) -> Person:
        """Synchronous version of create."""
        data = self._prepare_data_for_db(person_data)

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create person")

        return Person(**result.data[0])

    async def get_by_id(self, person_id: UUID) -> Optional[Person]:
        """Get a person by ID."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(person_id))\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    def get_by_id_sync(self, person_id: UUID) -> Optional[Person]:
        """Synchronous version of get_by_id."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(person_id))\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    async def get_by_email(self, email: str) -> Optional[Person]:
        """
        Get a person by email (for deduplication).

        Args:
            email: Email address to search for

        Returns:
            Person if found, None otherwise
        """
        result = self.client.table(self.table)\
            .select("*")\
            .eq("email", email.lower().strip())\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    def get_by_email_sync(self, email: str) -> Optional[Person]:
        """Synchronous version of get_by_email."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("email", email.lower().strip())\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    async def get_by_linkedin_url(self, linkedin_url: str) -> Optional[Person]:
        """
        Get a person by LinkedIn URL (alternative deduplication).

        Args:
            linkedin_url: LinkedIn profile URL to search for

        Returns:
            Person if found, None otherwise
        """
        result = self.client.table(self.table)\
            .select("*")\
            .eq("linkedin_url", linkedin_url.strip())\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    def get_by_linkedin_url_sync(self, linkedin_url: str) -> Optional[Person]:
        """Synchronous version of get_by_linkedin_url."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("linkedin_url", linkedin_url.strip())\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    async def get_by_phone(self, phone: str) -> Optional[Person]:
        """Get a person by phone number."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("phone", phone.strip())\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    def get_by_phone_sync(self, phone: str) -> Optional[Person]:
        """Synchronous version of get_by_phone."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("phone", phone.strip())\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    async def get_by_name(self, name: str) -> Optional[Person]:
        """Get a person by exact name match (case-insensitive)."""
        result = self.client.table(self.table)\
            .select("*")\
            .ilike("name", name.strip())\
            .execute()

        if not result.data:
            return None
        
        # Return the first match (risk of collision but requested behavior)
        return Person(**result.data[0])

    def get_by_name_sync(self, name: str) -> Optional[Person]:
        """Synchronous version of get_by_name."""
        result = self.client.table(self.table)\
            .select("*")\
            .ilike("name", name.strip())\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    async def get_or_create(self, person_data: PersonCreate) -> tuple[Person, bool]:
        """
        Get existing person by matching unique identifiers or create a new one.
        
        Resolution Order:
        1. Email (Strongest)
        2. LinkedIn URL
        3. Phone
        4. Name (Weakest, but requested)
        """
        existing = None

        # 1. Match by Email
        if person_data.email:
            existing = await self.get_by_email(person_data.email)

        # 2. Match by LinkedIn URL
        if not existing and person_data.linkedin_url:
            existing = await self.get_by_linkedin_url(person_data.linkedin_url)
            
        # 3. Match by Phone
        if not existing and person_data.phone:
            existing = await self.get_by_phone(person_data.phone)

        # 4. Match by Name
        if not existing and person_data.name:
            existing = await self.get_by_name(person_data.name)

        if existing:
            # MERGE logic
            updates = {}
            if person_data.phone and not existing.phone:
                updates["phone"] = person_data.phone
            if person_data.linkedin_url and not existing.linkedin_url:
                updates["linkedin_url"] = person_data.linkedin_url
            if person_data.email and not existing.email:
                updates["email"] = person_data.email
            if person_data.current_title and not existing.current_title:
                updates["current_title"] = person_data.current_title
            if person_data.current_company and not existing.current_company:
                updates["current_company"] = person_data.current_company
                
            if person_data.skills:
                current_skills = set(existing.skills) if existing.skills else set()
                new_skills = [s for s in person_data.skills if s not in current_skills]
                if new_skills:
                    updates["skills"] = list(current_skills) + new_skills

            if updates:
                updated_person = await self.update(existing.id, PersonUpdate(**updates))
                return updated_person or existing, False
            
            return existing, False

        # No match found - Create new
        new_person = await self.create(person_data)
        return new_person, True

    def get_or_create_sync(self, person_data: PersonCreate) -> tuple[Person, bool]:
        """Synchronous version of get_or_create."""
        existing = None

        # 1. Match by Email
        if person_data.email:
            existing = self.get_by_email_sync(person_data.email)

        # 2. Match by LinkedIn URL
        if not existing and person_data.linkedin_url:
            existing = self.get_by_linkedin_url_sync(person_data.linkedin_url)
            
        # 3. Match by Phone
        if not existing and person_data.phone:
            existing = self.get_by_phone_sync(person_data.phone)

        # 4. Match by Name
        if not existing and person_data.name:
            existing = self.get_by_name_sync(person_data.name)

        if existing:
            # MERGE logic
            updates = {}
            if person_data.phone and not existing.phone:
                updates["phone"] = person_data.phone
            if person_data.linkedin_url and not existing.linkedin_url:
                updates["linkedin_url"] = person_data.linkedin_url
            if person_data.email and not existing.email:
                updates["email"] = person_data.email
            if person_data.current_title and not existing.current_title:
                updates["current_title"] = person_data.current_title
            if person_data.current_company and not existing.current_company:
                updates["current_company"] = person_data.current_company
                
            if person_data.skills:
                current_skills = set(existing.skills) if existing.skills else set()
                new_skills = [s for s in person_data.skills if s not in current_skills]
                if new_skills:
                    updates["skills"] = list(current_skills) + new_skills
            
            if updates:
                updated_person = self.update_sync(existing.id, PersonUpdate(**updates))
                return updated_person or existing, False

            return existing, False

        # No match found - Create new
        new_person = self.create_sync(person_data)
        return new_person, True

    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Person]:
        """List all persons with pagination."""
        result = self.client.table(self.table)\
            .select("*")\
            .order("created_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()

        return [Person(**p) for p in result.data]

    def list_all_sync(self, limit: int = 100, offset: int = 0) -> List[Person]:
        """Synchronous version of list_all."""
        result = self.client.table(self.table)\
            .select("*")\
            .order("created_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()

        return [Person(**p) for p in result.data]

    async def update(self, person_id: UUID, person_update: PersonUpdate) -> Optional[Person]:
        """Update a person."""
        update_data = person_update.model_dump(exclude_unset=True)

        if not update_data:
            return await self.get_by_id(person_id)

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(person_id))\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    def update_sync(self, person_id: UUID, person_update: PersonUpdate) -> Optional[Person]:
        """Synchronous version of update."""
        update_data = person_update.model_dump(exclude_unset=True)

        if not update_data:
            return self.get_by_id_sync(person_id)

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = self.client.table(self.table)\
            .update(update_data)\
            .eq("id", str(person_id))\
            .execute()

        if not result.data:
            return None

        return Person(**result.data[0])

    async def delete(self, person_id: UUID) -> bool:
        """Delete a person."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(person_id))\
            .execute()

        return len(result.data) > 0

    def delete_sync(self, person_id: UUID) -> bool:
        """Synchronous version of delete."""
        result = self.client.table(self.table)\
            .delete()\
            .eq("id", str(person_id))\
            .execute()

        return len(result.data) > 0

    def search_sync(
        self,
        query: Optional[str] = None,
        skills: Optional[List[str]] = None,
        location: Optional[str] = None,
        current_company: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Person]:
        """
        Search persons with filters.

        Args:
            query: Text search for name, headline, or summary
            skills: List of skills to filter by (matches any)
            location: Location filter (partial match)
            current_company: Company filter (partial match)
            limit: Max results to return
            offset: Pagination offset

        Returns:
            List of matching persons
        """
        builder = self.client.table(self.table).select("*")

        # Text search on name, headline, summary using ilike
        if query:
            # Supabase doesn't support OR directly in filters easily,
            # so we search name with ilike
            builder = builder.ilike("name", f"%{query}%")

        # Location filter
        if location:
            builder = builder.ilike("location", f"%{location}%")

        # Company filter
        if current_company:
            builder = builder.ilike("current_company", f"%{current_company}%")

        # Skills filter - use contains for JSONB array
        if skills and len(skills) > 0:
            # Filter for any matching skill
            builder = builder.contains("skills", skills)

        # Pagination and ordering
        result = builder\
            .order("updated_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()

        return [Person(**p) for p in result.data]

    def count_all_sync(self) -> int:
        """Count total number of persons."""
        result = self.client.table(self.table)\
            .select("id", count="exact")\
            .execute()

        return result.count if result.count else 0

    def get_all_skills_sync(self, limit: int = 100) -> List[str]:
        """
        Get all unique skills across all persons.

        Returns a list of unique skill names for filtering UI.
        """
        result = self.client.table(self.table)\
            .select("skills")\
            .not_.is_("skills", "null")\
            .limit(500)\
            .execute()

        # Flatten and deduplicate skills
        all_skills = set()
        for row in result.data:
            skills = row.get("skills", [])
            if skills and isinstance(skills, list):
                all_skills.update(skills)

        # Sort and limit
        return sorted(list(all_skills))[:limit]

    def get_all_locations_sync(self, limit: int = 50) -> List[str]:
        """
        Get all unique locations across all persons.

        Returns a list of unique locations for filtering UI.
        """
        result = self.client.table(self.table)\
            .select("location")\
            .not_.is_("location", "null")\
            .limit(500)\
            .execute()

        # Deduplicate locations
        locations = set()
        for row in result.data:
            loc = row.get("location")
            if loc:
                locations.add(loc)

        return sorted(list(locations))[:limit]

    def get_all_companies_sync(self, limit: int = 50) -> List[str]:
        """
        Get all unique companies across all persons.

        Returns a list of unique company names for filtering UI.
        """
        result = self.client.table(self.table)\
            .select("current_company")\
            .not_.is_("current_company", "null")\
            .limit(500)\
            .execute()

        # Deduplicate companies
        companies = set()
        for row in result.data:
            company = row.get("current_company")
            if company:
                companies.add(company)

        return sorted(list(companies))[:limit]

    def search_by_ids_sync(
        self,
        person_ids: List[str],
        query: Optional[str] = None,
        skills: Optional[List[str]] = None,
        location: Optional[str] = None,
        current_company: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Person]:
        """
        Search persons within a specific set of person IDs.

        Args:
            person_ids: List of person IDs to search within
            query: Text search for name
            skills: List of skills to filter by
            location: Location filter
            current_company: Company filter
            limit: Max results
            offset: Pagination offset

        Returns:
            List of matching persons
        """
        if not person_ids:
            return []

        builder = self.client.table(self.table).select("*")

        # Filter by person IDs
        builder = builder.in_("id", person_ids)

        # Text search on name
        if query:
            builder = builder.ilike("name", f"%{query}%")

        # Location filter
        if location:
            builder = builder.ilike("location", f"%{location}%")

        # Company filter
        if current_company:
            builder = builder.ilike("current_company", f"%{current_company}%")

        # Skills filter
        if skills and len(skills) > 0:
            builder = builder.contains("skills", skills)

        # Pagination and ordering
        result = builder\
            .order("updated_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()

        return [Person(**p) for p in result.data]

    def search_with_candidates_sync(
        self,
        query: Optional[str] = None,
        skills: Optional[List[str]] = None,
        location: Optional[str] = None,
        current_company: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[tuple]:
        """
        Search persons with filters and include candidate counts in a SINGLE query.

        Uses Supabase's nested select to fetch persons and their candidates
        in one database round-trip, avoiding N+1 query problems.

        Args:
            query: Text search for name, headline, or summary
            skills: List of skills to filter by (matches any)
            location: Location filter (partial match)
            current_company: Company filter (partial match)
            limit: Max results to return
            offset: Pagination offset

        Returns:
            List of tuples: (Person, application_count)
        """
        # Use nested select to include candidates in the same query
        builder = self.client.table(self.table).select("*, candidates(id)")

        # Text search on name using ilike
        if query:
            builder = builder.ilike("name", f"%{query}%")

        # Location filter
        if location:
            builder = builder.ilike("location", f"%{location}%")

        # Company filter
        if current_company:
            builder = builder.ilike("current_company", f"%{current_company}%")

        # Skills filter - use contains for JSONB array
        if skills and len(skills) > 0:
            builder = builder.contains("skills", skills)

        # Pagination and ordering
        result = builder\
            .order("updated_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()

        # Parse results and count candidates for each person
        persons_with_counts = []
        for p in result.data:
            # Extract candidates and count them
            candidates = p.pop("candidates", []) or []
            application_count = len(candidates)
            
            # Create Person object from remaining data
            person = Person(**p)
            persons_with_counts.append((person, application_count))

        return persons_with_counts

