import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.district import District
from app.models.weather import Rainfall
from app.models.river import RiverLevel
from app.models.terrain import DemTile

def get_training_data() -> pd.DataFrame:
    """
    Extract raw data from PostgreSQL and engineer features.
    In a real production system, this would query historical data over time.
    For this phase, we extract the latest snapshot per district and synthesize historical ranges if needed.
    """
    db: Session = SessionLocal()
    try:
        districts = db.query(District).all()
        
        data = []
        for d in districts:
            # Get latest rainfall
            latest_rainfall = db.query(Rainfall).filter(Rainfall.district_id == d.id).order_by(Rainfall.recorded_at.desc()).first()
            r_24h = latest_rainfall.mm_24h if latest_rainfall else np.random.uniform(0, 50)
            
            # Synthesize 72h based on 24h for training variance
            r_72h = r_24h * np.random.uniform(1.5, 3.0)

            # Get latest river level
            latest_river = db.query(RiverLevel).filter(RiverLevel.district_id == d.id).order_by(RiverLevel.recorded_at.desc()).first()
            river_lvl = latest_river.current_level if latest_river else np.random.uniform(5, 15)
            danger_lvl = latest_river.danger_level if latest_river else 15.0
            
            # Relative river level (closer to 1 means closer to danger)
            relative_river = river_lvl / danger_lvl if danger_lvl > 0 else 0

            # Get DEM (mock terrain for now since raster extraction requires PostGIS rasters which is complex in pure ORM)
            # We'll assign a random elevation profile based on district name (coastal vs inland)
            is_coastal = d.name.lower() in ["chennai", "tiruvallur", "kancheepuram", "cuddalore", "nagapattinam", "tuticorin", "kanyakumari"]
            elevation = np.random.uniform(0, 10) if is_coastal else np.random.uniform(10, 500)
            slope = np.random.uniform(0, 5) if is_coastal else np.random.uniform(5, 30)

            # Build feature dictionary
            row = {
                "district_id": d.id,
                "district_name": d.name,
                "rainfall_24h": r_24h,
                "rainfall_72h": r_72h,
                "river_level": relative_river, # normalized
                "river_discharge": np.random.uniform(100, 5000),
                "elevation": elevation,
                "slope": slope,
                "distance_to_river": np.random.uniform(0, 5000),
                "impervious_area": np.random.uniform(30, 90) if is_coastal else np.random.uniform(5, 40),
                "population_density": np.random.uniform(500, 20000) if is_coastal else np.random.uniform(100, 1000)
            }
            data.append(row)
            
        df = pd.DataFrame(data)
        
        # We need thousands of rows for robust ML training. 
        # We will heavily oversample and add Gaussian noise to simulate a large historical dataset.
        synthetic_dfs = [df]
        for _ in range(500): # Create ~19,000 synthetic records from the 38 districts
            noisy_df = df.copy()
            noisy_df["rainfall_24h"] += np.random.normal(0, 20, len(df))
            noisy_df["rainfall_24h"] = noisy_df["rainfall_24h"].clip(lower=0)
            
            noisy_df["rainfall_72h"] += np.random.normal(0, 50, len(df))
            noisy_df["rainfall_72h"] = noisy_df["rainfall_72h"].clip(lower=0)
            
            noisy_df["river_level"] += np.random.normal(0, 0.2, len(df))
            noisy_df["river_level"] = noisy_df["river_level"].clip(lower=0)
            
            synthetic_dfs.append(noisy_df)
            
        final_df = pd.concat(synthetic_dfs, ignore_index=True)
        return final_df
        
    finally:
        db.close()


def generate_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    Deterministic Rule-Based Target Creation.
    Because we lack historical flood labels, we infer risk based on physical hydrological rules.
    """
    conditions = [
        # Severe Risk (Class 4)
        (df["rainfall_24h"] > 200) | ((df["rainfall_72h"] > 350) & (df["river_level"] > 0.9)),
        # High Risk (Class 3)
        (df["rainfall_24h"] > 120) | ((df["rainfall_72h"] > 200) & (df["river_level"] > 0.8)) | (df["river_level"] >= 1.0),
        # Moderate Risk (Class 2)
        (df["rainfall_24h"] > 60) | (df["rainfall_72h"] > 100) | (df["river_level"] > 0.6),
        # Low Risk (Class 1)
        (df["rainfall_24h"] > 20) | (df["river_level"] > 0.4)
    ]
    
    choices = [4, 3, 2, 1]
    
    df["risk_label"] = np.select(conditions, choices, default=0)
    return df
