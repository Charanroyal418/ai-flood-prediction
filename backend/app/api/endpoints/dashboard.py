from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api import deps
from app.models.weather import Weather, Rainfall
from app.models.river import RiverLevel
from app.models.alert import Alert

router = APIRouter()

@router.get("/live")
def get_dashboard_live(db: Session = Depends(deps.get_db)) -> Any:
    """
    Unified God-Endpoint for Next.js Dashboard.
    Fetches the latest state of everything in a single optimized query sequence.
    """
    # 1. Latest Weather (Global average for state or specific to critical districts)
    latest_weather = db.query(Weather).order_by(desc(Weather.recorded_at)).limit(5).all()
    
    # 2. Latest River Levels
    rivers = db.query(RiverLevel).order_by(desc(RiverLevel.recorded_at)).limit(5).all()
    
    # 3. Active Alerts
    active_alerts = db.query(Alert).filter(Alert.is_active == True).order_by(desc(Alert.issued_at)).limit(5).all()
    
    # 4. Aggregated State Stats
    total_rainfall_24h = db.query(Rainfall).order_by(desc(Rainfall.recorded_at)).limit(10).all()
    avg_rainfall = sum([r.mm_24h for r in total_rainfall_24h]) / len(total_rainfall_24h) if total_rainfall_24h else 0
    
    return {
        "status": "online",
        "last_sync": latest_weather[0].recorded_at if latest_weather else None,
        "metrics": {
            "avg_rainfall_24h_mm": round(avg_rainfall, 2),
            "active_alerts_count": len(active_alerts)
        },
        "weather": latest_weather,
        "rivers": rivers,
        "alerts": active_alerts
    }
