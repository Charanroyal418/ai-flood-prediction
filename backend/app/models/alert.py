import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Uuid, Float
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    level = Column(String, nullable=False) # e.g. 'Critical', 'Warning'
    severity = Column(String, nullable=False) # e.g. 'Extreme', 'High'
    message = Column(String, nullable=False)
    confidence = Column(Float, nullable=True)
    expected_time = Column(DateTime, nullable=True)
    suggested_response = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    district = relationship("District", back_populates="alerts")
