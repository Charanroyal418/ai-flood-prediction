import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from app.etl.base import BaseETLPipeline
from app.services.validation import WeatherValidationSchema
from app.models.district import District
from app.models.weather import Weather, Rainfall
from sqlalchemy import func

class WeatherETL(BaseETLPipeline):
    def __init__(self, db):
        super().__init__(db, "OpenMeteo_Weather_ETL")
        
        # Configure exponential backoff
        retry_strategy = Retry(
            total=3,
            status_forcelist=[429, 500, 502, 503, 504],
            backoff_factor=1
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session = requests.Session()
        self.session.mount("https://", adapter)

        # Mocking district coordinates for now
        self.coords = {
            "Chennai": (13.0827, 80.2707),
            "Cuddalore": (11.7480, 79.7714),
            "Thoothukudi": (8.7642, 78.1348),
            "Kanyakumari": (8.0883, 77.5385),
        }

    def extract(self):
        districts = self.db.query(District).all()
        raw_data = []
        for d in districts:
            if d.name not in self.coords:
                continue
            lat, lon = self.coords[d.name]
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,precipitation,wind_speed_10m&timezone=Asia%2FKolkata"
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            data = response.json().get("current", {})
            data['district_id'] = d.id
            raw_data.append(data)
        return raw_data

    def validate(self, raw_data):
        valid_data = []
        for row in raw_data:
            try:
                # Pydantic validation
                valid = WeatherValidationSchema(
                    temperature=row.get("temperature_2m"),
                    humidity=row.get("relative_humidity_2m"),
                    pressure=row.get("surface_pressure"),
                    rainfall_mm=row.get("precipitation"),
                    recorded_at=row.get("time") # Validates not in future
                )
                
                valid_data.append({
                    "district_id": row["district_id"],
                    "temp": valid.temperature,
                    "humidity": valid.humidity,
                    "pressure": valid.pressure,
                    "precip": valid.rainfall_mm,
                    "time": valid.recorded_at
                })
            except Exception as e:
                # Log validation failure and skip row
                pass
        return valid_data

    def transform(self, valid_data):
        transformed = []
        for row in valid_data:
            status = "Clear"
            if row['precip'] and row['precip'] > 0:
                status = "Rain"
            if row['precip'] and row['precip'] > 10:
                status = "Heavy Rain"
                
            transformed.append({
                "district_id": row['district_id'],
                "weather": Weather(
                    district_id=row['district_id'],
                    temperature=row['temp'],
                    humidity=row['humidity'],
                    pressure=row['pressure'],
                    status=status
                ),
                "rainfall": Rainfall(
                    district_id=row['district_id'],
                    mm_per_hour=row['precip'],
                    mm_24h=row['precip'] * 24 if row['precip'] else 0
                )
            })
        return transformed

    def load(self, transformed_data):
        for data in transformed_data:
            self.db.add(data["weather"])
            self.db.add(data["rainfall"])
            self.records_processed += 2
        self.db.commit()
