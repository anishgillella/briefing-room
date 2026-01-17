"""
Authentication models for signup, login, and JWT tokens.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class SignupRequest(BaseModel):
    """Request body for recruiter signup."""
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    organization_slug: Optional[str] = "demo"  # Default org for MVP


class LoginRequest(BaseModel):
    """Request body for recruiter login."""
    email: EmailStr
    password: str


class TokenPayload(BaseModel):
    """JWT token payload structure."""
    recruiter_id: str
    organization_id: str
    email: str
    role: str
    exp: datetime


class RecruiterInfo(BaseModel):
    """Recruiter info returned after auth."""
    id: UUID
    name: str
    email: str
    role: str


class OrganizationInfo(BaseModel):
    """Organization info returned after auth."""
    id: UUID
    name: str
    slug: str


class AuthResponse(BaseModel):
    """Response after successful login/signup."""
    token: str
    recruiter: RecruiterInfo
    organization: OrganizationInfo


class CurrentUser(BaseModel):
    """Current authenticated user context."""
    recruiter_id: UUID
    organization_id: UUID
    email: str
    role: str
    name: str


class ChangePasswordRequest(BaseModel):
    """Request body for password change."""
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
