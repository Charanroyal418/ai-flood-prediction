import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, Boolean
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class Shelter(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("district.id"), nullable=False)
    name = Column(String, nullable=False)
    location = Column(Geometry('POINT', srid=4326), nullable=True)
    capacity = Column(Integer, default=0)
    current_occupancy = Column(Integer, default=0)

class Hospital(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district_id = Column(Integer, ForeignKey("district.id"), nullable=False)
    name = Column(String, nullable=False)
    location = Column(Geometry('POINT', srid=4326), nullable=True)
    has_emergency = Column(Boolean, default=True)
