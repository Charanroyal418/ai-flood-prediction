import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Uuid, JSON
from app.db.base_class import Base

class Shelter(Base):
    __tablename__ = "shelters"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    name = Column(String, nullable=False)
    capacity = Column(Integer, nullable=True)
    geom_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Hospital(Base):
    __tablename__ = "hospitals"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    name = Column(String, nullable=False)
    geom_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
