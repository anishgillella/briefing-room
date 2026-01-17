"""
Authentication router for signup, login, and user info.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime
import logging

from models.auth import (
    SignupRequest, LoginRequest, AuthResponse,
    RecruiterInfo, OrganizationInfo, CurrentUser,
    ChangePasswordRequest
)
from services.auth_service import (
    hash_password, verify_password, create_access_token
)
from middleware.auth_middleware import get_current_user
from db.client import get_db


logger = logging.getLogger(__name__)

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

    # Find organization by slug
    org_result = db.table("organizations")\
        .select("*")\
        .eq("slug", request.organization_slug)\
        .execute()

    if not org_result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization '{request.organization_slug}' not found"
        )

    org = org_result.data[0]

    # Check if email already exists in this org
    existing_result = db.table("recruiters")\
        .select("id")\
        .eq("email", request.email.lower())\
        .eq("organization_id", org["id"])\
        .execute()

    if existing_result.data:
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
        "organization_id": org["id"],
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

    logger.info(f"New recruiter signed up: {recruiter['email']} in org {org['slug']}")

    # Create JWT token
    token = create_access_token(
        recruiter_id=recruiter["id"],
        organization_id=org["id"],
        email=recruiter["email"],
        role=recruiter["role"],
        name=recruiter["name"]
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
            id=org["id"],
            name=org["name"],
            slug=org["slug"]
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

    logger.info(f"Recruiter logged in: {recruiter['email']}")

    # Create JWT token
    token = create_access_token(
        recruiter_id=recruiter["id"],
        organization_id=recruiter["organization_id"],
        email=recruiter["email"],
        role=recruiter["role"],
        name=recruiter["name"]
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
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter not found"
        )

    return RecruiterInfo(**result.data[0])


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Change the current user's password.
    """
    db = get_db()

    # Get current recruiter with password hash
    result = db.table("recruiters")\
        .select("password_hash")\
        .eq("id", str(current_user.recruiter_id))\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter not found"
        )

    # Verify current password
    if not verify_password(request.current_password, result.data[0]["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Hash and update new password
    new_hash = hash_password(request.new_password)

    db.table("recruiters")\
        .update({
            "password_hash": new_hash,
            "updated_at": datetime.utcnow().isoformat()
        })\
        .eq("id", str(current_user.recruiter_id))\
        .execute()

    logger.info(f"Password changed for recruiter: {current_user.email}")

    return {"message": "Password changed successfully"}


@router.post("/logout")
async def logout():
    """
    Logout endpoint (client-side token removal).

    JWT tokens are stateless, so logout is handled client-side
    by removing the token from storage. This endpoint exists
    for API completeness and future server-side session invalidation.
    """
    return {"message": "Logout successful. Please remove token from client storage."}
