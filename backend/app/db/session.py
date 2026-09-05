from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

connect_args = {}
if "psycopg" in settings.DATABASE_URL:
    connect_args["prepare_threshold"] = None
    # Essential for Supabase / cloud PostgreSQL to avoid 30s SSL negotiation delay
    if "sslmode" not in settings.DATABASE_URL:
        connect_args["sslmode"] = "require"
elif "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False

engine_kwargs = {
    "pool_pre_ping": True if "sqlite" not in settings.DATABASE_URL else False,
    "connect_args": connect_args
}

if "sqlite" not in settings.DATABASE_URL:
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_timeout"] = 15

engine = create_engine(
    settings.DATABASE_URL, 
    **engine_kwargs
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
