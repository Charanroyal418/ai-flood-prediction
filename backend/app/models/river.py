import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer, Uuid
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class RiverLevel(Base):
    __tablename__ = "river_levels"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    river_name = Column(String, index=True, nullable=False)
    station_name = Column(String, nullable=False)
    current_level = Column(Float, nullable=False)
    danger_level = Column(Float, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

    district = relationship("District", back_populates="rivers")
