"""
FloodSense AI — FastAPI Application Entry Point
================================================
Production-grade FastAPI setup with:
- Configurable CORS (not wildcard in production)
- Request ID middleware for tracing
- Proper lifespan (APScheduler init/shutdown)
- Centralized exception handlers
- OpenAPI documentation
"""
import time
import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError

import app.db.base  # Ensure all models are registered before engine binds

from app.core.config import settings
from app.api.api import api_router
from app.core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    global_exception_handler,
)
from app.scheduler.manager import init_scheduler, shutdown_scheduler
from app.db.session import engine, SessionLocal
from app.db.base_class import Base
from app.models.district import District
from scripts.seed_db import seed_districts, seed_users, seed_facilities_and_rivers

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup → yield → shutdown."""
    logger.info(f"[FloodSense] Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info(f"[FloodSense] Environment: {settings.ENVIRONMENT}")
    logger.info(f"[FloodSense] Database: {settings.DATABASE_URL[:40]}...")
    
    import asyncio
    
    def background_init():
        # Auto-initialize database on startup (Needed for Docker / Ephemeral environments)
        logger.info("[FloodSense] Verifying database schema...")
        Base.metadata.create_all(bind=engine)
        
        db = SessionLocal()
        try:
            from sqlalchemy import text, inspect
            # Auto-migration for existing Render database that misses elevation_m or community_idx
            bind = db.get_bind()
            if bind.dialect.name == "sqlite":
                inspector = inspect(bind)
                table_names = inspector.get_table_names()
                dist_cols = [c["name"] for c in inspector.get_columns("districts")] if "districts" in table_names else []
                weather_cols = [c["name"] for c in inspector.get_columns("weather")] if "weather" in table_names else []
                if "elevation_m" not in dist_cols:
                    db.execute(text("ALTER TABLE districts ADD COLUMN elevation_m FLOAT;"))
                if "community_idx" not in dist_cols:
                    db.execute(text("ALTER TABLE districts ADD COLUMN community_idx INTEGER DEFAULT 0;"))
                if "wind_speed" not in weather_cols:
                    db.execute(text("ALTER TABLE weather ADD COLUMN wind_speed FLOAT;"))
                if "rainfall_mm" not in weather_cols:
                    db.execute(text("ALTER TABLE weather ADD COLUMN rainfall_mm FLOAT;"))
            else:
                db.execute(text("ALTER TABLE districts ADD COLUMN IF NOT EXISTS elevation_m FLOAT;"))
                db.execute(text("ALTER TABLE districts ADD COLUMN IF NOT EXISTS community_idx INTEGER DEFAULT 0;"))
                db.execute(text("ALTER TABLE weather ADD COLUMN IF NOT EXISTS wind_speed FLOAT;"))
                db.execute(text("ALTER TABLE weather ADD COLUMN IF NOT EXISTS rainfall_mm FLOAT;"))
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"[FloodSense] Raw SQL schema update skipped or failed: {e}")
        finally:
            db.close()
            
        db = SessionLocal()
        try:
            if db.query(District).count() == 0:
                logger.info("[FloodSense] Database is empty. Seeding initial data...")
                from scripts.seed_db import seed_districts, seed_users, seed_facilities_and_rivers, seed_alerts
                seed_districts(db)
                seed_users(db)
                seed_facilities_and_rivers(db)
                seed_alerts(db)
                logger.info("[FloodSense] Seeding completed.")
        except Exception as e:
            logger.error(f"[FloodSense] Error during database initialization: {e}")
        finally:
            db.close()

        app.state.is_ready = True
        logger.info("[FloodSense] Application is fully initialized and ready.")

        # Ensure application always starts in LIVE TELEMETRY mode (Simulation = OFF)
        db = SessionLocal()
        try:
            from app.services.orchestrator import clear_simulation_state
            clear_simulation_state(db, reason="Startup: ensure nominal live mode")
            logger.info("[FloodSense] Initialized in LIVE mode (Simulation OFF).")
        except Exception as sim_init_err:
            logger.warning(f"[FloodSense] Startup simulation reset warning: {sim_init_err}")
        finally:
            db.close()
        try:
            init_scheduler()
        except Exception as e:
            logger.error(f"[FloodSense] Scheduler initialization warning: {e}")

    # Initialize app readiness flag
    app.state.is_ready = False
    
    # Run the heavy initialization in a background thread so the server binds immediately
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, background_init)
    
    yield
    logger.info("[FloodSense] Shutting down...")
    shutdown_scheduler()


# ── Application ──────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Real-Time AI Flood Prediction & Decision Support Platform for Tamil Nadu. "
        "Powered by Dynamic Knowledge Graphs, Graph Attention Networks (GAT), and Temporal GRU."
    ),
    version=settings.VERSION,
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    contact={
        "name": "FloodSense AI Research Team",
        "url": "https://github.com/Charanroyal418/ai-flood-prediction",
    },
    license_info={"name": "MIT"},
)


# ── CORS ─────────────────────────────────────────────────────────────────────
# Explicit production & preview origins — never wildcard together with credentials
import os
origins = [
    "https://ai-flood-prediction-lxjkk9a2i-charanroyal418s-projects.vercel.app",
    "https://ai-flood-prediction.vercel.app",
    "https://ai-flood-prediction-iota.vercel.app",  # FIX-BUG-002: deployed iota URL
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]
if os.getenv("NEXT_PUBLIC_FRONTEND_URL"):
    origins.append(os.getenv("NEXT_PUBLIC_FRONTEND_URL"))
if os.getenv("VERCEL_URL"):
    origins.append(f"https://{os.getenv('VERCEL_URL')}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)


# ── Request ID + Timing Middleware ───────────────────────────────────────────
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Attach a unique request ID and measure response time."""
    request_id = str(uuid.uuid4())[:8]
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{elapsed_ms:.1f}ms"
    return response


# ── Exception Handlers ───────────────────────────────────────────────────────
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)


# ── Routes ───────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router, prefix="", include_in_schema=False)


# ── Root Redirect & Health Alias ──────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health",
    }


@app.get("/health", include_in_schema=False)
async def root_health():
    return {"status": "online", "message": "FloodSense AI API is running seamlessly."}

