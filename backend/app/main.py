from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager

import app.db.base # Ensure all models are registered

from app.core.config import settings
from app.api.api import api_router
from app.core.exceptions import http_exception_handler, validation_exception_handler
from app.scheduler.manager import init_scheduler, shutdown_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_scheduler()
    yield
    # Shutdown
    shutdown_scheduler()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Backend API for FloodSense AI Platform",
    version="1.0.0"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

app.include_router(api_router, prefix=settings.API_V1_STR)
