import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app.db.base import Base
from app.db.session import SessionLocal
from app.models.graph import GraphEdge
db = SessionLocal()
edges = db.query(GraphEdge).limit(5).all()
for e in edges:
    print(f'Edge: source={e.source_id}, target={e.target_id}, type={e.edge_type}')
