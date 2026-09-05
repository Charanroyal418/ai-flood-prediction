from fastapi import APIRouter
from app.api.endpoints import (
    health,
    auth,
    users,
    spatial,
    ml,
    dashboard,
    system,
    predict,
    admin,
    kg,
    district,
    ws,
    inference_cycle,
    performance,
)

api_router = APIRouter()

# ── Public ───────────────────────────────────────────────────────────────────
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])

# ── Spatial & Data ───────────────────────────────────────────────────────────
api_router.include_router(spatial.router, prefix="/spatial", tags=["spatial"])
api_router.include_router(district.router, prefix="/district", tags=["district"])

# ── ML & Predictions ─────────────────────────────────────────────────────────
api_router.include_router(ml.router, prefix="/ml", tags=["machine_learning"])
api_router.include_router(predict.router, prefix="/predict", tags=["prediction"])
api_router.include_router(inference_cycle.router, prefix="/predict", tags=["prediction"])

# ── Dashboard ────────────────────────────────────────────────────────────────
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(performance.router, prefix="/performance", tags=["performance"])

# ── Knowledge Graph ──────────────────────────────────────────────────────────
api_router.include_router(kg.router, prefix="/kg", tags=["knowledge_graph"])

# ── System & Admin ───────────────────────────────────────────────────────────
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(users.router, prefix="/users", tags=["users"])

# ── WebSocket ────────────────────────────────────────────────────────────────
api_router.include_router(ws.router, prefix="/ws", tags=["websocket"])

# ── Direct Endpoint Aliases for Global API Audit ────────────────────────────
from fastapi import Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.api import deps

@api_router.get("/weather", tags=["weather"])
def get_weather(db: Session = Depends(deps.get_db)):
    """Returns real-time weather data across districts."""
    live = dashboard.get_dashboard_live(db)
    return {
        "success": True,
        "data": {
            "districts": live.get("districts", []),
            "weekly_forecast": live.get("weekly_forecast", []),
            "avg_rainfall_24h_mm": live.get("metrics", {}).get("avg_rainfall_24h_mm", 0),
        },
        "districts": live.get("districts", []),
        "weekly_forecast": live.get("weekly_forecast", []),
        "avg_rainfall_24h_mm": live.get("metrics", {}).get("avg_rainfall_24h_mm", 0),
    }

@api_router.get("/rivers", tags=["rivers"])
@api_router.get("/river", tags=["rivers"])
def get_rivers(db: Session = Depends(deps.get_db)):
    """Returns real-time river levels across gauging stations."""
    return dashboard.get_river_levels(db)

@api_router.get("/districts", tags=["districts"])
def get_districts(db: Session = Depends(deps.get_db)):
    """Returns all districts with telemetry and risk scores."""
    return dashboard.get_all_districts(db)

@api_router.get("/alerts", tags=["alerts"])
def get_alerts(db: Session = Depends(deps.get_db)):
    """Returns active district flood alerts."""
    return dashboard.get_all_alerts(db)

@api_router.get("/predictions", tags=["predictions"])
def get_predictions(background_tasks: BackgroundTasks = BackgroundTasks()):
    """Returns real-time AI prediction telemetry across all districts."""
    return dashboard.get_dashboard_predictions(background_tasks)

@api_router.get("/history", tags=["history"])
def get_history():
    """Returns historical flood event records."""
    return dashboard.get_historical_flood_events()
