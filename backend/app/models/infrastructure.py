import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Uuid, JSON
from app.db.base_class import Base

class Road(Base):
    __tablename__ = "roads"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    type = Column(String, nullable=True)
    geom_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Building(Base):
    __tablename__ = "buildings"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    type = Column(String, nullable=True)
    geom_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
