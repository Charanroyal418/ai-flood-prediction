from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

connect_args = {}
if "psycopg" in settings.DATABASE_URL:
    connect_args["prepare_threshold"] = None

engine = create_engine(
    settings.DATABASE_URL, 
    pool_pre_ping=True,
    connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
