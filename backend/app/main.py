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
    
    # Auto-initialize database on startup (Needed for Docker / Ephemeral environments)
    logger.info("[FloodSense] Verifying database schema...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        if db.query(District).count() == 0:
            logger.info("[FloodSense] Database is empty. Seeding initial data...")
            seed_districts(db)
            seed_users(db)
            seed_facilities_and_rivers(db)
            logger.info("[FloodSense] Seeding completed.")
    except Exception as e:
        logger.error(f"[FloodSense] Error during database initialization: {e}")
    finally:
        db.close()

    init_scheduler()
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
# Use configurable origins — never wildcard in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins if settings.ENVIRONMENT == "production" else ["*"],
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


# ── Root Redirect ─────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health",
    }
