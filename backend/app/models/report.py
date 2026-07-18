import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer, Uuid, JSON
from app.db.base_class import Base

class Report(Base):
    __tablename__ = "report"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    description = Column(String, nullable=False)
    water_depth = Column(Float, nullable=True)
    location_json = Column(JSON, nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow, index=True)
