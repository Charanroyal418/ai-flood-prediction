import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class RiverLevel(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("district.id"), nullable=False)
    river_name = Column(String, index=True, nullable=False)
    station_name = Column(String, nullable=False)
    current_level = Column(Float, nullable=False)
    danger_level = Column(Float, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
