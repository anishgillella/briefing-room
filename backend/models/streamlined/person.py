"""
Person model - represents a unique individual who can apply to multiple jobs.

A Person is identified by their email address. The same Person can have
multiple Candidate records (one for each job they apply to).
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID, uuid4


class PersonBase(BaseModel):
    """Base person fields for create/update operations."""
    name: str = Field(..., min_length=1, max_length=255, description="Full name")
    email: EmailStr = Field(..., description="Email address (unique identifier)")
    phone: Optional[str] = Field(None, max_length=50, description="Phone number")
    resume_url: Optional[str] = Field(None, description="URL to resume file")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")


class PersonCreate(PersonBase):
    """Fields required to create a new person."""
    pass


class PersonUpdate(BaseModel):
    """Fields that can be updated on a person. All optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    resume_url: Optional[str] = None
    linkedin_url: Optional[str] = None


class Person(PersonBase):
    """Full person model with all fields including metadata."""
    id: UUID = Field(default_factory=uuid4, description="Unique identifier")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }


class PersonWithApplications(Person):
    """Person with their job applications (Candidate records)."""
    application_count: int = Field(default=0, description="Number of jobs applied to")
    # The actual applications would be loaded via a join
