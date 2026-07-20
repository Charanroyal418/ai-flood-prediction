import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from app.etl.base import BaseETLPipeline
from app.models.river import RiverLevel
from app.models.district import District
import logging
import random
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Real FRL / Danger levels in meters (approx converted from feet where applicable)
RIVER_STATIONS = [
    {"name": "Cauvery River", "station": "Mettur Dam Station", "danger_m": 36.57, "base_m": 30.0, "district_name": "Salem"},
    {"name": "Adyar River", "station": "Chembarambakkam Outflow", "danger_m": 7.31, "base_m": 5.0, "district_name": "Kancheepuram"},
    {"name": "Cooum River", "station": "Napier Bridge Gauging Station", "danger_m": 5.0, "base_m": 1.8, "district_name": "Chennai"},
    {"name": "Palar River", "station": "Vaniyambadi Gauge", "danger_m": 15.0, "base_m": 6.2, "district_name": "Vellore"},
    {"name": "Ponnaiyar River", "station": "Sathanur Reservoir Gauge", "danger_m": 36.27, "base_m": 18.5, "district_name": "Tiruvannamalai"},
    {"name": "Vellar River", "station": "Kollidam Outlet", "danger_m": 12.0, "base_m": 5.0, "district_name": "Cuddalore"},
    {"name": "Vaigai River", "station": "Vaigai Dam Gauging Station", "danger_m": 21.64, "base_m": 15.0, "district_name": "Theni"},
    {"name": "Thamirabarani River", "station": "Papanasam Release Station", "danger_m": 43.58, "base_m": 35.0, "district_name": "Tirunelveli"},
    {"name": "Bhavani River", "station": "Bhavanisagar Inflow", "danger_m": 32.0, "base_m": 16.5, "district_name": "Erode"},
]

class RiverETL(BaseETLPipeline):
    def __init__(self, db):
        super().__init__(db, "India_WRIS_River_ETL")
        retry_strategy = Retry(total=3, status_forcelist=[429, 500, 502, 503, 504], backoff_factor=1)
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session = requests.Session()
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def extract(self):
        districts = {d.name: d.id for d in self.db.query(District).all()}
        raw_data = []

        try:
            # Placeholder for actual WRIS API call
            # e.g. response = self.session.get("https://indiawris.gov.in/api/v1/telemetry?state=Tamil Nadu", timeout=10)
            
            for rs in RIVER_STATIONS:
                d_id = districts.get(rs["district_name"])
                if not d_id:
                    continue

                # Simulate a live reading (in real life, replace with value from WRIS JSON)
                current_level = rs["base_m"] + random.uniform(-1.0, 1.5)
                
                raw_data.append({
                    "district_id": d_id,
                    "river_name": rs["name"],
                    "station_name": rs["station"],
                    "current_level": current_level,
                    "danger_level": rs["danger_m"]
                })
        except Exception as e:
            logger.error(f"Failed to fetch from India-WRIS API: {e}")
            pass

        return raw_data

    def validate(self, raw_data):
        return raw_data

    def transform(self, valid_data):
        transformed = []
        now = datetime.now(timezone.utc)
        for row in valid_data:
            transformed.append(
                RiverLevel(
                    district_id=row["district_id"],
                    river_name=row["river_name"],
                    station_name=row["station_name"],
                    current_level=row["current_level"],
                    danger_level=row["danger_level"],
                    recorded_at=now
                )
            )
        return transformed

    def load(self, transformed_data):
        if not transformed_data:
            return

        for river_record in transformed_data:
            self.db.add(river_record)
            self.records_processed += 1
        
        self.db.commit()
