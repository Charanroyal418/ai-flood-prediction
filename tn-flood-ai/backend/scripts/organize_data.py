import os
import shutil
from pathlib import Path

# Setup directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

CATEGORIES = {
    "boundaries": ["district", "taluk", "village", "boundary", "admin"],
    "elevation_dem": ["dem", "elevation", "slope", "terrain"],
    "rivers": ["river", "stream", "drainage", "water"],
    "infrastructure": ["road", "hospital", "shelter", "building", "infrastructure"],
    "weather": ["weather", "temperature", "humidity", "climate"],
    "rainfall": ["rain", "precipitation", "mm"],
    "history": ["history", "event", "past_flood"]
}

def create_directories():
    print("Creating data directory structure...")
    folders = ["raw", "processed", "cleaned", "gis", "models", "raster", "vector"]
    for folder in folders:
        os.makedirs(DATA_DIR / folder, exist_ok=True)
        
    for category in CATEGORIES.keys():
        os.makedirs(DATA_DIR / "raw" / category, exist_ok=True)
    
    os.makedirs(DATA_DIR / "raw" / "uncategorized", exist_ok=True)
    print("Directories created.")

def identify_category(filename: str) -> str:
    name_lower = filename.lower()
    for cat, keywords in CATEGORIES.items():
        if any(kw in name_lower for kw in keywords):
            return cat
    return "uncategorized"

def organize_datasets(source_dir: str):
    source_path = Path(source_dir)
    if not source_path.exists():
        print(f"Error: Source directory {source_path} does not exist.")
        return

    print(f"Scanning {source_path} for datasets...")
    
    moved_count = 0
    # Walk through all files recursively
    for root, _, files in os.walk(source_path):
        for file in files:
            # Skip hidden files
            if file.startswith('.'): continue
            
            # Common geospatial / data extensions
            if file.endswith(('.shp', '.shx', '.dbf', '.prj', '.cpg', '.geojson', '.csv', '.tif', '.tiff', '.json', '.xlsx')):
                file_path = Path(root) / file
                category = identify_category(file)
                
                dest_dir = DATA_DIR / "raw" / category
                dest_path = dest_dir / file
                
                # Copy instead of move to preserve original downloads just in case
                if not dest_path.exists():
                    shutil.copy2(file_path, dest_path)
                    print(f"Organized: {file} -> {category}/")
                    moved_count += 1

    print(f"\nOrganization Complete. {moved_count} files successfully categorized into backend/data/raw/.")

if __name__ == "__main__":
    create_directories()
    # Prompt the user for the raw downloads path
    src = input("Enter the absolute path to your downloaded raw datasets folder (e.g., C:/Users/.../Downloads/datasets): ")
    organize_datasets(src)
