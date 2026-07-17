import os
import sys
import geopandas as gpd
from sqlalchemy import create_engine
import logging

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from config import CLEANED_DIR, DATABASE_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def import_roads():
    logger.info("Importing Roads Network into PostGIS...")
    roads_file = CLEANED_DIR / "tn_roads.geojson"
    
    if not roads_file.exists():
        logger.warning(f"File not found: {roads_file}")
        return
        
    gdf = gpd.read_file(roads_file)
    
    engine = create_engine(DATABASE_URL)
    
    # We cast geometries to EWKT for GeoAlchemy2 or let pandas to_postgis handle it natively
    try:
        gdf[['type', 'district_id', 'geometry']].to_postgis(
            "roads", engine, if_exists="append", index=False
        )
        logger.info("Roads imported successfully.")
    except Exception as e:
        logger.error(f"Failed to import roads: {e}")

if __name__ == "__main__":
    import_roads()
