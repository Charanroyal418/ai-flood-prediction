import os
import sys
import geopandas as gpd
from sqlalchemy import create_engine

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from config import CLEANED_DIR, DATABASE_URL

def import_boundaries():
    print("Importing District Boundaries into PostGIS...")
    boundary_file = CLEANED_DIR / "tn_district_boundaries.geojson"
    
    if not boundary_file.exists():
        print(f"File not found: {boundary_file}")
        return
        
    gdf = gpd.read_file(boundary_file)
    
    # Ensure standard names
    if 'name' not in gdf.columns:
        if 'district' in gdf.columns:
            gdf.rename(columns={'district': 'name'}, inplace=True)
            
    engine = create_engine(DATABASE_URL)
    
    # Push to PostGIS using GeoAlchemy2/GeoPandas
    # We write to a temporary table and then merge/insert into 'districts'
    gdf[['name', 'geometry']].to_postgis("districts", engine, if_exists="replace", index=False)
    print("Boundaries imported successfully.")

if __name__ == "__main__":
    import_boundaries()
