from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class DistrictPrediction(Base):
    __tablename__ = "district_predictions"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Model Output
    risk_score = Column(Float, nullable=False) # 0-100
    risk_level = Column(String(50), nullable=False) # Very Low, Low, Moderate, High, Severe
    confidence = Column(Float, nullable=False) # 0-100
    probability = Column(Float, nullable=False) # 0.0 - 1.0
    
    # Explainability
    top_reasons = Column(JSON, nullable=False) # List of SHAP explanations
    
    # Recommendations
    recommended_actions = Column(JSON, nullable=False)
    
    # Audit
    model_version = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    district = relationship("District", backref="predictions")
