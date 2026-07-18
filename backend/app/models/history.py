from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.db.base_class import Base

class WeatherHistory(Base):
    __tablename__ = "weather_history"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"))
    temperature = Column(Float)
    humidity = Column(Float)
    pressure = Column(Float)
    rainfall_mm = Column(Float)
    wind_speed = Column(Float)
    wind_direction = Column(Integer)
    cloud_cover = Column(Float)
    weather_code = Column(Integer)
    rain_probability = Column(Float)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    district = relationship("District")

class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"))
    
    # Current state
    current_risk_score = Column(Float)
    current_risk_level = Column(String)
    
    # Multi-horizon forecast probabilities (0.0 to 1.0)
    forecast_1h = Column(Float)
    forecast_3h = Column(Float)
    forecast_6h = Column(Float)
    forecast_12h = Column(Float)
    forecast_24h = Column(Float)
    
    confidence = Column(Float)
    
    # SHAP Contributions (Stored as JSON)
    shap_values = Column(JSON)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    district = relationship("District", back_populates="predictions")

class ModelInference(Base):
    __tablename__ = "model_inference"

    id = Column(Integer, primary_key=True, index=True)
    inference_time_ms = Column(Float)
    node_count = Column(Integer)
    edge_count = Column(Integer)
    attention_scores = Column(JSON) # Aggregated attention graph
    latency_ms = Column(Float)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class KnowledgeGraphEvents(Base):
    __tablename__ = "knowledge_graph_events"

    id = Column(Integer, primary_key=True, index=True)
    source_district_id = Column(Integer, ForeignKey("districts.id"))
    target_district_id = Column(Integer, ForeignKey("districts.id"))
    event_type = Column(String) # e.g. "PROPAGATION"
    influence_weight = Column(Float)
    description = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
