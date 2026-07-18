import uuid
from datetime import datetime
from sqlalchemy import Column, Float, DateTime, ForeignKey, Integer, Uuid, JSON
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class DistrictPrediction(Base):
    __tablename__ = "district_predictions"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    risk_score = Column(Float, nullable=False) # 0 to 100
    probability = Column(Float, nullable=False) # 0 to 1
    explanation = Column(JSON, nullable=True) # SHAP explanation like {"Heavy Rain": 0.32}
    predicted_at = Column(DateTime, default=datetime.utcnow, index=True)
    target_time = Column(DateTime, nullable=False) # The future time this prediction is for

    district = relationship("District", back_populates="predictions")
