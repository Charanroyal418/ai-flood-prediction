from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import joblib
import os
import pandas as pd
import numpy as np

from app.api import deps

router = APIRouter()

# Global model cache
MODEL_CACHE = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "artifacts", "flood_xgboost_v1.pkl")

def get_model():
    global MODEL_CACHE
    if MODEL_CACHE is None:
        if not os.path.exists(MODEL_PATH):
            print("Warning: ML Model artifact not found, falling back to heuristic simulation.")
            return None
        MODEL_CACHE = joblib.load(MODEL_PATH)
    return MODEL_CACHE

class PredictionRequest(BaseModel):
    lat: float
    lon: float
    rainfall_24h_mm: float
    elevation_m: float
    distance_to_river_m: float
    soil_moisture_index: float
    slope_degrees: float

class PredictionResponse(BaseModel):
    is_flooded: bool
    probability: float
    risk_level: str

@router.post("/predict", response_model=PredictionResponse)
def predict_flood_risk(
    req: PredictionRequest,
    db: Session = Depends(deps.get_db),
    # To restrict this to Collectors/Admins, we could add:
    # current_user = Depends(deps.get_current_active_user)
) -> Any:
    """
    Predict flood probability for a specific coordinate based on telemetry data.
    """
    model = get_model()
    
    # Prepare features identically to model_config.py FEATURES
    features = pd.DataFrame([{
        "elevation_m": req.elevation_m,
        "distance_to_river_m": req.distance_to_river_m,
        "rainfall_24h_mm": req.rainfall_24h_mm,
        "soil_moisture_index": req.soil_moisture_index,
        "slope_degrees": req.slope_degrees
    }])
    
    # Predict
    if model is not None:
        prob = model.predict_proba(features)[0][1] # Probability of class 1 (Flooded)
    else:
        # Heuristic fallback
        base_risk = req.rainfall_24h_mm / 300.0 + req.soil_moisture_index * 0.5
        reduction = req.elevation_m / 100.0 + req.distance_to_river_m / 10000.0
        prob = min(0.99, max(0.01, base_risk - reduction))
        
    is_flooded = prob > 0.6
    
    # Categorize Risk
    risk_level = "Low"
    if prob > 0.3:
        risk_level = "Moderate"
    if prob > 0.6:
        risk_level = "High"
    if prob > 0.8:
        risk_level = "Severe"
        
    return {
        "is_flooded": bool(is_flooded),
        "probability": float(round(prob * 100, 2)),
        "risk_level": risk_level
    }

@router.get("/trends")
def get_rainfall_trends(db: Session = Depends(deps.get_db)) -> Any:
    """
    Returns the average rainfall per day for the last 7 days across all districts.
    Replaces mock data with actual DB telemetry.
    """
    from sqlalchemy import func
    from app.models.history import WeatherHistory
    from datetime import datetime, timedelta
    
    # Get the last 7 days
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    
    # Query database for daily average rainfall
    results = (
        db.query(
            func.date(WeatherHistory.recorded_at).label("date"),
            func.avg(WeatherHistory.rainfall_mm).label("avg_rainfall")
        )
        .filter(WeatherHistory.recorded_at >= seven_days_ago)
        .group_by(func.date(WeatherHistory.recorded_at))
        .order_by(func.date(WeatherHistory.recorded_at).asc())
        .all()
    )
    
    trends = []
    # If no data, return real zeros, not mock spikes
    if not results:
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        today_idx = now.weekday()
        days_ordered = days[today_idx:] + days[:today_idx]
        for day in days_ordered:
            trends.append({"day": day, "rainfall": 0.0})
        return trends
        
    for res in results:
        day_str = res.date.strftime("%a")
        trends.append({
            "day": day_str,
            "rainfall": round(res.avg_rainfall, 1) if res.avg_rainfall else 0.0
        })
        
    return trends

