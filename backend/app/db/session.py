from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

connect_args = {}
if "psycopg" in settings.DATABASE_URL:
    connect_args["prepare_threshold"] = None
elif "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False

engine_kwargs = {
    "pool_pre_ping": True if "sqlite" not in settings.DATABASE_URL else False,
    "connect_args": connect_args
}

from sqlalchemy.pool import NullPool

if "sqlite" not in settings.DATABASE_URL:
    engine_kwargs["poolclass"] = NullPool

engine = create_engine(
    settings.DATABASE_URL, 
    **engine_kwargs
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
