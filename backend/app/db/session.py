from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

connect_args = {}
if "psycopg" in settings.DATABASE_URL:
    connect_args["prepare_threshold"] = None
elif "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL, 
    pool_pre_ping=True if "sqlite" not in settings.DATABASE_URL else False,
    connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
