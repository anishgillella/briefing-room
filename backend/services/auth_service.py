"""
Authentication service for password hashing and JWT management.
"""

import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
import os
from pathlib import Path

# Load environment variables
from dotenv import load_dotenv
load_dotenv()
parent_env = Path(__file__).parent.parent.parent / ".env"
if parent_env.exists():
    load_dotenv(parent_env)

from models.auth import CurrentUser


# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "briefing-room-secret-key-change-in-production-2024")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    try:
        return bcrypt.checkpw(
            password.encode('utf-8'),
            password_hash.encode('utf-8')
        )
    except Exception:
        return False


def create_access_token(
    recruiter_id: str,
    organization_id: str,
    email: str,
    role: str,
    name: str
) -> str:
    """Create a JWT access token."""
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)

    payload = {
        "recruiter_id": recruiter_id,
        "organization_id": organization_id,
        "email": email,
        "role": role,
        "name": name,
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
            role=payload["role"],
            name=payload.get("name", "")
        )
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None
