from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import os
import json

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

_CACHED_DISTRICT_BOUNDS = None

@router.get("/district-bounds")
def get_district_boundaries(db: Session = Depends(get_db)):
    """
    Returns all districts as GeoJSON for frontend Leaflet rendering.
    Instantly returns cached response without blocking on database locks.
    """
    global _CACHED_DISTRICT_BOUNDS
    if _CACHED_DISTRICT_BOUNDS:
        return _CACHED_DISTRICT_BOUNDS

    try:
        from app.models.district import District
        districts = db.query(District).filter(District.geom_json != None).all()
        
        features = []
        for d in districts:
            features.append({
                "type": "Feature",
                "properties": {
                    "name": d.name,
                    "population": d.population
                },
                "geometry": d.geom_json
            })
            
        if features:
            _CACHED_DISTRICT_BOUNDS = {
                "type": "FeatureCollection",
                "features": features
            }
            return _CACHED_DISTRICT_BOUNDS
    except Exception:
        pass

    # Instant resilient fallback from disk
    geojson_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "districts.geojson")
    if os.path.exists(geojson_path):
        try:
            with open(geojson_path, "r", encoding="utf-8") as f:
                _CACHED_DISTRICT_BOUNDS = json.load(f)
                return _CACHED_DISTRICT_BOUNDS
        except Exception:
            pass

    return {"type": "FeatureCollection", "features": []}

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
