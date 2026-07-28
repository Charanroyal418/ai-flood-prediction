"""
User model — SQLite/PostgreSQL compatible
==========================================
Uses String for primary key (UUID stored as string) for SQLite compatibility.
In production with PostgreSQL, this works seamlessly since UUID values are
still generated via Python's uuid module.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean
from app.db.base_class import Base


class User(Base):
    __tablename__ = "users"

    # Use String for cross-DB compatibility (works on SQLite + PostgreSQL)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    # Roles: Admin, Operator, Viewer, Collector, Rescue
    role = Column(String(50), default="Viewer", nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_login = Column(DateTime(timezone=True), nullable=True)
