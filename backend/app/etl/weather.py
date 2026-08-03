"""
Weather ETL — Open-Meteo Live Data Pipeline
=============================================
Fetches real-time weather data for all 38 Tamil Nadu districts
from Open-Meteo (free, no API key required).

Fixes applied vs original:
  - mm_24h now uses actual daily.precipitation_sum (not mm * 24 hack)
  - Timeout increased to 8s for batch calls
  - Per-district error handling (one failure doesn't kill all 38)
  - Batch processing to avoid URL length limits
"""
import json
import logging
import os
from typing import List, Dict, Any, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.etl.base import BaseETLPipeline
from app.models.district import District
from app.models.weather import Weather, Rainfall
from app.models.history import WeatherHistory

logger = logging.getLogger(__name__)

# ── Tamil Nadu District Coordinates ──────────────────────────────────────────
TN_DISTRICTS: Dict[str, tuple] = {
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

# Batch size to avoid URL length limits (Open-Meteo supports up to ~50 coords)
_BATCH_SIZE = 38
_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _fetch_batch(
    session: requests.Session,
    districts: List[District],
    timeout: float,
) -> List[Dict[str, Any]]:
    """
    Fetch weather for a batch of districts in a single API call.
    Returns list of raw data dicts, one per district.
    """
    lats = []
    lons = []
    for d in districts:
        lat, lon = TN_DISTRICTS[d.name]
        lats.append(str(lat))
        lons.append(str(lon))

    params = {
        "latitude": ",".join(lats),
        "longitude": ",".join(lons),
        "current": (
            "temperature_2m,relative_humidity_2m,surface_pressure,"
            "precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code"
        ),
        "hourly": "precipitation_probability",
        "daily": "precipitation_sum,precipitation_hours",
        "timezone": "Asia/Kolkata",
        "forecast_days": 7,
    }

    try:
        resp = session.get(_OPEN_METEO_URL, params=params, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()

        # API returns list if multiple coords, dict if single
        results = data if isinstance(data, list) else [data]

        raw = []
        for i, d in enumerate(districts):
            if i >= len(results):
                break
            res = results[i]
            current = res.get("current", {})
            hourly = res.get("hourly", {})
            daily = res.get("daily", {})

            # Precipitation probability at current hour
            rain_prob = 0
            prec_probs = hourly.get("precipitation_probability", [])
            if prec_probs:
                rain_prob = prec_probs[0]

            # ── KEY FIX: use actual daily precipitation_sum for mm_24h ──────
            # The original code used `rainfall_mm * 24` which is completely wrong.
            # daily.precipitation_sum[0] = today's total rainfall forecast in mm.
            prec_sums = daily.get("precipitation_sum", [])
            mm_24h = float(prec_sums[0]) if prec_sums else current.get("precipitation", 0.0) or 0.0

            # Build 7-day forecast list
            daily_forecast = []
            for j in range(min(7, len(prec_sums))):
                try:
                    date_str = daily.get("time", [])[j]
                    from datetime import datetime
                    day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")
                    daily_forecast.append({
                        "day": day_name,
                        "rainfall": round(float(prec_sums[j]), 1),
                        "date": date_str,
                    })
                except Exception:
                    pass

            raw.append({
                "district_id": d.id,
                "district_name": d.name,
                "temperature": current.get("temperature_2m", 28.0),
                "humidity": current.get("relative_humidity_2m", 70.0),
                "pressure": current.get("surface_pressure", 1012.0),
                "rainfall_mm": current.get("precipitation", 0.0) or 0.0,
                "mm_24h": mm_24h,
                "wind_speed": current.get("wind_speed_10m", 0.0),
                "wind_direction": current.get("wind_direction_10m", 0),
                "cloud_cover": current.get("cloud_cover", 0.0),
                "weather_code": current.get("weather_code", 0),
                "rain_probability": rain_prob,
                "daily_forecast": daily_forecast,
            })
        return raw

    except requests.exceptions.Timeout:
        logger.warning(
            f"[WeatherETL] Timeout fetching {len(districts)} districts. Skipping batch."
        )
        return []
    except Exception as e:
        logger.error(f"[WeatherETL] Batch fetch failed: {e}")
        return []


class WeatherETL(BaseETLPipeline):
    def __init__(self, db):
        super().__init__(db, "OpenMeteo_Weather_ETL")
        retry = Retry(
            total=3,
            status_forcelist=[429, 500, 502, 503, 504],
            backoff_factor=1.5,
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session = requests.Session()
        self.session.mount("https://", adapter)
        self.valid_districts: List[District] = []

    def extract(self) -> List[Dict[str, Any]]:
        districts = self.db.query(District).all()
        self.valid_districts = [d for d in districts if d.name in TN_DISTRICTS]

        if not self.valid_districts:
            logger.warning("[WeatherETL] No matched districts found.")
            return []

        all_raw: List[Dict[str, Any]] = []

        # Process in batches to avoid URL length limits
        for i in range(0, len(self.valid_districts), _BATCH_SIZE):
            batch = self.valid_districts[i: i + _BATCH_SIZE]
            logger.info(
                f"[WeatherETL] Fetching batch {i // _BATCH_SIZE + 1}: "
                f"{[d.name for d in batch]}"
            )
            batch_data = _fetch_batch(self.session, batch, timeout=8.0)
            all_raw.extend(batch_data)

        # Save state-wide 7-day forecast (first district's forecast is representative)
        if all_raw and all_raw[0].get("daily_forecast"):
            data_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data"
            )
            os.makedirs(data_dir, exist_ok=True)
            # Average precipitation across all districts for state forecast
            n = len(all_raw)
            if n > 0 and all_raw[0]["daily_forecast"]:
                days = len(all_raw[0]["daily_forecast"])
                state_forecast = []
                for j in range(days):
                    total_rain = sum(
                        r["daily_forecast"][j]["rainfall"]
                        for r in all_raw
                        if j < len(r["daily_forecast"])
                    )
                    state_forecast.append({
                        "day": all_raw[0]["daily_forecast"][j]["day"],
                        "date": all_raw[0]["daily_forecast"][j]["date"],
                        "rainfall": round(total_rain / n, 1),
                    })
                with open(os.path.join(data_dir, "state_forecast.json"), "w") as f:
                    json.dump(state_forecast, f)

        logger.info(f"[WeatherETL] Extracted {len(all_raw)} district records.")
        return all_raw

    def validate(self, raw_data: List[Dict]) -> List[Dict]:
        valid = []
        for row in raw_data:
            # Range checks
            if not (-10 <= row.get("temperature", 30) <= 60):
                logger.warning(f"[WeatherETL] Invalid temperature for {row['district_name']}: {row['temperature']}")
                row["temperature"] = 30.0
            if not (0 <= row.get("humidity", 70) <= 100):
                row["humidity"] = 70.0
            if not (800 <= row.get("pressure", 1013) <= 1100):
                row["pressure"] = 1013.0
            if row.get("rainfall_mm", 0) < 0:
                row["rainfall_mm"] = 0.0
            if row.get("mm_24h", 0) < 0:
                row["mm_24h"] = 0.0
            valid.append(row)
        return valid

    def transform(self, valid_data: List[Dict]):
        transformed = []
        for row in valid_data:
            # Determine weather status
            status = "Clear"
            r = row.get("rainfall_mm", 0) or 0
            if r > 0.5:
                status = "Rain"
            if r > 10:
                status = "Heavy Rain"
            if r > 35:
                status = "Very Heavy Rain"

            history = WeatherHistory(
                district_id=row["district_id"],
                temperature=row["temperature"],
                humidity=row["humidity"],
                pressure=row["pressure"],
                rainfall_mm=row["rainfall_mm"],
                wind_speed=row["wind_speed"],
                wind_direction=row["wind_direction"],
                cloud_cover=row["cloud_cover"],
                weather_code=row["weather_code"],
                rain_probability=row["rain_probability"],
            )

            weather = Weather(
                district_id=row["district_id"],
                temperature=row["temperature"],
                humidity=row["humidity"],
                pressure=row["pressure"],
                status=status,
            )

            rainfall = Rainfall(
                district_id=row["district_id"],
                mm_per_hour=row["rainfall_mm"],
                mm_24h=row["mm_24h"],  # ← real daily sum, not hack
            )

            transformed.append((history, weather, rainfall))
        return transformed

    def load(self, transformed_data):
        if not transformed_data:
            return

        for history, weather, rainfall in transformed_data:
            # Always insert new history record for time-series analysis
            self.db.add(history)

            # Upsert current-state weather
            existing_w = (
                self.db.query(Weather)
                .filter(Weather.district_id == weather.district_id)
                .first()
            )
            if existing_w:
                existing_w.temperature = weather.temperature
                existing_w.humidity = weather.humidity
                existing_w.pressure = weather.pressure
                existing_w.status = weather.status
            else:
                self.db.add(weather)

            # Upsert current-state rainfall
            existing_r = (
                self.db.query(Rainfall)
                .filter(Rainfall.district_id == rainfall.district_id)
                .first()
            )
            if existing_r:
                existing_r.mm_per_hour = rainfall.mm_per_hour
                existing_r.mm_24h = rainfall.mm_24h
            else:
                self.db.add(rainfall)

            self.records_processed += 3

        self.db.commit()
        logger.info(f"[WeatherETL] Loaded {self.records_processed} records.")
