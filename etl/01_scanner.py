import os
import shutil
import hashlib
import zipfile
import logging
from pathlib import Path
from config import RAW_DIR, ARCHIVE_DIR

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CATEGORIES = [
    'boundaries', 'coordinates', 'rainfall', 'weather', 'rivers', 'dem', 'landcover', 
    'flood_events', 'roads', 'buildings', 'hospitals', 'schools', 'shelters', 
    'population', 'satellite', 'metadata', 'unknown'
]

def ensure_folders():
    for cat in CATEGORIES:
        (RAW_DIR / cat).mkdir(parents=True, exist_ok=True)

def get_file_hash(filepath):
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def extract_zips(src_dir):
    for z in Path(src_dir).rglob("*.zip"):
        logger.info(f"Extracting {z.name}...")
        extract_path = z.parent / z.stem
        with zipfile.ZipFile(z, 'r') as zip_ref:
            zip_ref.extractall(extract_path)
        shutil.move(str(z), str(ARCHIVE_DIR / z.name))
        logger.info(f"Moved original zip {z.name} to archive.")

def classify_and_move(src_dir):
    seen_hashes = set()
    
    for file_path in Path(src_dir).rglob("*"):
        if not file_path.is_file() or file_path.parent == ARCHIVE_DIR or file_path.parent.name in CATEGORIES:
            continue
            
        file_hash = get_file_hash(file_path)
        if file_hash in seen_hashes:
            logger.info(f"Duplicate found: {file_path.name}, moving to archive.")
            shutil.move(str(file_path), str(ARCHIVE_DIR / file_path.name))
            continue
        seen_hashes.add(file_hash)

        name_lower = file_path.name.lower()
        ext = file_path.suffix.lower()
        
        target_cat = 'unknown'
        
        if any(kw in name_lower for kw in ['district', 'taluk', 'village', 'boundary']):
            target_cat = 'boundaries'
        elif any(kw in name_lower for kw in ['rain', 'precip']):
            target_cat = 'rainfall'
        elif any(kw in name_lower for kw in ['weather', 'climate']):
            target_cat = 'weather'
        elif any(kw in name_lower for kw in ['river', 'water_level', 'discharge', 'rwl']):
            target_cat = 'rivers'
        elif any(kw in name_lower for kw in ['dem', 'elevation', 'srtm']):
            target_cat = 'dem'
        elif any(kw in name_lower for kw in ['landcover', 'soil', 'lulc']):
            target_cat = 'landcover'
        elif any(kw in name_lower for kw in ['flood', 'inundated']):
            target_cat = 'flood_events'
        elif any(kw in name_lower for kw in ['road', 'highway', 'osm']):
            target_cat = 'roads'
        elif 'building' in name_lower:
            target_cat = 'buildings'
        elif 'hospital' in name_lower:
            target_cat = 'hospitals'
        elif 'school' in name_lower:
            target_cat = 'schools'
        elif 'shelter' in name_lower or 'relief' in name_lower:
            target_cat = 'shelters'
        elif any(kw in name_lower for kw in ['pop', 'census', 'demographic']):
            target_cat = 'population'
        elif ext in ['.tif', '.tiff', '.jp2']:
            target_cat = 'satellite'
            
        # Move Shapefiles together
        if ext in ['.shp', '.dbf', '.shx', '.prj', '.cpg', '.qmd']:
            base_name = file_path.stem
            # We assume classification is based on the .shp file name usually
            # But here we just move all parts of the shapefile together
            pass
            
        target_dir = RAW_DIR / target_cat
        shutil.move(str(file_path), str(target_dir / file_path.name))
        logger.info(f"Moved {file_path.name} to {target_cat}")

def main():
    ensure_folders()
    src = os.getenv("DOWNLOADS_SRC", str(RAW_DIR))
    extract_zips(src)
    classify_and_move(src)
    logger.info("Scan and Organization complete.")

if __name__ == "__main__":
    main()
