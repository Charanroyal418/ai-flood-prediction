import os
import sys
import uuid
import logging
from sqlalchemy import text
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from app.db.session import SessionLocal
import app.db.base # Ensure all models are registered
from app.models.district import District
from app.models.river import RiverLevel
from app.models.terrain import DemTile
from app.models.facility import Shelter, Hospital
from app.models.entities import Dam, Catchment, Sensor, HistoricalFloodEvent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_geo_data")

# Coordinates from weather.py
TN_DISTRICTS = {
    "Chennai": (13.0827, 80.2707, 6.0, 1.5), # Name: (lat, lon, avg elevation, slope)
    "Kancheepuram": (12.8364, 79.7036, 18.0, 4.0),
    "Chengalpattu": (12.6939, 79.9757, 15.0, 5.0),
    "Thiruvallur": (13.1436, 79.9142, 12.0, 3.0),
    "Cuddalore": (11.7480, 79.7714, 8.0, 2.0),
    "Villupuram": (11.9401, 79.4861, 42.0, 8.0),
    "Kallakurichi": (11.7383, 78.9639, 110.0, 12.0),
    "Vellore": (12.9165, 79.1325, 220.0, 15.0),
    "Ranipet": (12.9274, 79.3333, 160.0, 9.0),
    "Tirupattur": (12.4934, 78.5661, 380.0, 18.0),
    "Tiruvannamalai": (12.2253, 79.0747, 170.0, 11.0),
    "Salem": (11.6643, 78.1460, 278.0, 22.0),
    "Namakkal": (11.2189, 78.1674, 150.0, 14.0),
    "Dharmapuri": (12.1211, 78.1582, 480.0, 20.0),
    "Krishnagiri": (12.5186, 78.2137, 512.0, 25.0),
    "Coimbatore": (11.0168, 76.9558, 411.0, 28.0),
    "Tiruppur": (11.1085, 77.3411, 295.0, 16.0),
    "Erode": (11.3424, 77.7281, 183.0, 12.0),
    "The Nilgiris": (11.4166, 76.6946, 2200.0, 35.0),
    "Tiruchirappalli": (10.7905, 78.7047, 85.0, 6.0),
    "Karur": (10.9601, 78.0766, 122.0, 8.0),
    "Perambalur": (11.2332, 78.8821, 143.0, 11.0),
    "Ariyalur": (11.1399, 79.0736, 76.0, 7.0),
    "Thanjavur": (10.7870, 79.1378, 57.0, 3.0),
    "Tiruvarur": (10.7744, 79.6366, 10.0, 2.0),
    "Nagapattinam": (10.7672, 79.8449, 4.0, 1.0),
    "Mayiladuthurai": (11.1026, 79.6521, 9.0, 2.0),
    "Pudukkottai": (10.3797, 78.8205, 100.0, 5.0),
    "Madurai": (9.9252, 78.1198, 101.0, 10.0),
    "Theni": (10.0104, 77.4768, 290.0, 24.0),
    "Dindigul": (10.3673, 77.9803, 268.0, 18.0),
    "Ramanathapuram": (9.3639, 78.8320, 12.0, 1.0),
    "Sivaganga": (9.8433, 78.4809, 82.0, 4.0),
    "Virudhunagar": (9.5855, 77.9556, 102.0, 7.0),
    "Tirunelveli": (8.7139, 77.7567, 47.0, 12.0),
    "Tenkasi": (8.9585, 77.3111, 143.0, 22.0),
    "Thoothukudi": (8.7642, 78.1348, 8.0, 2.0),
    "Kanyakumari": (8.0883, 77.5385, 13.0, 8.0),
}

# Mapping: River Name -> list of districts it flows through (in order)
RIVER_FLOWS = {
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

RIVER_LIMITS = {
    "Cauvery River": (85.0, 120.0),
    "Adyar River": (2.5, 7.5),
    "Cooum River": (1.8, 5.0),
    "Palar River": (6.2, 15.0),
    "Ponnaiyar River": (18.5, 35.0),
    "Vellar River": (5.0, 12.0),
    "Vaigai River": (45.0, 85.0),
    "Thamirabarani River": (11.0, 24.0),
    "Bhavani River": (16.5, 32.0)
}

def seed_data():
    db = SessionLocal()
    try:
        logger.info("Verifying districts and fetching mappings...")
        districts = db.query(District).all()
        if not districts:
            logger.error("No districts found. Run seed_districts.py first.")
            return
            
        dist_map = {d.name: d.id for d in districts}
        # Handle "Nilgiris" name mismatch if any
        if "The Nilgiris" in dist_map and "Nilgiris" not in dist_map:
            dist_map["Nilgiris"] = dist_map["The Nilgiris"]
        elif "Nilgiris" in dist_map and "The Nilgiris" not in dist_map:
            dist_map["The Nilgiris"] = dist_map["Nilgiris"]

        # 1. Seed Elevation Zones (DemTile)
        if db.query(DemTile).count() == 0:
            logger.info("Seeding dem_tiles...")
            for name, data in TN_DISTRICTS.items():
                if name in dist_map:
                    dem = DemTile(
                        district_id=dist_map[name],
                        elevation=int(data[2]),
                        geom_json={"type": "Point", "coordinates": [data[1], data[0]]}
                    )
                    db.add(dem)
            db.commit()
            logger.info("Successfully seeded dem_tiles.")
        else:
            logger.info("dem_tiles already seeded.")

        # 2. Seed River Levels
        if db.query(RiverLevel).count() == 0:
            logger.info("Seeding river_levels...")
            for river_name, path in RIVER_FLOWS.items():
                limits = RIVER_LIMITS[river_name]
                for d_name in path:
                    if d_name in dist_map:
                        river = RiverLevel(
                            id=uuid.uuid4(),
                            district_id=dist_map[d_name],
                            river_name=river_name,
                            station_name=f"{river_name} - {d_name} Gauging Station",
                            current_level=limits[0],
                            danger_level=limits[1]
                        )
                        db.add(river)
            db.commit()
            logger.info("Successfully seeded river_levels.")
        else:
            logger.info("river_levels already seeded.")

        # 3. Seed Shelters & Hospitals
        if db.query(Shelter).count() == 0:
            logger.info("Seeding shelters...")
            shelter_list = [
                ("Chennai Port Trust Community Shelter", "Chennai", 2000, 80.29, 13.10),
                ("Kancheepuram Cyclone Center", "Kancheepuram", 1500, 79.70, 12.83),
                ("Cuddalore Coastal Shelter", "Cuddalore", 3000, 79.77, 11.75),
                ("Nagapattinam Relief Depot", "Nagapattinam", 2500, 79.84, 10.77),
                ("Trichy Junction Shelter", "Tiruchirappalli", 1200, 78.70, 10.79),
                ("Madurai Sports Complex Camp", "Madurai", 1800, 78.12, 9.93),
                ("Coimbatore Municipal Hall", "Coimbatore", 1000, 76.96, 11.02),
                ("Tirunelveli Community Hall", "Tirunelveli", 1500, 77.76, 8.71),
                ("Thanjavur Delta Safety Camp", "Thanjavur", 2000, 79.14, 10.79),
                ("Erode Relief Camp", "Erode", 1000, 77.72, 11.34)
            ]
            for name, d_name, cap, lon, lat in shelter_list:
                if d_name in dist_map:
                    sh = Shelter(
                        id=uuid.uuid4(),
                        district_id=dist_map[d_name],
                        name=name,
                        capacity=cap,
                        geom_json={"type": "Point", "coordinates": [lon, lat]}
                    )
                    db.add(sh)
            db.commit()
            logger.info("Successfully seeded shelters.")
        else:
            logger.info("shelters already seeded.")

        if db.query(Hospital).count() == 0:
            logger.info("Seeding hospitals...")
            hospital_list = [
                ("Chennai Government General Hospital", "Chennai", 80.27, 13.08),
                ("Kancheepuram Government Hospital", "Kancheepuram", 79.70, 12.83),
                ("Cuddalore District Head Hospital", "Cuddalore", 79.75, 11.74),
                ("Nagapattinam General Hospital", "Nagapattinam", 79.84, 10.76),
                ("Trichy Medical College Hospital", "Tiruchirappalli", 78.68, 10.76),
                ("Madurai Rajaji Hospital", "Madurai", 78.13, 9.83),
                ("Coimbatore Medical College Hospital", "Coimbatore", 77.04, 11.03),
                ("Tirunelveli Medical College", "Tirunelveli", 77.75, 8.71),
                ("Thanjavur Medical College Hospital", "Thanjavur", 79.13, 10.78),
                ("Erode District Hospital", "Erode", 77.72, 11.34)
            ]
            for name, d_name, lon, lat in hospital_list:
                if d_name in dist_map:
                    h = Hospital(
                        id=uuid.uuid4(),
                        district_id=dist_map[d_name],
                        name=name,
                        geom_json={"type": "Point", "coordinates": [lon, lat]}
                    )
                    db.add(h)
            db.commit()
            logger.info("Successfully seeded hospitals.")
        else:
            logger.info("hospitals already seeded.")

        # 4. Seed Dams
        if db.query(Dam).count() == 0:
            logger.info("Seeding dams...")
            dam_list = [
                ("Mettur Dam", 93470.0, "Salem", 85.0, 78.15, 11.66),
                ("Chembarambakkam Reservoir", 3645.0, "Chennai", 2.5, 80.27, 13.08),
                ("Poondi Reservoir", 3231.0, "Thiruvallur", 1.8, 79.91, 13.14),
                ("Sathanur Dam", 1688.0, "Tiruvannamalai", 18.5, 79.07, 12.23),
                ("Vaigai Dam", 3278.0, "Theni", 45.0, 77.47, 10.01),
                ("Papanasam Dam", 3000.0, "Tirunelveli", 11.0, 77.75, 8.71)
            ]
            for name, cap, dist_name, base_release, lon, lat in dam_list:
                if dist_name in dist_map:
                    dam = Dam(
                        id=uuid.uuid4(),
                        name=name,
                        capacity_mcft=cap,
                        current_release_cusecs=base_release * 10.0,
                        inflow_cusecs=base_release * 11.0,
                        fill_pct=65.0,
                        district_id=dist_map[dist_name]
                    )
                    db.add(dam)
            db.commit()
            logger.info("Successfully seeded dams.")

        # 5. Seed Catchments
        if db.query(Catchment).count() == 0:
            logger.info("Seeding catchments...")
            catchment_list = [
                ("Cauvery Delta Basin", 8500.0, 0.45, "Clayey Loam", "Thanjavur"),
                ("Adyar Catchment Basin", 860.0, 0.65, "Alluvial Sandy", "Chennai"),
                ("Cooum River Basin", 400.0, 0.60, "Clayey", "Thiruvallur"),
                ("Palar River Basin", 3000.0, 0.50, "Red Sandy", "Vellore"),
                ("Vaigai Catchment Basin", 7000.0, 0.40, "Sandy Clay", "Madurai")
            ]
            for name, area, coeff, soil, dist_name in catchment_list:
                if dist_name in dist_map:
                    cat = Catchment(
                        id=uuid.uuid4(),
                        name=name,
                        area_sqkm=area,
                        runoff_coefficient=coeff,
                        soil_type=soil,
                        district_id=dist_map[dist_name]
                    )
                    db.add(cat)
            db.commit()
            logger.info("Successfully seeded catchments.")

        # 6. Seed Sensors
        if db.query(Sensor).count() == 0:
            logger.info("Seeding sensors...")
            # Weather Stations
            ws_list = [
                ("Chennai Nungambakkam AWS", "weather_station", 13.067, 80.248, "Chennai"),
                ("Tiruchirappalli Town AWS", "weather_station", 10.765, 78.686, "Tiruchirappalli"),
                ("Madurai Airport AWS", "weather_station", 9.834, 78.093, "Madurai"),
                ("Coimbatore Peelamedu AWS", "weather_station", 11.030, 77.042, "Coimbatore")
            ]
            for name, s_type, lat, lon, dist_name in ws_list:
                if dist_name in dist_map:
                    db.add(Sensor(id=uuid.uuid4(), name=name, type=s_type, status="Active", latitude=lat, longitude=lon, district_id=dist_map[dist_name]))
            
            # Rain Gauges
            rg_list = [
                ("Rain Gauge Salem", "rain_gauge", 11.66, 78.15, "Salem"),
                ("Rain Gauge Cuddalore", "rain_gauge", 11.75, 79.75, "Cuddalore"),
                ("Rain Gauge Nagapattinam", "rain_gauge", 10.77, 79.84, "Nagapattinam"),
                ("Rain Gauge Tirunelveli", "rain_gauge", 8.71, 77.76, "Tirunelveli"),
                ("Rain Gauge Nilgiris", "rain_gauge", 11.41, 76.70, "The Nilgiris")
            ]
            for name, s_type, lat, lon, dist_name in rg_list:
                if dist_name in dist_map:
                    db.add(Sensor(id=uuid.uuid4(), name=name, type=s_type, status="Active", latitude=lat, longitude=lon, district_id=dist_map[dist_name]))
            db.commit()
            logger.info("Successfully seeded sensors.")

        # 7. Seed HistoricalFloodEvents
        if db.query(HistoricalFloodEvent).count() == 0:
            logger.info("Seeding historical flood events...")
            hist_list = [
                (2023, "Cyclone Michaung Floods", "Extreme", ["Chennai", "Thiruvallur", "Kancheepuram", "Chengalpattu"], 4500000, 17, 9500.0),
                (2021, "Northeast Monsoon Flash Floods", "High", ["Chennai", "Cuddalore", "Thanjavur", "Nagapattinam"], 1200000, 14, 1500.0),
                (2015, "South Indian Floods (Chennai)", "Extreme", ["Chennai", "Kancheepuram", "Cuddalore", "Thiruvallur", "Thanjavur"], 8200000, 470, 22000.0),
                (2020, "Cyclone Nivar", "Moderate", ["Cuddalore", "Villupuram", "Chennai"], 650000, 4, 600.0),
                (2018, "Cyclone Gaja Floods", "High", ["Nagapattinam", "Thanjavur", "Tiruvarur", "Pudukkottai"], 1500000, 45, 5400.0),
                (2005, "Tamil Nadu Monsoon Floods", "High", ["Chennai", "Cuddalore", "Tiruchirappalli", "Madurai"], 2500000, 120, 3500.0)
            ]
            for year, name, sev, districts, pop, deaths, dmg in hist_list:
                db.add(HistoricalFloodEvent(
                    id=uuid.uuid4(),
                    year=year,
                    event_name=name,
                    severity=sev,
                    affected_districts=districts,
                    affected_people=pop,
                    deaths=deaths,
                    damage_cr=dmg
                ))
            db.commit()
            logger.info("Successfully seeded historical flood events.")
            
    except Exception as e:
        logger.error(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
