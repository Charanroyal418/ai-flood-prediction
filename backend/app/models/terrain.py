import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Uuid, JSON
from app.db.base_class import Base

class DemTile(Base):
    __tablename__ = "dem_tiles"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    elevation = Column(Integer, nullable=True)
    geom_json = Column(JSON, nullable=True)

class Landcover(Base):
    __tablename__ = "landcover"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    type = Column(String, nullable=True)
    geom_json = Column(JSON, nullable=True)
