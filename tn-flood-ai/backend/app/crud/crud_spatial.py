import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.facility import Hospital, Shelter
from app.models.infrastructure import Road, Building
from app.models.district import District

def get_hospitals_in_district(db: Session, district_id: int):
    """Spatial Query: Find all hospitals physically inside a given district's geometry."""
    district = db.query(District).filter(District.id == district_id).first()
    if not district or not district.geom:
        return []
    
    # PostGIS ST_Contains
    return db.query(Hospital).filter(
        func.ST_Contains(district.geom, Hospital.location)
    ).all()

def get_roads_intersecting_flood(db: Session, flood_geom_wkt: str):
    """Spatial Query: Find all roads that intersect a given flood polygon."""
    return db.query(Road).filter(
        func.ST_Intersects(Road.geom, func.ST_GeomFromText(flood_geom_wkt, 4326))
    ).all()

def get_nearest_shelters(db: Session, lon: float, lat: float, limit: int = 5):
    """Spatial Query: Find nearest shelters to a given point using ST_Distance."""
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    
    return db.query(Shelter).order_by(
        func.ST_Distance(Shelter.location, point)
    ).limit(limit).all()
