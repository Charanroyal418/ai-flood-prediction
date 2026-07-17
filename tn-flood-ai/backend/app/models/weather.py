import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class Weather(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("district.id"), nullable=False)
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    pressure = Column(Float, nullable=True)
    status = Column(String, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

class Rainfall(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("district.id"), nullable=False)
    mm_per_hour = Column(Float, default=0.0)
    mm_24h = Column(Float, default=0.0)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
