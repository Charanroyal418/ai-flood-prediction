import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from app.etl.base import BaseETLPipeline
from app.models.district import District
from app.models.weather import Weather, Rainfall
from app.models.history import WeatherHistory
from sqlalchemy import func
import logging

logger = logging.getLogger(__name__)

TN_DISTRICTS = {
    "Chennai": (13.0827, 80.2707),
    "Kancheepuram": (12.8364, 79.7036),
    "Chengalpattu": (12.6939, 79.9757),
    "Thiruvallur": (13.1436, 79.9142),
    "Cuddalore": (11.7480, 79.7714),
    "Villupuram": (11.9401, 79.4861),
    "Kallakurichi": (11.7383, 78.9639),
    "Vellore": (12.9165, 79.1325),
    "Ranipet": (12.9274, 79.3333),
    "Tirupattur": (12.4934, 78.5661),
    "Tiruvannamalai": (12.2253, 79.0747),
    "Salem": (11.6643, 78.1460),
    "Namakkal": (11.2189, 78.1674),
    "Dharmapuri": (12.1211, 78.1582),
    "Krishnagiri": (12.5186, 78.2137),
    "Coimbatore": (11.0168, 76.9558),
    "Tiruppur": (11.1085, 77.3411),
    "Erode": (11.3424, 77.7281),
    "The Nilgiris": (11.4166, 76.6946),
    "Tiruchirappalli": (10.7905, 78.7047),
    "Karur": (10.9601, 78.0766),
    "Perambalur": (11.2332, 78.8821),
    "Ariyalur": (11.1399, 79.0736),
    "Thanjavur": (10.7870, 79.1378),
    "Tiruvarur": (10.7744, 79.6366),
    "Nagapattinam": (10.7672, 79.8449),
    "Mayiladuthurai": (11.1026, 79.6521),
    "Pudukkottai": (10.3797, 78.8205),
    "Madurai": (9.9252, 78.1198),
    "Theni": (10.0104, 77.4768),
    "Dindigul": (10.3673, 77.9803),
    "Ramanathapuram": (9.3639, 78.8320),
    "Sivaganga": (9.8433, 78.4809),
    "Virudhunagar": (9.5855, 77.9556),
    "Tirunelveli": (8.7139, 77.7567),
    "Tenkasi": (8.9585, 77.3111),
    "Thoothukudi": (8.7642, 78.1348),
    "Kanyakumari": (8.0883, 77.5385),
}

class WeatherETL(BaseETLPipeline):
    def __init__(self, db):
        super().__init__(db, "OpenMeteo_Weather_ETL")
        retry_strategy = Retry(total=3, status_forcelist=[429, 500, 502, 503, 504], backoff_factor=1)
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session = requests.Session()
        self.session.mount("https://", adapter)
        self.districts_map = {}

    def extract(self):
        districts = self.db.query(District).all()
        lats = []
        lons = []
        self.valid_districts = []
        
        for d in districts:
            if d.name in TN_DISTRICTS:
                lat, lon = TN_DISTRICTS[d.name]
                lats.append(str(lat))
                lons.append(str(lon))
                self.valid_districts.append(d)
        
        if not lats:
            logger.warning("No matched districts found for weather extraction.")
            return []

        # Batch request
        lat_str = ",".join(lats)
        lon_str = ",".join(lons)
        
        # New URL fetching 9 requested parameters
        url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={lat_str}&longitude={lon_str}"
            "&current=temperature_2m,relative_humidity_2m,surface_pressure,precipitation,"
            "wind_speed_10m,wind_direction_10m,cloud_cover,weather_code"
            "&hourly=precipitation_probability"
            "&timezone=Asia%2FKolkata"
        )
        
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            # API returns a list if multiple coordinates, or dict if only 1
            results = data if isinstance(data, list) else [data]
            
            raw_data = []
            for i, d in enumerate(self.valid_districts):
                res = results[i]
                current = res.get("current", {})
                hourly = res.get("hourly", {})
                
                # Get current hour rain probability
                rain_prob = 0
                if hourly and "precipitation_probability" in hourly:
                    rain_prob = hourly["precipitation_probability"][0] if len(hourly["precipitation_probability"]) > 0 else 0
                    
                raw_data.append({
                    "district_id": d.id,
                    "temperature": current.get("temperature_2m", 0),
                    "humidity": current.get("relative_humidity_2m", 0),
                    "pressure": current.get("surface_pressure", 1013),
                    "rainfall_mm": current.get("precipitation", 0),
                    "wind_speed": current.get("wind_speed_10m", 0),
                    "wind_direction": current.get("wind_direction_10m", 0),
                    "cloud_cover": current.get("cloud_cover", 0),
                    "weather_code": current.get("weather_code", 0),
                    "rain_probability": rain_prob
                })
            return raw_data
        except Exception as e:
            logger.error(f"Open-Meteo API Failed: {e}")
            # Fallback to last known weather from DB
            logger.info("Using cached weather from database failover.")
            return []

    def validate(self, raw_data):
        return raw_data # Minimal validation for speed

    def transform(self, valid_data):
        transformed = []
        for row in valid_data:
            # Determine status from weather code or rainfall
            status = "Clear"
            if row['rainfall_mm'] > 0: status = "Rain"
            if row['rainfall_mm'] > 10: status = "Heavy Rain"
                
            history = WeatherHistory(
                district_id=row['district_id'],
                temperature=row['temperature'],
                humidity=row['humidity'],
                pressure=row['pressure'],
                rainfall_mm=row['rainfall_mm'],
                wind_speed=row['wind_speed'],
                wind_direction=row['wind_direction'],
                cloud_cover=row['cloud_cover'],
                weather_code=row['weather_code'],
                rain_probability=row['rain_probability']
            )
            
            weather = Weather(
                district_id=row['district_id'],
                temperature=row['temperature'],
                humidity=row['humidity'],
                pressure=row['pressure'],
                status=status
            )
            
            rainfall = Rainfall(
                district_id=row['district_id'],
                mm_per_hour=row['rainfall_mm'],
                mm_24h=row['rainfall_mm'] * 24 # rough estimate for now
            )
            
            transformed.append((history, weather, rainfall))
        return transformed

    def load(self, transformed_data):
        if not transformed_data:
            return
            
        for history, weather, rainfall in transformed_data:
            # Update existing weather/rainfall or insert new history
            self.db.add(history)
            
            # Upsert current state
            existing_w = self.db.query(Weather).filter(Weather.district_id == weather.district_id).first()
            if existing_w:
                existing_w.temperature = weather.temperature
                existing_w.humidity = weather.humidity
                existing_w.pressure = weather.pressure
                existing_w.status = weather.status
            else:
                self.db.add(weather)
                
            existing_r = self.db.query(Rainfall).filter(Rainfall.district_id == rainfall.district_id).first()
            if existing_r:
                existing_r.mm_per_hour = rainfall.mm_per_hour
                existing_r.mm_24h = rainfall.mm_24h
            else:
                self.db.add(rainfall)
                
            self.records_processed += 3
        
        self.db.commit()
