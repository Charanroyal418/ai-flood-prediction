import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class User(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=True)
    role = Column(String, default="Citizen", nullable=False) # Citizen, Admin, Collector, Rescue
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
