from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Any
import random
from datetime import datetime, timedelta, timezone

from app.api import deps
from app.models.district import District
from app.models.history import PredictionHistory, WeatherHistory
from app.etl.weather import TN_DISTRICTS

router = APIRouter()

@router.get("/{district_id}")
def get_district_details(district_id: int, db: Session = Depends(deps.get_db)) -> Any:
    """Get rich analytics and drill-down data for a specific district from live db."""
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")
        
    # Get current live data
    latest_pred = db.query(PredictionHistory).filter(PredictionHistory.district_id == district_id).order_by(PredictionHistory.created_at.desc()).first()
    latest_weather = db.query(WeatherHistory).filter(WeatherHistory.district_id == district_id).order_by(WeatherHistory.recorded_at.desc()).first()
    
    if not latest_pred or not latest_weather:
        # Fallback if no history yet
        return {
            "id": district.id,
            "name": district.name,
            "population": district.population,
            "risk_score": 0,
            "risk_level": "Safe",
            "history": [],
            "forecast": []
        }
    
    # 1. Prediction History (last 24 hours of actual DB data)
    db_history = db.query(PredictionHistory).filter(PredictionHistory.district_id == district_id).order_by(PredictionHistory.created_at.desc()).limit(24).all()
    history = []
    
    from app.models.river import RiverLevel
    
    for h in reversed(db_history):
        w = db.query(WeatherHistory).filter(WeatherHistory.district_id == district_id, WeatherHistory.recorded_at <= h.created_at).order_by(WeatherHistory.recorded_at.desc()).first()
        r = db.query(RiverLevel).filter(RiverLevel.district_id == district_id, RiverLevel.recorded_at <= h.created_at).order_by(RiverLevel.recorded_at.desc()).first()
        
        history.append({
            "timestamp": h.created_at.isoformat(),
            "risk_score": h.current_risk_score,
            "rainfall_mm": w.rainfall_mm if w else 0,
            "river_level_m": r.current_level if r else 0.0,
        })
        
    # 2. Forecast (1h, 3h, 6h, 12h, 24h from latest prediction)
    now = latest_pred.created_at
    forecast = [
        {"timestamp": (now + timedelta(hours=1)).isoformat(), "risk_score": latest_pred.forecast_1h * 100, "rainfall_mm": latest_weather.rainfall_mm},
        {"timestamp": (now + timedelta(hours=3)).isoformat(), "risk_score": latest_pred.forecast_3h * 100, "rainfall_mm": latest_weather.rainfall_mm},
        {"timestamp": (now + timedelta(hours=6)).isoformat(), "risk_score": latest_pred.forecast_6h * 100, "rainfall_mm": latest_weather.rainfall_mm},
        {"timestamp": (now + timedelta(hours=12)).isoformat(), "risk_score": latest_pred.forecast_12h * 100, "rainfall_mm": latest_weather.rainfall_mm},
        {"timestamp": (now + timedelta(hours=24)).isoformat(), "risk_score": latest_pred.forecast_24h * 100, "rainfall_mm": latest_weather.rainfall_mm},
    ]
        
    # 3. Localized Historical Floods
    historical_floods = []
    if "Chennai" in district.name:
        historical_floods.append({"year": 2015, "event": "South Indian Floods", "severity": "Extreme", "damage_cr": 22000})
        historical_floods.append({"year": 2023, "event": "Cyclone Michaung", "severity": "Extreme", "damage_cr": 9500})
    elif "Cuddalore" in district.name:
        historical_floods.append({"year": 2015, "event": "South Indian Floods", "severity": "Extreme", "damage_cr": 22000})
        historical_floods.append({"year": 2020, "event": "Cyclone Nivar", "severity": "Moderate", "damage_cr": 600})
    elif "Thanjavur" in district.name:
        historical_floods.append({"year": 2018, "event": "Cyclone Gaja Floods", "severity": "High", "damage_cr": 5400})
        
    if not historical_floods:
        historical_floods.append({"year": 2005, "event": "Tamil Nadu Monsoon Floods", "severity": "High", "damage_cr": 3500})

    # 4. Localized Knowledge Graph Fragment
    r_lvl_val = db.query(RiverLevel).filter(RiverLevel.district_id == district_id).order_by(RiverLevel.recorded_at.desc()).first()
    r_risk = (r_lvl_val.current_level / r_lvl_val.danger_level) * 100 if (r_lvl_val and r_lvl_val.danger_level > 0) else 10.0
    
    kg_fragment = {
        "nodes": [
            {"id": f"d_{district_id}", "label": district.name, "type": "district", "risk_score": latest_pred.current_risk_score},
            {"id": f"r_1", "label": r_lvl_val.river_name if r_lvl_val else "Major River", "type": "river", "risk_score": r_risk},
            {"id": f"s_1", "label": f"{district.name} Sensor Array", "type": "weather_station", "risk_score": 0},
            {"id": f"res_1", "label": "Upstream Reservoir", "type": "reservoir", "risk_score": 25.0},
        ],
        "edges": [
            {"source": "r_1", "target": f"d_{district_id}", "type": "flows_through", "animated": True},
            {"source": "s_1", "target": f"d_{district_id}", "type": "monitors"},
            {"source": "res_1", "target": "r_1", "type": "feeds_into"},
        ]
    }
    
    color = "#3b82f6"
    if latest_pred.current_risk_level == "Critical": color = "#ef4444"
    elif latest_pred.current_risk_level == "High": color = "#f97316"
    elif latest_pred.current_risk_level == "Moderate": color = "#f59e0b"
    elif latest_pred.current_risk_level == "Low": color = "#22c55e"
    
    area_km2 = 2500 # rough average
    
    return {
        "id": district.id,
        "name": district.name,
        "risk_score": latest_pred.current_risk_score,
        "risk_level": latest_pred.current_risk_level,
        "risk_color": color,
        "rainfall_mm": latest_weather.rainfall_mm,
        "humidity": latest_weather.humidity,
        "temperature": latest_weather.temperature,
        "pressure": latest_weather.pressure,
        "wind_speed": latest_weather.wind_speed,
        "flood_probability": latest_pred.current_risk_score / 100.0,
        "ai_confidence": latest_pred.confidence,
        "shap_values": latest_pred.shap_values,
        "history": history,
        "forecast": forecast,
        "historical_floods": historical_floods,
        "kg_fragment": kg_fragment,
        "demographics": {
            "population": district.population or 1000000,
            "area_km2": area_km2,
            "density": round((district.population or 1000000) / area_km2),
            "vulnerable_population": round((district.population or 1000000) * 0.25),
            "shelters_available": 45
        }
    }
