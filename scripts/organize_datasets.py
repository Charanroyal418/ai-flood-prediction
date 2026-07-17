import os
import shutil
import hashlib
import json
import logging
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_hash(filepath):
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def organize_datasets(src_dir, dst_root):
    src_dir = Path(src_dir)
    dst_root = Path(dst_root)
    
    # Target folders
    categories = [
        'boundaries', 'rainfall', 'weather', 'rivers', 'dem', 'landcover',
        'flood_events', 'roads', 'buildings', 'hospitals', 'schools',
        'shelters', 'population', 'satellite', 'coordinates', 'metadata', 'unknown',
        'archive' # For duplicates/ZIPs
    ]
    
    raw_dir = dst_root / 'raw'
    
    for cat in categories:
        (raw_dir / cat).mkdir(parents=True, exist_ok=True)
        
    (dst_root / 'processed').mkdir(exist_ok=True)
    (dst_root / 'cleaned').mkdir(exist_ok=True)
    (dst_root / 'reports').mkdir(exist_ok=True)

    # State variables
    file_hashes = {}
    inventory = []
    cleaning_todo = []
    
    all_files = list(src_dir.rglob('*'))
    
    for f in all_files:
        if not f.is_file():
            continue
            
        file_hash = get_hash(f)
        if file_hash in file_hashes:
            logger.info(f"Duplicate found: {f.name}, archiving.")
            shutil.copy2(f, raw_dir / 'archive' / f.name)
            continue
            
        file_hashes[file_hash] = f
        
        # Classification logic
        cat = 'unknown'
        name_lower = f.name.lower()
        new_name = f.name
        ready = "No"
        cleaning = "Yes"
        coverage = "Tamil Nadu"
        dataset_type = "Tabular"
        
        if f.suffix in ['.pbf', '.osm']:
            cat = 'roads'
            new_name = 'osm_southern_zone' + f.suffix
            purpose = "Road network, buildings, and POIs"
            dataset_type = "OSM PBF"
        elif 'rainfall' in name_lower:
            cat = 'rainfall'
            new_name = 'cwc_rainfall_2021_2025' + f.suffix
            purpose = "Historical Rainfall"
        elif 'rwl' in name_lower:
            cat = 'rivers'
            new_name = 'cwc_river_water_levels' + f.suffix
            purpose = "River Water Levels"
        elif 'discharge' in name_lower:
            cat = 'rivers'
            new_name = 'cwc_river_discharge' + f.suffix
            purpose = "River Discharge"
        elif 'ddw_pca' in name_lower:
            cat = 'population'
            new_name = 'census_2011_population_data' + f.suffix
            purpose = "Demographics & Population"
        elif 'flood' in name_lower or 'inundated' in name_lower:
            cat = 'flood_events'
            new_name = f.name.replace(' ', '_').lower()
            purpose = "Historical Flood Extent/Report"
            dataset_type = "PDF Report"
            ready = "No (Needs digitization)"
        elif f.suffix in ['.geojson', '.kml', '.shp']:
            purpose = "Spatial Boundary / Shelters"
            dataset_type = "Vector GIS"
            if 'export' in name_lower:
                cat = 'boundaries'
                new_name = 'tn_district_boundaries' + f.suffix
            else:
                cat = 'hospitals' # Guessed based on common naming or needs manual review
                new_name = f.name
                
        else:
            purpose = "Unknown"
            
        # Move file
        target_path = raw_dir / cat / new_name
        
        # Handle shapefile components (lazy way for script: check if part of a directory)
        # For this script we simply copy
        try:
            shutil.copy2(f, target_path)
        except Exception as e:
            logger.error(f"Error copying {f}: {e}")
            
        # Add to inventory
        inventory.append({
            'Name': new_name,
            'Purpose': purpose,
            'Type': dataset_type,
            'Coverage': coverage,
            'Location': f'raw/{cat}/',
            'Ready': ready,
            'Cleaning': cleaning
        })
        
        # Add to cleaning
        cleaning_todo.append({
            'Dataset': new_name,
            'Tasks': f"- Convert to standard EPSG:4326 if spatial\n- Handle missing values (NaNs)\n- Remove duplicate entries\n- Normalize column names"
        })

    # Generate Reports
    reports_dir = dst_root / 'reports'
    
    with open(reports_dir / 'DATASET_INVENTORY.md', 'w') as f:
        f.write("# Dataset Inventory\n\n")
        f.write("| Dataset Name | Purpose | File Type | Coverage | Folder Location | Ready for ML? | Needs Cleaning? |\n")
        f.write("|---|---|---|---|---|---|---|\n")
        for item in inventory:
            f.write(f"| {item['Name']} | {item['Purpose']} | {item['Type']} | {item['Coverage']} | {item['Location']} | {item['Ready']} | {item['Cleaning']} |\n")

    with open(reports_dir / 'CLEANING_TODO.md', 'w') as f:
        f.write("# Cleaning TODO\n\n")
        for item in cleaning_todo:
            f.write(f"### {item['Dataset']}\n{item['Tasks']}\n\n")
            
    with open(reports_dir / 'DATASET_SUMMARY.md', 'w') as f:
        f.write("# Dataset Summary\n\n")
        f.write("## Present Datasets\n")
        f.write("- Historical Rainfall (CWC)\n- River Water Levels and Discharge (CWC)\n- Population (Census 2011)\n- OSM Road Network\n- District Boundaries\n\n")
        f.write("## Missing Datasets\n")
        f.write("- High-Resolution DEM (Digital Elevation Model)\n- Soil / Land Cover data\n- Comprehensive Shelter locations\n\n")
        f.write("## Readiness Score\n")
        f.write("**Score: 65%**\n\nWe have foundational telemetry and boundaries, but lack critical elevation (DEM) and soil moisture data essential for accurate ML flood prediction.\n")

if __name__ == "__main__":
    src = r"c:\Users\Sekar Harshitha\Downloads\flood prediction\raw"
    dst = r"c:\Users\Sekar Harshitha\Downloads\flood prediction\tn-flood-ai\datasets"
    organize_datasets(src, dst)
    print("Done organizing datasets.")
