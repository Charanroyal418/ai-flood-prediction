"""
Users Management Endpoints (Admin-only)
-----------------------------------------
Full CRUD for user management.

Endpoints:
  GET    /users/           — List all users (paginated)
  GET    /users/{user_id}  — Get user by ID
  PUT    /users/{user_id}  — Update user (role, name, active status)
  DELETE /users/{user_id}  — Deactivate user
  POST   /users/{user_id}/reset-password — Admin password reset
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.core.security import get_password_hash
from app.models.user import User

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[str] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None


class PasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    phone: Optional[str]
    is_active: bool
    created_at: Optional[str]
    last_login: Optional[str]


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

VALID_ROLES = {"Admin", "Operator", "Viewer", "Collector", "Rescue"}


@router.get("/")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    _: dict = Depends(deps.require_admin),
):
    """List all users (Admin only). Supports pagination and role filtering."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)

    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "users": [_user_to_dict(u) for u in users],
    }


@router.get("/{user_id}")
def get_user(
    user_id: str,
    db: Session = Depends(deps.get_db),
    current_user: dict = Depends(deps.require_auth),
):
    """Get a specific user. Users can view their own profile; Admins can view any."""
    if current_user["sub"] != user_id and current_user.get("role") != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return _user_to_dict(user)


@router.put("/{user_id}")
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    db: Session = Depends(deps.get_db),
    _: dict = Depends(deps.require_admin),
):
    """Update user properties (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if payload.name:
        user.name = payload.name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.role:
        if payload.role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}",
            )
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return _user_to_dict(user)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(deps.get_db),
    current_user: dict = Depends(deps.require_admin),
):
    """Soft-delete a user (deactivates instead of hard delete). Admin only."""
    if current_user["sub"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.is_active = False
    db.commit()
    return {"message": f"User {user.name} has been deactivated."}


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: str,
    payload: PasswordResetRequest,
    db: Session = Depends(deps.get_db),
    _: dict = Depends(deps.require_admin),
):
    """Admin-initiated password reset for any user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return {"message": f"Password reset successful for {user.name}."}
