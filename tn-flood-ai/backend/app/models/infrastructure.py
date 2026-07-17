import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class Road(Base):
    __tablename__ = "roads"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    type = Column(String, nullable=True)
    geom = Column(Geometry('LINESTRING', srid=4326), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Building(Base):
    __tablename__ = "buildings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    type = Column(String, nullable=True)
    geom = Column(Geometry('POLYGON', srid=4326), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
