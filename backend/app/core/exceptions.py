from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError
from app.core.logging import logger

def _get_cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin", "")
    if origin:
        if (
            origin == "https://ai-flood-prediction-lxjkk9a2i-charanroyal418s-projects.vercel.app"
            or origin == "https://ai-flood-prediction.vercel.app"
            or origin.endswith(".vercel.app")
            or "localhost" in origin
            or "127.0.0.1" in origin
        ):
            return {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
            }
    return {}

async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.error(f"HTTP error occurred: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "message": exc.detail},
        headers=_get_cors_headers(request)
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"message": "Validation Error", "details": exc.errors()},
        headers=_get_cors_headers(request)
    )

async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Internal Server Error",
            "detail": str(exc)
        },
        headers=_get_cors_headers(request)
    )
