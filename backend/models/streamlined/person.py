"""
Person model - represents a unique individual who can apply to multiple jobs.

A Person can be identified by their email address or LinkedIn URL.
The same Person can have multiple Candidate records (one for each job they apply to).
Email is optional to support LinkedIn-sourced candidates without email addresses.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4


class WorkExperience(BaseModel):
    """Work experience entry."""
    company: Optional[str] = None
    title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    is_current: bool = False


class Education(BaseModel):
    """Education entry."""
    school: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class PersonBase(BaseModel):
    """Base person fields for create/update operations."""
    name: str = Field(..., min_length=1, max_length=255, description="Full name")
    email: Optional[EmailStr] = Field(None, description="Email address (unique identifier when available)")
    phone: Optional[str] = Field(None, max_length=50, description="Phone number")
    resume_url: Optional[str] = Field(None, description="URL to resume file")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")

    # Profile fields from LinkedIn/enrichment data
    headline: Optional[str] = Field(None, max_length=500, description="LinkedIn headline / professional tagline")
    summary: Optional[str] = Field(None, description="Professional summary / bio")
    current_title: Optional[str] = Field(None, max_length=255, description="Current job title")
    current_company: Optional[str] = Field(None, max_length=255, description="Current company name")
    location: Optional[str] = Field(None, max_length=255, description="Location (city, state/country)")
    skills: Optional[List[str]] = Field(default_factory=list, description="List of skills")
    work_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Work experience history")
    education: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Education history")
    years_experience: Optional[float] = Field(None, description="Estimated years of experience")

    # Raw enrichment data for reference
    enrichment_data: Optional[Dict[str, Any]] = Field(None, description="Raw enrichment data from source")


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

    # Profile fields
    headline: Optional[str] = Field(None, max_length=500)
    summary: Optional[str] = None
    current_title: Optional[str] = Field(None, max_length=255)
    current_company: Optional[str] = Field(None, max_length=255)
    location: Optional[str] = Field(None, max_length=255)
    skills: Optional[List[str]] = None
    work_history: Optional[List[Dict[str, Any]]] = None
    education: Optional[List[Dict[str, Any]]] = None
    years_experience: Optional[float] = None
    enrichment_data: Optional[Dict[str, Any]] = None


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
