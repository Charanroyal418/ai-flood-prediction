"""
FastAPI dependency injectors
"""
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.core.security import decode_token


def get_db() -> Generator:
    """Yield a SQLAlchemy database session with retry on OperationalError."""
    import time
    from sqlalchemy.exc import OperationalError
    
    retries = 3
    for attempt in range(retries):
        try:
            db = SessionLocal()
            yield db
            break
        except OperationalError:
            if attempt < retries - 1:
                time.sleep(0.5)
            else:
                raise
        finally:
            if 'db' in locals() and hasattr(db, 'close'):
                db.close()


# ── Optional JWT Auth ─────────────────────────────────────────────────────────
# Using optional bearer — unauthenticated requests still work (public dashboard),
# but admin routes explicitly require a valid token.

_bearer = HTTPBearer(auto_error=False)


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[dict]:
    """Return decoded JWT payload or None for unauthenticated requests."""
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    return payload


def require_auth(
    user: Optional[dict] = Depends(get_current_user_optional),
) -> dict:
    """Require a valid JWT. Raises 401 if missing/invalid."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(user: dict = Depends(require_auth)) -> dict:
    """Require Admin role. Raises 403 for non-admins."""
    if user.get("role") not in ("Admin", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def require_operator(user: dict = Depends(require_auth)) -> dict:
    """Require Admin or Operator role."""
    if user.get("role") not in ("Admin", "admin", "Operator", "operator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator access required",
        )
    return user
