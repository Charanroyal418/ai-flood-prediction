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
