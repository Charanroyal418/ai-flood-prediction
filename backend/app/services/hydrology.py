import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.district import District
from app.models.weather import Rainfall
from app.models.history import WeatherHistory
from app.models.river import RiverLevel
from app.models.terrain import DemTile

logger = logging.getLogger(__name__)

# Catchment slope and runoffs mapping based on actual TN terrain configuration
GEOM_PARAMS = {
    # district: (avg elevation, slope, runoff_multiplier)
    "The Nilgiris": (2200.0, 35.0, 0.8),
    "Coimbatore": (411.0, 28.0, 0.7),
    "Salem": (278.0, 22.0, 0.65),
    "Dharmapuri": (480.0, 20.0, 0.6),
    "Tenkasi": (143.0, 22.0, 0.6),
    "Theni": (290.0, 24.0, 0.65),
    "Vellore": (220.0, 15.0, 0.55),
    "Tirupattur": (380.0, 18.0, 0.6),
    "Kallakurichi": (110.0, 12.0, 0.5),
    "Villupuram": (42.0, 8.0, 0.45),
    "Tirunelveli": (47.0, 12.0, 0.5),
    "Erode": (183.0, 12.0, 0.5),
    "Namakkal": (150.0, 14.0, 0.5),
    "Karur": (122.0, 8.0, 0.4),
    "Tiruchirappalli": (85.0, 6.0, 0.4),
    "Thanjavur": (57.0, 3.0, 0.35),
    "Chennai": (6.0, 1.5, 0.9), # Urban area has very high runoff!
    "Thiruvallur": (12.0, 3.0, 0.5),
    "Kancheepuram": (12.8, 4.0, 0.5),
    "Chengalpattu": (15.0, 5.0, 0.55),
    "Cuddalore": (8.0, 2.0, 0.6), # Coastal clay
    "Nagapattinam": (4.0, 1.0, 0.65), # Delta depression
    "Mayiladuthurai": (9.0, 2.0, 0.6),
    "Thoothukudi": (8.0, 2.0, 0.55),
    "Kanyakumari": (13.0, 8.0, 0.6)
}

# Ordered river paths (upstream to downstream)
RIVER_PATHS = {
    "Cauvery River": ["Salem", "Erode", "Namakkal", "Karur", "Tiruchirappalli", "Thanjavur", "Mayiladuthurai", "Nagapattinam"],
    "Adyar River": ["Kancheepuram", "Chengalpattu", "Chennai"],
    "Cooum River": ["Thiruvallur", "Kancheepuram", "Chennai"],
    "Palar River": ["Tirupattur", "Vellore", "Ranipet", "Kancheepuram", "Chengalpattu"],
    "Ponnaiyar River": ["Krishnagiri", "Dharmapuri", "Tiruvannamalai", "Villupuram", "Cuddalore"],
    "Vellar River": ["Salem", "Kallakurichi", "Perambalur", "Ariyalur", "Cuddalore"],
    "Vaigai River": ["Theni", "Dindigul", "Madurai", "Sivaganga", "Ramanathapuram"],
    "Thamirabarani River": ["Tenkasi", "Tirunelveli", "Thoothukudi"],
    "Bhavani River": ["The Nilgiris", "Coimbatore", "Erode"]
}

RESERVOIRS = {
    # name: (river, capacity_mcft, feeding_district)
    "Mettur Dam": ("Cauvery River", 93470.0, "Salem"),
    "Chembarambakkam": ("Adyar River", 3645.0, "Kancheepuram"),
    "Poondi Reservoir": ("Cooum River", 3231.0, "Thiruvallur"),
    "Sathanur Dam": ("Ponnaiyar River", 1688.0, "Dharmapuri"),
    "Vaigai Dam": ("Vaigai River", 3278.0, "Theni"),
    "Papanasam Dam": ("Thamirabarani River", 3000.0, "Tenkasi")
}

class HydrologyEngine:
    def __init__(self, db: Session):
        self.db = db

    def calculate_metrics(self):
        """
        Executes physical routing modeling.
        Computes 24h rainfall aggregation, updates river levels, and estimates reservoir release rates.
        """
        logger.info("Executing Hydrological Inflow & Flow Routing Calculations...")
        
        # 1. Fetch live weather & rainfall records
        districts = self.db.query(District).all()
        dist_map = {d.id: d for d in districts}
        
        # Get 24-hour rainfall averages per district
        rainfall_data = {}
        for d in districts:
            # Query recent rainfall logs for the district
            records = self.db.query(WeatherHistory)\
                .filter(WeatherHistory.district_id == d.id)\
                .order_by(WeatherHistory.recorded_at.desc())\
                .limit(24).all()
            
            if records:
                # Sum rainfall over last 24 records (hourly ticks)
                total_rain = sum(r.rainfall_mm or 0.0 for r in records)
                avg_temp = sum(r.temperature or 28.0 for r in records) / len(records)
                avg_hum = sum(r.humidity or 70.0 for r in records) / len(records)
                avg_pres = sum(r.pressure or 1010.0 for r in records) / len(records)
                avg_wind = sum(r.wind_speed or 12.0 for r in records) / len(records)
            else:
                total_rain = 0.0
                avg_temp, avg_hum, avg_pres, avg_wind = 28.0, 70.0, 1010.0, 12.0

            # Store aggregated values
            rainfall_data[d.name] = {
                "id": d.id,
                "rainfall_24h": total_rain,
                "temperature": avg_temp,
                "humidity": avg_hum,
                "pressure": avg_pres,
                "wind_speed": avg_wind
            }
            
            # Update the Rainfall table mm_24h column directly
            rf = self.db.query(Rainfall).filter(Rainfall.district_id == d.id).first()
            if rf:
                rf.mm_24h = total_rain
                rf.recorded_at = datetime.utcnow()
                
        # 2. Run River Inflow Routing
        # Update river levels along downstream paths
        for river_name, path in RIVER_PATHS.items():
            upstream_discharge = 0.0
            
            for index, d_name in enumerate(path):
                if d_name not in dist_map and d_name not in [d.name for d in districts]:
                    continue
                    
                d_id = next((d.id for d in districts if d.name == d_name), None)
                if not d_id:
                    continue
                    
                # Fetch river record
                river_station = self.db.query(RiverLevel)\
                    .filter(RiverLevel.district_id == d_id, RiverLevel.river_name == river_name)\
                    .first()
                    
                if not river_station:
                    continue

                # Local rainfall contribution
                rain_info = rainfall_data.get(d_name, {"rainfall_24h": 0.0})
                local_rain = rain_info["rainfall_24h"]
                
                # Terrain parameters
                topo = GEOM_PARAMS.get(d_name, (20.0, 2.0, 0.5))
                elevation, slope, runoff_coeff = topo
                
                # Hydrological local runoff (runoff coeff * local rainfall volume index)
                # Max local runoff increases level up to danger mark
                local_runoff = (local_rain / 50.0) * runoff_coeff * (slope ** 0.5)
                
                # Manning's routing formula approximation:
                # River level = Base level + Local Runoff + Upstream Flow delay
                base_level = river_station.danger_level * 0.35
                
                # Upstream flow attenuation
                attenuation = 0.65
                upstream_contribution = upstream_discharge * attenuation / 1000.0
                
                new_level = base_level + local_runoff + upstream_contribution
                
                # Check for reservoir dam release factors
                # e.g., if there's a dam in the upstream district, let's see its release rate
                for res_name, res_info in RESERVOIRS.items():
                    if res_info[0] == river_name and res_info[2] == d_name:
                        # Mettur Dam releases water into Cauvery
                        # If rainfall is high upstream, increase level
                        if local_rain > 40:
                            new_level += 2.0 + (local_rain * 0.05)
                
                # Cap the maximum river level at 1.35 * danger level
                new_level = min(river_station.danger_level * 1.35, max(base_level, new_level))
                river_station.current_level = round(new_level, 2)
                river_station.recorded_at = datetime.utcnow()
                
                # Calculate downstream discharge (Q = V * A)
                # Q (cusecs) modeled as function of current level and slope
                upstream_discharge = (new_level ** 1.67) * (slope ** 0.5) * 150.0
                
        self.db.commit()
        logger.info("Hydrology Calculations successfully committed to DB.")
        return rainfall_data

    def get_reservoir_stats(self) -> list:
        """
        Returns reservoir fill percentages and releases based on physical weather data.
        """
        stats = []
        for name, info in RESERVOIRS.items():
            river_name, cap, d_name = info
            
            # Find the district ID
            d = self.db.query(District).filter(District.name == d_name).first()
            if not d:
                continue
                
            # Get rainfall
            rf = self.db.query(Rainfall).filter(Rainfall.district_id == d.id).first()
            rain = rf.mm_24h if rf else 0.0
            
            # Compute fill percentage
            # High rain fills reservoirs
            fill_pct = min(100.0, max(15.0, 42.0 + (rain * 0.8)))
            
            # Releases (outflow) is triggered if fill percentage > 80%
            if fill_pct > 80:
                release_cusecs = (fill_pct - 80) * 1200.0 + (rain * 150.0)
            else:
                release_cusecs = 100.0 # minimum environmental flow release
                
            stats.append({
                "name": name,
                "river": river_name,
                "capacity_mcft": cap,
                "fill_pct": round(fill_pct, 1),
                "inflow_cusecs": int(fill_pct * 300 + rain * 200),
                "outflow_cusecs": int(release_cusecs)
            })
        return stats
