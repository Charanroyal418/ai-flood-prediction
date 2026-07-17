import os
import sys
import geopandas as gpd
from sqlalchemy import create_engine
from geoalchemy2 import Geometry

# Add the app directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app.core.config import settings

def ingest_districts(shapefile_path: str):
    print(f"Ingesting district boundaries from {shapefile_path}...")
    try:
        # Read the shapefile
        gdf = gpd.read_file(shapefile_path)
        
        # Ensure CRS is EPSG:4326 (WGS84) for our database
        if gdf.crs != "EPSG:4326":
            print(f"Converting CRS from {gdf.crs} to EPSG:4326...")
            gdf = gdf.to_crs("EPSG:4326")
            
        # We need to map the shapefile's column name to our DB 'name' column.
        # Assuming common shapefile column names for district names:
        name_col = None
        for col in ["NAME", "DISTRICT", "Dist_Name", "DIST_NAME", "name"]:
            if col in gdf.columns:
                name_col = col
                break
                
        if not name_col:
            print("❌ Could not find a recognizable District Name column in the shapefile.")
            print(f"Available columns: {gdf.columns.tolist()}")
            return
            
        # Prepare DataFrame for insertion
        # Note: We must match our SQLAlchemy model table name ("district")
        db_gdf = gdf[[name_col, "geometry"]].copy()
        db_gdf.rename(columns={name_col: "name", "geometry": "geom"}, inplace=True)
        
        engine = create_engine(settings.DATABASE_URL)
        
        # Write to PostGIS using geopandas to_postgis wrapper
        db_gdf.to_postgis(
            name="district",
            con=engine,
            if_exists="append", # Or 'replace' if doing a fresh wipe
            index=False,
            dtype={'geom': Geometry('POLYGON', srid=4326)}
        )
        print(f"✅ Successfully ingested {len(db_gdf)} district polygons into Supabase.")
        
    except Exception as e:
        print(f"❌ Failed to ingest districts: {e}")

if __name__ == "__main__":
    print("FloodSense AI - PostGIS Ingestion Engine")
    print("-------------------------------------")
    target = input("Enter the path to your District Boundaries Shapefile (.shp or .geojson): ")
    if os.path.exists(target):
        ingest_districts(target)
    else:
        print("❌ File does not exist.")
