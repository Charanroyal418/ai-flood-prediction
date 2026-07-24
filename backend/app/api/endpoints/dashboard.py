from typing import Any
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import random

from app.api import deps
from app.models.district import District
from app.models.history import PredictionHistory, WeatherHistory, ModelInference, KnowledgeGraphEvents
from app.models.alert import Alert
import json
import re
import os
from app.models.weather import Weather
from app.models.river import RiverLevel

router = APIRouter()

@router.get("/live")
def get_dashboard_live(db: Session = Depends(deps.get_db)) -> Any:
    """
    Unified live data endpoint for the dashboard.
    Returns real-time data from the GDNN inference and weather ETL.
    """
    now = datetime.now(timezone.utc)
    
    # Get latest inference metrics
    inf = db.query(ModelInference).order_by(ModelInference.created_at.desc()).first()
    last_updated_ts = inf.created_at.isoformat() if inf else now.isoformat()
    
    # Get all districts
    districts = db.query(District).all()
    
    # Get latest predictions per district
    # Using a subquery or just fetching latest 500 and grouping by district
    all_preds = db.query(PredictionHistory).order_by(PredictionHistory.created_at.desc()).limit(200).all()
    pred_map = {}
    for p in all_preds:
        if p.district_id not in pred_map:
            pred_map[p.district_id] = p
            
    # Get latest weather per district
    all_weather = db.query(WeatherHistory).order_by(WeatherHistory.recorded_at.desc()).limit(200).all()
    weather_map = {}
    for w in all_weather:
        if w.district_id not in weather_map:
            weather_map[w.district_id] = w
            
    # Get latest river levels per district
    all_rivers = db.query(RiverLevel).order_by(RiverLevel.recorded_at.desc()).limit(200).all()
    river_map = {}
    for r in all_rivers:
        if r.district_id not in river_map:
            river_map[r.district_id] = r
            
    districts_with_risk = []
    for d in districts:
        p = pred_map.get(d.id)
        w = weather_map.get(d.id)
        
        if not p or not w:
            continue
            
        color = "#3b82f6"
        if p.current_risk_level in ["Critical", "Severe"]: color = "#ef4444"
        elif p.current_risk_level == "High": color = "#f97316"
        elif p.current_risk_level == "Moderate": color = "#f59e0b"
        elif p.current_risk_level == "Low": color = "#22c55e"
            
        lon, lat = 0.0, 0.0
        if d.geom_json and "coordinates" in d.geom_json:
            lon, lat = d.geom_json["coordinates"]
            
        river_level_m = 0
        river_danger_m = 5.0
        r_lvl = river_map.get(d.id)
        if r_lvl:
            river_level_m = r_lvl.current_level
            river_danger_m = r_lvl.danger_level
            
        districts_with_risk.append({
            "id": d.id,
            "name": d.name,
            "lat": lat,
            "lon": lon,
            "population": d.population,
            "risk_score": p.current_risk_score,
            "risk_level": "Critical" if p.current_risk_level == "Severe" else p.current_risk_level,
            "risk_color": color,
            "rainfall_mm": w.rainfall_mm,
            "humidity": w.humidity,
            "temperature": w.temperature,
            "pressure": w.pressure,
            "wind_speed": w.wind_speed,
            "river_level_m": river_level_m,
            "river_danger_m": river_danger_m,
            "flood_probability": p.current_risk_score / 100.0,
            "ai_confidence": p.confidence,
            "shap_values": p.shap_values,
        })
        
    districts_with_risk.sort(key=lambda x: x["risk_score"], reverse=True)
    
    critical = [d for d in districts_with_risk if d["risk_level"] in ["Critical", "Severe"]]
    high = [d for d in districts_with_risk if d["risk_level"] == "High"]
    avg_risk = sum(d["risk_score"] for d in districts_with_risk) / len(districts_with_risk) if districts_with_risk else 0
    avg_rainfall = sum(d["rainfall_mm"] for d in districts_with_risk) / len(districts_with_risk) if districts_with_risk else 0
    
    # Active alerts
    # An alert is considered active if the district is currently in a "Critical", "Severe", or "High" risk state.
    active_district_ids = {d["id"] for d in districts_with_risk if d["risk_level"] in ["Critical", "Severe", "High"]}
    active_alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(100).all()
    
    alerts_data = []
    seen_districts = set()
    for a in active_alerts:
        if a.district_id not in active_district_ids:
            continue
        if a.district_id in seen_districts:
            continue  # Only show the latest alert per active district
        seen_districts.add(a.district_id)
        
        d_name = next((d["name"] for d in districts_with_risk if d["id"] == a.district_id), "Unknown")
        
        # Extract rainfall from alert message if present (e.g. for simulated storms)
        match = re.search(r"due to ([\d.]+)mm rainfall", a.message)
        if match:
            rainfall_val = float(match.group(1))
        else:
            w = db.query(WeatherHistory).filter(WeatherHistory.district_id == a.district_id).order_by(WeatherHistory.recorded_at.desc()).first()
            rainfall_val = w.rainfall_mm if w else 0.0
        
        alerts_data.append({
            "id": f"alert-{a.id}",
            "district": d_name,
            "level": a.level,
            "severity": "Red" if a.level == "Critical" else "Orange",
            "message": a.message,
            "suggested_response": a.suggested_response,
            "created_at": a.created_at.isoformat(),
            "confidence": a.confidence if a.confidence is not None else 0.94,
            "rainfall_mm": rainfall_val,
        })
        
    # Latest Knowledge Graph Events
    kg_events = db.query(KnowledgeGraphEvents).order_by(KnowledgeGraphEvents.created_at.desc()).limit(10).all()
    events_data = []
    for evt in kg_events:
        d_name = next((d["name"] for d in districts_with_risk if d["id"] == evt.source_district_id), "Unknown")
        events_data.append({
            "id": f"kg-{evt.id}",
            "type": "kg_update",
            "district": d_name,
            "message": evt.description,
            "timestamp": evt.created_at.isoformat(),
            "risk_level": "High"
        })
    
    # 7-day Precipitation Forecast (State average)
    weekly_forecast = []
    
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
    forecast_file = os.path.join(data_dir, "state_forecast.json")
    if os.path.exists(forecast_file):
        try:
            with open(forecast_file, "r") as f:
                weekly_forecast = json.load(f)
        except Exception:
            pass
            
    if not weekly_forecast:
        # Graceful fallback if ETL hasn't run yet
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        today_idx = datetime.now().weekday()
        days_ordered = days[today_idx:] + days[:today_idx]
        for day in days_ordered:
            weekly_forecast.append({"day": day, "rainfall": 0.0})

    return {
        "status": "online",
        "timestamp": last_updated_ts,
        "metrics": {
            "avg_risk_score": round(avg_risk, 1),
            "active_alerts_count": len(alerts_data),
            "critical_districts": len(critical),
            "high_risk_districts": len(high),
            "avg_rainfall_24h_mm": round(avg_rainfall, 1),
            "districts_monitored": len(districts),
            "model_confidence": 0.94,
            "gdnn_inference_ms": inf.inference_time_ms if inf else 0,
            "kg_nodes": inf.node_count if inf else 0,
            "kg_edges": inf.edge_count if inf else 0,
        },
        "districts": districts_with_risk,
        "top_risk_districts": districts_with_risk[:5],
        "alerts": alerts_data,
        "events": events_data,
        "weekly_forecast": weekly_forecast,
    }

@router.get("/districts")
def get_all_districts(db: Session = Depends(deps.get_db)) -> Any:
    return get_dashboard_live(db)["districts"]

@router.get("/alerts")
def get_all_alerts(db: Session = Depends(deps.get_db)) -> Any:
    return get_dashboard_live(db)["alerts"]

@router.post("/simulate-storm")
def simulate_storm_event(db: Session = Depends(deps.get_db)) -> Any:
    """Manually trigger the orchestrator with heavy storm simulation."""
    from app.services.orchestrator import RealtimeOrchestrator
    orchestrator = RealtimeOrchestrator(db)
    orchestrator.run_pipeline(simulate_storm=True)
    return {"status": "success", "message": "Heavy storm simulated successfully."}

@router.get("/history")
def get_historical_flood_events() -> Any:
    """Returns major historical flood events in Tamil Nadu (1985-2023)."""
    return [
        {
            "year": "2023",
            "event": "Cyclone Michaung Floods",
            "severity": "Extreme",
            "affected_districts": ["Chennai", "Thiruvallur", "Kancheepuram", "Chengalpattu"],
            "affected_people": 4500000,
            "deaths": 17,
            "damage_cr": 9500
        },
        {
            "year": "2021",
            "event": "Northeast Monsoon Flash Floods",
            "severity": "High",
            "affected_districts": ["Chennai", "Cuddalore", "Thanjavur", "Nagapattinam"],
            "affected_people": 1200000,
            "deaths": 14,
            "damage_cr": 1500
        },
        {
            "year": "2015",
            "event": "South Indian Floods (Chennai)",
            "severity": "Extreme",
            "affected_districts": ["Chennai", "Kancheepuram", "Cuddalore", "Thiruvallur", "Thanjavur"],
            "affected_people": 8200000,
            "deaths": 470,
            "damage_cr": 22000
        },
        {
            "year": "2020",
            "event": "Cyclone Nivar",
            "severity": "Moderate",
            "affected_districts": ["Cuddalore", "Villupuram", "Chennai"],
            "affected_people": 650000,
            "deaths": 4,
            "damage_cr": 600
        },
        {
            "year": "2018",
            "event": "Cyclone Gaja Floods",
            "severity": "High",
            "affected_districts": ["Nagapattinam", "Thanjavur", "Tiruvarur", "Pudukkottai"],
            "affected_people": 1500000,
            "deaths": 45,
            "damage_cr": 5400
        },
        {
            "year": "2005",
            "event": "Tamil Nadu Monsoon Floods",
            "severity": "High",
            "affected_districts": ["Chennai", "Cuddalore", "Tiruchirappalli", "Madurai"],
            "affected_people": 2500000,
            "deaths": 120,
            "damage_cr": 3500
        },
    ]

@router.get("/river")
def get_river_levels(db: Session = Depends(deps.get_db)) -> Any:
    """Returns real-time river levels for TN's major rivers."""
    # Group by station to get latest levels
    from sqlalchemy import func
    
    subquery = db.query(
        RiverLevel.station_name,
        func.max(RiverLevel.recorded_at).label('max_date')
    ).group_by(RiverLevel.station_name).subquery()
    
    latest_levels = db.query(RiverLevel).join(
        subquery,
        (RiverLevel.station_name == subquery.c.station_name) & 
        (RiverLevel.recorded_at == subquery.c.max_date)
    ).all()
    
    rivers_data = []
    for r in latest_levels:
        danger_m = r.danger_level
        current_m = r.current_level
        
        overflow_pct = round((current_m / danger_m) * 100) if danger_m > 0 else 0
        
        if overflow_pct >= 95:
            status = "Critical"
        elif overflow_pct >= 80:
            status = "Warning"
        else:
            status = "Normal"
            
        rivers_data.append({
            "name": r.river_name,
            "station": r.station_name,
            "current_m": round(current_m, 2),
            "danger_m": danger_m,
            "overflow_pct": overflow_pct,
            "status": status,
            "timestamp": r.recorded_at.isoformat()
        })
        
    return rivers_data
