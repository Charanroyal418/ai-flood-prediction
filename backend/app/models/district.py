from sqlalchemy import Column, Integer, String, Float, JSON
from app.db.base_class import Base
from sqlalchemy.orm import relationship

class District(Base):
    __tablename__ = "districts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    geom_json = Column(JSON, nullable=True) # Storing GeoJSON instead of PostGIS Geometry
    population = Column(Float, nullable=True)

    # Relationships
    predictions = relationship("PredictionHistory", back_populates="district")
    alerts = relationship("Alert", back_populates="district")
    weather = relationship("Weather", back_populates="district")
    rainfall = relationship("Rainfall", back_populates="district")
    rivers = relationship("RiverLevel", back_populates="district")
