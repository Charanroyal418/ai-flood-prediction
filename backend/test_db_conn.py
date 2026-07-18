import os
import sys
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.dirname(__file__))

from app.db.session import engine

try:
    with engine.connect() as conn:
        res = conn.execute(text("SELECT version();")).scalar()
        print(f"Connected to DB! Postgres version: {res}")
except Exception as e:
    print(f"Failed to connect: {e}")
