# Phase 2: Backend Authentication

## Status: PENDING

## Overview

This phase implements the backend authentication system with signup, login, and JWT-based session management. We'll add new Pydantic models, a dedicated auth router, and middleware for protected routes.

## Dependencies

Add to `requirements.txt`:

```
bcrypt>=4.0.0
PyJWT>=2.8.0
```

## File Structure

```
backend/
├── models/
│   └── auth.py              # Auth-related Pydantic models (NEW)
├── routers/
│   └── auth.py              # Auth endpoints (NEW)
├── services/
│   └── auth_service.py      # Password hashing, JWT utils (NEW)
├── middleware/
│   └── auth_middleware.py   # JWT validation middleware (NEW)
└── repositories/
    └── streamlined/
        └── recruiter_repo.py  # Update with auth methods
```

## Implementation

### 1. Auth Models (`backend/models/auth.py`)

```python
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


class AuthResponse(BaseModel):
    """Response after successful login/signup."""
    token: str
    recruiter: "RecruiterInfo"
    organization: "OrganizationInfo"


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


class CurrentUser(BaseModel):
    """Current authenticated user context."""
    recruiter_id: UUID
    organization_id: UUID
    email: str
    role: str


# For Pydantic v2 forward references
AuthResponse.model_rebuild()
```

### 2. Auth Service (`backend/services/auth_service.py`)

```python
"""
Authentication service for password hashing and JWT management.
"""

import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
import os

from models.auth import TokenPayload, CurrentUser


# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(
        password.encode('utf-8'),
        password_hash.encode('utf-8')
    )


def create_access_token(
    recruiter_id: str,
    organization_id: str,
    email: str,
    role: str
) -> str:
    """Create a JWT access token."""
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)

    payload = {
        "recruiter_id": recruiter_id,
        "organization_id": organization_id,
        "email": email,
        "role": role,
        "exp": expiration,
        "iat": datetime.utcnow()
    }

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[CurrentUser]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return CurrentUser(
            recruiter_id=payload["recruiter_id"],
            organization_id=payload["organization_id"],
            email=payload["email"],
            role=payload["role"]
        )
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
```

### 3. Auth Router (`backend/routers/auth.py`)

```python
"""
Authentication router for signup, login, and user info.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import Optional
from datetime import datetime

from models.auth import (
    SignupRequest, LoginRequest, AuthResponse,
    RecruiterInfo, OrganizationInfo, CurrentUser
)
from services.auth_service import (
    hash_password, verify_password, create_access_token
)
from repositories.streamlined.recruiter_repo import RecruiterRepository
from repositories.streamlined.organization_repo import OrganizationRepository
from middleware.auth_middleware import get_current_user
from db.client import get_db


router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest):
    """
    Register a new recruiter account.

    - Creates recruiter with hashed password
    - Links to organization (default: demo)
    - Returns JWT token
    """
    db = get_db()
    org_repo = OrganizationRepository()
    recruiter_repo = RecruiterRepository()

    # Find organization by slug
    org = org_repo.get_by_slug(request.organization_slug)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization '{request.organization_slug}' not found"
        )

    # Check if email already exists in this org
    existing = recruiter_repo.get_by_email_and_org(request.email, org.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered in this organization"
        )

    # Hash password and create recruiter
    password_hash = hash_password(request.password)

    recruiter_data = {
        "name": request.name,
        "email": request.email.lower(),
        "password_hash": password_hash,
        "organization_id": str(org.id),
        "role": "recruiter",
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }

    result = db.table("recruiters").insert(recruiter_data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create recruiter"
        )

    recruiter = result.data[0]

    # Create JWT token
    token = create_access_token(
        recruiter_id=recruiter["id"],
        organization_id=str(org.id),
        email=recruiter["email"],
        role=recruiter["role"]
    )

    return AuthResponse(
        token=token,
        recruiter=RecruiterInfo(
            id=recruiter["id"],
            name=recruiter["name"],
            email=recruiter["email"],
            role=recruiter["role"]
        ),
        organization=OrganizationInfo(
            id=org.id,
            name=org.name,
            slug=org.slug
        )
    )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Authenticate a recruiter and return JWT token.
    """
    db = get_db()

    # Find recruiter by email (across all orgs for login)
    result = db.table("recruiters")\
        .select("*, organizations(*)")\
        .eq("email", request.email.lower())\
        .eq("is_active", True)\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    recruiter = result.data[0]

    # Verify password
    if not recruiter.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not set up for password login. Please contact admin."
        )

    if not verify_password(request.password, recruiter["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Update last login
    db.table("recruiters")\
        .update({"last_login_at": datetime.utcnow().isoformat()})\
        .eq("id", recruiter["id"])\
        .execute()

    org = recruiter.get("organizations", {})

    # Create JWT token
    token = create_access_token(
        recruiter_id=recruiter["id"],
        organization_id=recruiter["organization_id"],
        email=recruiter["email"],
        role=recruiter["role"]
    )

    return AuthResponse(
        token=token,
        recruiter=RecruiterInfo(
            id=recruiter["id"],
            name=recruiter["name"],
            email=recruiter["email"],
            role=recruiter["role"]
        ),
        organization=OrganizationInfo(
            id=org.get("id"),
            name=org.get("name", "Unknown"),
            slug=org.get("slug", "unknown")
        )
    )


@router.get("/me", response_model=RecruiterInfo)
async def get_current_recruiter(current_user: CurrentUser = Depends(get_current_user)):
    """
    Get the currently authenticated recruiter's info.
    """
    db = get_db()

    result = db.table("recruiters")\
        .select("id, name, email, role")\
        .eq("id", str(current_user.recruiter_id))\
        .single()\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter not found"
        )

    return RecruiterInfo(**result.data)


@router.post("/logout")
async def logout():
    """
    Logout endpoint (client-side token removal).

    JWT tokens are stateless, so logout is handled client-side
    by removing the token from storage. This endpoint exists
    for API completeness and future server-side session invalidation.
    """
    return {"message": "Logout successful. Please remove token from client storage."}
```

### 4. Auth Middleware (`backend/middleware/auth_middleware.py`)

```python
"""
Authentication middleware for protected routes.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

from models.auth import CurrentUser
from services.auth_service import decode_access_token


# HTTP Bearer token extractor
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> CurrentUser:
    """
    Dependency to get the current authenticated user from JWT token.

    Usage:
        @router.get("/protected")
        async def protected_route(current_user: CurrentUser = Depends(get_current_user)):
            ...
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    user = decode_access_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[CurrentUser]:
    """
    Dependency for routes that work with or without authentication.
    Returns None if no valid token provided.
    """
    if not credentials:
        return None

    return decode_access_token(credentials.credentials)


def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """
    Dependency to require admin role.

    Usage:
        @router.delete("/dangerous")
        async def admin_only(current_user: CurrentUser = Depends(require_admin)):
            ...
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
```

### 5. Organization Repository (`backend/repositories/streamlined/organization_repo.py`)

```python
"""
Organization Repository - Database operations for Organization entities.
"""

from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from db.client import get_db


class Organization(BaseModel):
    """Organization model."""
    id: UUID
    name: str
    slug: str
    settings: dict = {}


class OrganizationRepository:
    """Repository for Organization database operations."""

    def __init__(self):
        self.client = get_db()
        self.table = "organizations"

    def get_by_id(self, org_id: UUID) -> Optional[Organization]:
        """Get organization by ID."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("id", str(org_id))\
            .execute()

        if not result.data:
            return None

        return Organization(**result.data[0])

    def get_by_slug(self, slug: str) -> Optional[Organization]:
        """Get organization by slug."""
        result = self.client.table(self.table)\
            .select("*")\
            .eq("slug", slug)\
            .execute()

        if not result.data:
            return None

        return Organization(**result.data[0])

    def create(self, name: str, slug: str) -> Organization:
        """Create a new organization."""
        data = {
            "name": name,
            "slug": slug,
            "settings": {}
        }

        result = self.client.table(self.table).insert(data).execute()

        if not result.data:
            raise Exception("Failed to create organization")

        return Organization(**result.data[0])
```

### 6. Update RecruiterRepository

Add these methods to `backend/repositories/streamlined/recruiter_repo.py`:

```python
def get_by_email_and_org(self, email: str, organization_id: UUID) -> Optional[Recruiter]:
    """Get a recruiter by email within a specific organization."""
    result = self.client.table(self.table)\
        .select("*")\
        .eq("email", email.lower())\
        .eq("organization_id", str(organization_id))\
        .execute()

    if not result.data:
        return None

    return self._parse_recruiter(result.data[0])


def get_by_email(self, email: str) -> Optional[Recruiter]:
    """Get a recruiter by email (across all orgs)."""
    result = self.client.table(self.table)\
        .select("*")\
        .eq("email", email.lower())\
        .execute()

    if not result.data:
        return None

    return self._parse_recruiter(result.data[0])


def update_last_login(self, recruiter_id: UUID) -> None:
    """Update the last login timestamp."""
    from datetime import datetime

    self.client.table(self.table)\
        .update({"last_login_at": datetime.utcnow().isoformat()})\
        .eq("id", str(recruiter_id))\
        .execute()
```

### 7. Register Auth Router in `main.py`

```python
# Add import
from routers.auth import router as auth_router

# Register router (add after other routers)
app.include_router(auth_router)
```

### 8. Add JWT_SECRET to Environment

Add to `.env`:

```bash
# Authentication
JWT_SECRET=your-super-secret-key-change-this-in-production
```

## API Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/signup` | POST | No | Register new recruiter |
| `/api/auth/login` | POST | No | Login and get JWT token |
| `/api/auth/me` | GET | Yes | Get current user info |
| `/api/auth/logout` | POST | No | Logout (client-side) |

## Request/Response Examples

### Signup

**Request:**
```json
POST /api/auth/signup
{
  "name": "John Doe",
  "email": "john@acme.com",
  "password": "securepassword123"
}
```

**Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "recruiter": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@acme.com",
    "role": "recruiter"
  },
  "organization": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Demo Organization",
    "slug": "demo"
  }
}
```

### Login

**Request:**
```json
POST /api/auth/login
{
  "email": "john@acme.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "recruiter": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@acme.com",
    "role": "recruiter"
  },
  "organization": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Demo Organization",
    "slug": "demo"
  }
}
```

### Using Protected Routes

```bash
# Include token in Authorization header
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  http://localhost:8000/api/auth/me
```

## Testing

```bash
# Test signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "testpass123"}'

# Test login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'

# Test protected route
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <token-from-login>"
```

## Next Phase

Once auth backend is complete, proceed to [Phase 3: Auth Frontend](./phase3-auth-frontend.md) to implement login/signup pages and AuthContext.
