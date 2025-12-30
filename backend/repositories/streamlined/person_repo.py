"""
Person Repository - Database operations for Person entities.

Handles CRUD operations for persons with email-based deduplication.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from models.streamlined.person import Person, PersonCreate, PersonUpdate
from db.client import get_db


class PersonRepository:
    """Repository for Person database operations."""

    def __init__(self):
        self.client = get_db()
        self.table = "persons"

    async def create(self, person_data: PersonCreate) -> Person:
        """
        Create a new person.

        Args:
            person_data: PersonCreate model

        Returns:
            Created Person with generated ID and timestamps
        """
        data = {
            "name": person_data.name,
            "email": person_data.email,
            "phone": person_data.phone,
            "resume_url": person_data.resume_url,
            "linkedin_url": person_data.linkedin_url,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create person")

        return Person(**result.data[0])

    def create_sync(self, person_data: PersonCreate) -> Person:
        """Synchronous version of create."""
        data = {
            "name": person_data.name,
            "email": person_data.email,
            "phone": person_data.phone,
            "resume_url": person_data.resume_url,
            "linkedin_url": person_data.linkedin_url,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

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

    async def get_or_create(self, person_data: PersonCreate) -> tuple[Person, bool]:
        """
        Get existing person by email or create new one.

        Args:
            person_data: PersonCreate model

        Returns:
            Tuple of (Person, created: bool)
        """
        existing = await self.get_by_email(person_data.email)
        if existing:
            return existing, False

        new_person = await self.create(person_data)
        return new_person, True

    def get_or_create_sync(self, person_data: PersonCreate) -> tuple[Person, bool]:
        """Synchronous version of get_or_create."""
        existing = self.get_by_email_sync(person_data.email)
        if existing:
            return existing, False

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
