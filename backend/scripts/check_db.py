import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app.db.base import Base
from app.db.session import SessionLocal
from app.models.graph import GraphEdge
from sqlalchemy import text

db = SessionLocal()
print('Edges count:', db.query(GraphEdge).count())
res = db.execute(text("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'district'")).fetchall()
print('District columns:', res)
