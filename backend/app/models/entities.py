import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Uuid, JSON
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Dam(Base):
    __tablename__ = "dams"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String, index=True, nullable=False)
    capacity_mcft = Column(Float, nullable=False)
    current_release_cusecs = Column(Float, default=0.0)
    inflow_cusecs = Column(Float, default=0.0)
    fill_pct = Column(Float, default=0.0)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    district = relationship("District")

class Catchment(Base):
    __tablename__ = "catchments"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String, index=True, nullable=False)
    area_sqkm = Column(Float, nullable=False)
    runoff_coefficient = Column(Float, default=0.5)
    soil_type = Column(String, nullable=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    district = relationship("District")

class Sensor(Base):
    __tablename__ = "sensors"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String, index=True, nullable=False)
    type = Column(String, index=True, nullable=False) # "weather_station", "rain_gauge", "river_gauge", "soil_moisture"
    status = Column(String, default="Active") # "Active", "Maintenance", "Offline"
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    district = relationship("District")

class HistoricalFloodEvent(Base):
    __tablename__ = "historical_flood_events"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    year = Column(Integer, index=True, nullable=False)
    event_name = Column(String, index=True, nullable=False)
    severity = Column(String, nullable=False) # "Extreme", "High", "Moderate", "Low"
    affected_districts = Column(JSON, nullable=True) # List of district names
    affected_people = Column(Integer, default=0)
    deaths = Column(Integer, default=0)
    damage_cr = Column(Float, default=0.0) # Damage in Crores
    created_at = Column(DateTime, default=datetime.utcnow)
