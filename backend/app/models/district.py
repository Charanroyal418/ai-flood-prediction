from sqlalchemy import Column, Integer, String, Float
from geoalchemy2 import Geometry
from app.db.base_class import Base
from sqlalchemy.orm import relationship

class District(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    geom = Column(Geometry('POLYGON', srid=4326), nullable=True)
    population = Column(Float, nullable=True)

    # Relationships (to be linked later)
    # weather = relationship("Weather", back_populates="district")
    # shelters = relationship("Shelter", back_populates="district")
