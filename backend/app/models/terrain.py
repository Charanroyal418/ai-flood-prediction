import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class DemTile(Base):
    __tablename__ = "dem_tiles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tile_name = Column(String, unique=True, nullable=False)
    geom = Column(Geometry('POLYGON', srid=4326), nullable=False)
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Landcover(Base):
    __tablename__ = "landcover"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_name = Column(String, nullable=False)
    geom = Column(Geometry('MULTIPOLYGON', srid=4326), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
