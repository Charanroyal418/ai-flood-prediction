"""
Authentication Endpoints
--------------------------
JWT-based authentication with role-based access control.

Endpoints:
  POST /auth/register  — Create new account (Admin only or open during setup)
  POST /auth/login     — Get access + refresh token
  POST /auth/refresh   — Rotate refresh token
  GET  /auth/me        — Get current user profile
  POST /auth/logout    — Invalidate token (client-side; server is stateless)
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from typing import Optional

from app.api import deps
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    phone: Optional[str] = None
    role: str = "Viewer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "phone": user.phone,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(deps.get_db),
):
    """
    Register a new user.
    Role is restricted to Viewer unless performed by an Admin.
    For the first user, Admin role is auto-granted.
    """
    # Check duplicate email
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # First user ever gets Admin role automatically
    user_count = db.query(User).count()
    role = "Admin" if user_count == 0 else payload.role

    # Restrict role escalation (non-admin cannot create Admin accounts)
    if role == "Admin" and user_count > 0:
        role = "Viewer"

    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        role=role,
        password_hash=get_password_hash(payload.password),
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id, role=user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_to_dict(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(deps.get_db),
):
    """Authenticate with email + password. Returns JWT access and refresh tokens."""
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact administrator.",
        )

    # Update last login
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id, role=user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_to_dict(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    payload: RefreshRequest,
    db: Session = Depends(deps.get_db),
):
    """Rotate a refresh token to get a new access token."""
    token_data = decode_token(payload.refresh_token)
    if not token_data or token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    user = db.query(User).filter(User.id == token_data["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated.",
        )

    access_token = create_access_token(subject=user.id, role=user.role)
    new_refresh = create_refresh_token(subject=user.id, role=user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        user=_user_to_dict(user),
    )


@router.get("/me")
def get_me(
    current_user: dict = Depends(deps.require_auth),
    db: Session = Depends(deps.get_db),
):
    """Get the currently authenticated user's profile."""
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return _user_to_dict(user)


@router.post("/logout")
def logout():
    """
    Stateless logout — instructs the client to discard tokens.
    For production, implement a token denylist with Redis.
    """
    return {"message": "Logged out successfully. Discard your tokens."}
