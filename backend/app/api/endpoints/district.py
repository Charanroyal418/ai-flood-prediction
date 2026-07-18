from fastapi import APIRouter, HTTPException
from typing import Any
import random
from datetime import datetime, timedelta, timezone
from app.api.endpoints.dashboard import TN_DISTRICTS, _compute_risk

router = APIRouter()

@router.get("/{district_id}")
def get_district_details(district_id: int) -> Any:
    """Get rich analytics and drill-down data for a specific district."""
    district_base = next((d for d in TN_DISTRICTS if d["id"] == district_id), None)
    if not district_base:
        raise HTTPException(status_code=404, detail="District not found")
        
    # Get live risk computations
    district = _compute_risk(district_base)
    now = datetime.now(timezone.utc)
    rng = random.Random(district_id)
    
    # 1. Prediction History (last 24 hours)
    history = []
    base_score = district["risk_score"]
    for i in range(24, -1, -1):
        dt = now - timedelta(hours=i)
        # Add some perlin-like noise
        noise = rng.uniform(-15, 15)
        hist_score = max(5, min(99, base_score + noise))
        history.append({
            "timestamp": dt.isoformat(),
            "risk_score": round(hist_score, 1),
            "rainfall_mm": round(max(0, district["rainfall_mm"] + rng.uniform(-20, 20)), 1),
            "river_level_m": round(max(0.5, district["river_level_m"] + rng.uniform(-1, 1)), 2),
        })
        
    # 2. Forecast (next 48 hours)
    forecast = []
    for i in range(1, 49):
        dt = now + timedelta(hours=i)
        trend = (i / 48) * rng.uniform(-20, 30) # Trending up or down over time
        fut_score = max(5, min(99, base_score + trend))
        forecast.append({
            "timestamp": dt.isoformat(),
            "risk_score": round(fut_score, 1),
            "rainfall_mm": round(max(0, district["rainfall_mm"] + trend * 0.5), 1),
        })
        
    # 3. Localized Historical Floods
    historical_floods = [
        {"year": 2015, "event": "Chennai Catastrophic Floods", "severity": "Extreme", "damage_cr": rng.randint(500, 15000)},
        {"year": 2021, "event": "Cyclone Nivar", "severity": "High", "damage_cr": rng.randint(100, 1000)},
        {"year": 2023, "event": "Cyclone Michaung", "severity": "Extreme", "damage_cr": rng.randint(300, 5000)},
    ] if district.get("coastal") else [
        {"year": 2005, "event": "North East Monsoon Floods", "severity": "High", "damage_cr": rng.randint(100, 500)},
        {"year": 2018, "event": "Flash Floods", "severity": "Moderate", "damage_cr": rng.randint(10, 100)},
    ]
    
    # 4. Localized Knowledge Graph Fragment
    kg_fragment = {
        "nodes": [
            {"id": f"d_{district_id}", "label": district["name"], "type": "district", "risk_score": district["risk_score"]},
            {"id": f"r_1", "label": "Major River", "type": "river", "risk_score": rng.uniform(20, 90)},
            {"id": f"s_1", "label": f"{district['name']} Sensor Array", "type": "weather_station", "risk_score": 0},
            {"id": f"res_1", "label": "Upstream Reservoir", "type": "reservoir", "risk_score": rng.uniform(10, 60)},
        ],
        "edges": [
            {"source": "r_1", "target": f"d_{district_id}", "type": "flows_through", "animated": True},
            {"source": "s_1", "target": f"d_{district_id}", "type": "monitors"},
            {"source": "res_1", "target": "r_1", "type": "feeds_into"},
        ]
    }
    
    return {
        **district,
        "history": history,
        "forecast": forecast,
        "historical_floods": historical_floods,
        "kg_fragment": kg_fragment,
        "demographics": {
            "population": district["population"],
            "area_km2": district["area_km2"],
            "density": round(district["population"] / district["area_km2"]),
            "vulnerable_population": round(district["population"] * rng.uniform(0.1, 0.4)),
            "shelters_available": rng.randint(10, 150)
        }
    }
