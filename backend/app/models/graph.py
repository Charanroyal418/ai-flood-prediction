import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Uuid
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    source_id = Column(Integer, ForeignKey("districts.id"), nullable=False, index=True)
    target_id = Column(Integer, ForeignKey("districts.id"), nullable=False, index=True)
    edge_type = Column(String, index=True, nullable=False) # 'adjacency', 'river_flow'
    weight = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    source = relationship("District", foreign_keys=[source_id])
    target = relationship("District", foreign_keys=[target_id])
