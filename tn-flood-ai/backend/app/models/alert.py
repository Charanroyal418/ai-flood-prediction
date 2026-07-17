from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id", ondelete="CASCADE"), nullable=False, index=True)
    
    severity = Column(String(50), nullable=False) # Moderate, High, Severe
    message = Column(String(500), nullable=False)
    source = Column(String(50), nullable=False) # AI_PREDICTION, RIVER_MONITOR, RAINFALL_MONITOR
    
    # Context
    trigger_data = Column(JSON, nullable=True) # E.g., {"rainfall_24h": 250, "threshold": 200}
    
    # Lifecycle
    is_active = Column(Boolean, default=True, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    district = relationship("District", backref="alerts")
