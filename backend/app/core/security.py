"""
Security module — JWT + bcrypt
================================
Handles password hashing and JWT token creation/verification.

Uses bcrypt directly (not via passlib) for Python 3.13 compatibility.
passlib[bcrypt] has known issues with bcrypt >= 4.0 on Python 3.13.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union
import logging

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

_ENCODING = "utf-8"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode(_ENCODING),
            hashed_password.encode(_ENCODING),
        )
    except Exception as e:
        logger.warning(f"[Security] Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt with salt rounds=12."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode(_ENCODING), salt)
    return hashed.decode(_ENCODING)


def create_access_token(
    subject: Union[str, Any],
    role: str = "Viewer",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
        "type": "access",
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Union[str, Any], role: str = "Viewer") -> str:
    """Create a JWT refresh token with longer expiry."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
        "type": "refresh",
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT token.
    Returns the payload dict or None if invalid/expired.
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError as e:
        logger.warning(f"[Security] JWT validation failed: {e}")
        return None
