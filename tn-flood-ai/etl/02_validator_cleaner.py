import os
import pandas as pd
import geopandas as gpd
import logging
from pathlib import Path
from config import RAW_DIR, CLEANED_DIR

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Standardization maps
DISTRICT_MAP = {
    "tuticorin": "Thoothukudi",
    "kanniyakumari": "Kanyakumari",
    "kanya kumari": "Kanyakumari",
    "chengalpattu": "Chengalpattu",
    "tiruvallur": "Tiruvallur"
}

def standardize_districts(df, col_name='district'):
    if col_name in df.columns:
        df[col_name] = df[col_name].astype(str).str.strip().str.title()
        df[col_name] = df[col_name].str.lower().replace(DISTRICT_MAP).str.title()
    return df

def clean_csv(file_path):
    logger.info(f"Cleaning CSV: {file_path.name}")
    try:
        df = pd.read_csv(file_path)
        df.drop_duplicates(inplace=True)
        # Convert standard date columns if they exist
        date_cols = [c for c in df.columns if 'date' in c.lower() or 'time' in c.lower()]
        for col in date_cols:
            df[col] = pd.to_datetime(df[col], errors='coerce').dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        df = standardize_districts(df)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        
        out_path = CLEANED_DIR / file_path.name
        df.to_csv(out_path, index=False)
        return True
    except Exception as e:
        logger.error(f"Error cleaning CSV {file_path.name}: {e}")
        return False

def clean_gis(file_path):
    logger.info(f"Cleaning GIS file: {file_path.name}")
    try:
        gdf = gpd.read_file(file_path)
        # Fix invalid geometries
        gdf['geometry'] = gdf['geometry'].make_valid()
        # Drop empty geometries
        gdf = gdf[~gdf['geometry'].is_empty]
        # Reproject to EPSG:4326
        if gdf.crs != "EPSG:4326":
            gdf = gdf.to_crs(epsg=4326)
            
        gdf = standardize_districts(gdf)
        
        # Save as GeoJSON for uniformity in cleaned/
        out_path = CLEANED_DIR / f"{file_path.stem}.geojson"
        gdf.to_file(out_path, driver="GeoJSON")
        return True
    except Exception as e:
        logger.error(f"Error cleaning GIS {file_path.name}: {e}")
        return False

def main():
    for root, _, files in os.walk(RAW_DIR):
        for file in files:
            file_path = Path(root) / file
            ext = file_path.suffix.lower()
            
            if ext == '.csv':
                clean_csv(file_path)
            elif ext in ['.geojson', '.shp']:
                clean_gis(file_path)
            elif ext == '.xlsx':
                # Simplified Excel handling
                df = pd.read_excel(file_path)
                out_path = CLEANED_DIR / f"{file_path.stem}.csv"
                df.to_csv(out_path, index=False)
                clean_csv(out_path)

if __name__ == "__main__":
    main()
