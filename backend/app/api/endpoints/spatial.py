from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from app.api.deps import get_db
from app.models.district import District
from app.models.facility import Shelter, Hospital

router = APIRouter()

@router.get("/nearest-shelter")
def get_nearest_shelter(lat: float, lon: float, limit: int = 3, db: Session = Depends(get_db)):
    """
    Find the closest relief shelters to a given coordinate using PostGIS ST_DistanceSphere.
    """
    try:
        # Construct raw SQL for PostGIS distance calculation
        # ST_SetSRID(ST_MakePoint(lon, lat), 4326) creates our search point
        # ST_DistanceSphere calculates distance in meters
        sql = text("""
            SELECT 
                s.id, s.name, s.capacity, s.current_occupancy,
                ST_Y(s.location::geometry) as lat,
                ST_X(s.location::geometry) as lon,
                ST_DistanceSphere(s.location::geometry, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)) as distance_meters
            FROM shelter s
            WHERE s.location IS NOT NULL
            ORDER BY distance_meters ASC
            LIMIT :limit
        """)
        
        result = db.execute(sql, {"lat": lat, "lon": lon, "limit": limit}).fetchall()
        
        return [
            {
                "id": str(r[0]),
                "name": r[1],
                "capacity": r[2],
                "occupancy": r[3],
                "latitude": r[4],
                "longitude": r[5],
                "distance_km": round(r[6] / 1000, 2) if r[6] else None
            }
            for r in result
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Spatial query failed: {str(e)}")

@router.get("/district-bounds")
def get_district_boundaries(db: Session = Depends(get_db)):
    """
    Returns all districts as GeoJSON for frontend Leaflet rendering.
    """
    try:
        # Use PostGIS ST_AsGeoJSON to extract the polygons directly formatted for the web
        sql = text("""
            SELECT name, population, ST_AsGeoJSON(geom) as geojson
            FROM district
            WHERE geom IS NOT NULL
        """)
        
        result = db.execute(sql).fetchall()
        
        features = []
        for r in result:
            import json
            features.append({
                "type": "Feature",
                "properties": {
                    "name": r[0],
                    "population": r[1]
                },
                "geometry": json.loads(r[2])
            })
            
        return {
            "type": "FeatureCollection",
            "features": features
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Spatial query failed: {str(e)}")

@router.get("/evacuation-route")
def get_evacuation_route(lat: float, lon: float, db: Session = Depends(get_db)):
    """
    Safe Route Engine: Finds the nearest safe zone with capacity and calculates 
    an evacuation route (GeoJSON LineString) to it.
    """
    try:
        # 1. Find nearest shelter with capacity > occupancy using PostGIS
        sql = text("""
            SELECT 
                s.name,
                ST_Y(s.location::geometry) as dest_lat,
                ST_X(s.location::geometry) as dest_lon,
                ST_DistanceSphere(s.location::geometry, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)) as distance_meters
            FROM shelter s
            WHERE s.location IS NOT NULL 
              AND s.capacity > s.current_occupancy
            ORDER BY distance_meters ASC
            LIMIT 1
        """)
        
        shelter = db.execute(sql, {"lat": lat, "lon": lon}).fetchone()
        
        if not shelter:
            raise HTTPException(status_code=404, detail="No safe shelters with capacity found nearby.")
            
        # 2. Build GeoJSON LineString (Straight-line heuristic for MVP)
        # Note: In a production pgRouting setup, we would run pgr_dijkstra here over the roads network.
        route_geojson = {
            "type": "Feature",
            "properties": {
                "destination": shelter[0],
                "distance_km": round(shelter[3] / 1000, 2)
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [lon, lat], # Start
                    [shelter[2], shelter[1]] # End
                ]
            }
        }
        
        return route_geojson
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Routing failed: {str(e)}")
