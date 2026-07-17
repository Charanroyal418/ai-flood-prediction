import os
import sys
import logging
import requests
from datetime import datetime
from sqlalchemy.orm import Session
import json

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
from app.db.session import SessionLocal
from app.models.district import District
from app.models.weather import Weather, Rainfall

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Basic TN Coordinates mapping for demonstration (centroid of districts)
# In production, fetch centroids from PostGIS ST_Centroid(geom)
DISTRICT_COORDS = {
    "Chennai": {"lat": 13.0827, "lon": 80.2707},
    "Cuddalore": {"lat": 11.7480, "lon": 79.7714},
    "Thoothukudi": {"lat": 8.7642, "lon": 78.1348},
    "Kanyakumari": {"lat": 8.0883, "lon": 77.5385},
}

def fetch_weather_for_district(db: Session, district: District, lat: float, lon: float):
    # Open-Meteo API endpoint (Free, no API key required)
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,precipitation&timezone=Asia%2FKolkata"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        current = data.get("current", {})
        
        temp = current.get("temperature_2m")
        humidity = current.get("relative_humidity_2m")
        pressure = current.get("surface_pressure")
        precip = current.get("precipitation", 0.0)
        
        # Determine status
        status = "Clear"
        if precip > 0:
            status = "Rain"
        if precip > 10:
            status = "Heavy Rain"
            
        weather_record = Weather(
            district_id=district.id,
            temperature=temp,
            humidity=humidity,
            pressure=pressure,
            status=status
        )
        db.add(weather_record)
        
        rainfall_record = Rainfall(
            district_id=district.id,
            mm_per_hour=precip,
            mm_24h=precip * 24 # Simplified estimate
        )
        db.add(rainfall_record)
        
        db.commit()
        logger.info(f"Updated live weather for {district.name}: {temp}°C, {precip}mm rain")
        
    except Exception as e:
        logger.error(f"Failed to fetch weather for {district.name}: {e}")
        db.rollback()

def main():
    logger.info("Starting Real-Time Weather ETL Pipeline...")
    db = SessionLocal()
    try:
        # Fetch districts from DB
        districts = db.query(District).all()
        for d in districts:
            coords = DISTRICT_COORDS.get(d.name)
            if coords:
                fetch_weather_for_district(db, d, coords['lat'], coords['lon'])
            else:
                logger.debug(f"Skipping {d.name} - no coords mapped in script yet.")
                
        logger.info("Real-Time ETL completed successfully.")
    except Exception as e:
        logger.error(f"ETL Pipeline failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
