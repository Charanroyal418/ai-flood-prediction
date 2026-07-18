import os
import sys
from sqlalchemy.orm import Session
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import app.db.base # Register all models

from app.db.session import SessionLocal
from app.models.district import District
from app.etl.weather import WeatherETL

def init_districts(db: Session):
    districts_data = [
        {"name": "Chennai", "population": 7088000},
        {"name": "Cuddalore", "population": 2605914},
        {"name": "Thoothukudi", "population": 1750176},
        {"name": "Kanyakumari", "population": 1870374},
    ]
    for d in districts_data:
        existing = db.query(District).filter(District.name == d["name"]).first()
        if not existing:
            new_dist = District(name=d["name"], population=d["population"])
            db.add(new_dist)
    db.commit()
    print("Districts initialized.")

def run_weather_etl(db: Session):
    print("Running Weather ETL...")
    etl = WeatherETL(db)
    etl.execute()
    print("Weather ETL completed.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        init_districts(db)
        run_weather_etl(db)
    finally:
        db.close()
