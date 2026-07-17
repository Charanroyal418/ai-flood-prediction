import os
import json
import pandas as pd
import geopandas as gpd
from pathlib import Path
from config import CLEANED_DIR, REPORTS_DIR

def profile_dataset(file_path):
    stats = {
        "name": file_path.name,
        "source": "TN Government / Open Source",
        "coverage": "Tamil Nadu",
        "format": file_path.suffix.upper()[1:],
        "crs": "N/A",
        "records": 0,
        "columns": [],
        "missing_values": 0,
        "duplicate_records": 0,
        "file_size_mb": round(file_path.stat().st_size / (1024 * 1024), 2),
        "ready_for_ml": True,
        "needs_cleaning": False,
        "geometry_type": "None"
    }
    
    try:
        if file_path.suffix == '.csv':
            df = pd.read_csv(file_path)
            stats["records"] = len(df)
            stats["columns"] = list(df.columns)
            stats["missing_values"] = int(df.isna().sum().sum())
            stats["duplicate_records"] = int(df.duplicated().sum())
        elif file_path.suffix == '.geojson':
            gdf = gpd.read_file(file_path)
            stats["records"] = len(gdf)
            stats["columns"] = list(gdf.columns)
            stats["crs"] = str(gdf.crs)
            stats["missing_values"] = int(gdf.isna().sum().sum())
            stats["geometry_type"] = str(gdf.geom_type.unique())
    except Exception as e:
        print(f"Error profiling {file_path.name}: {e}")
        stats["ready_for_ml"] = False
        stats["needs_cleaning"] = True

    return stats

def main():
    metadata_list = []
    for f in CLEANED_DIR.glob('*'):
        if f.is_file():
            meta = profile_dataset(f)
            metadata_list.append(meta)
            # Write individual JSON metadata
            with open(CLEANED_DIR / f"{f.stem}_metadata.json", "w") as jf:
                json.dump(meta, jf, indent=2)

    # Generate DATASET_INVENTORY.md
    with open(REPORTS_DIR / "DATASET_INVENTORY.md", "w") as md:
        md.write("# Dataset Inventory\n\n")
        md.write("| Dataset | Format | Coverage | Records | Columns | Ready for ML | Needs Cleaning |\n")
        md.write("|---|---|---|---|---|---|---|\n")
        for m in metadata_list:
            md.write(f"| {m['name']} | {m['format']} | {m['coverage']} | {m['records']} | {len(m['columns'])} | {m['ready_for_ml']} | {m['needs_cleaning']} |\n")

    # Generate DATASET_SUMMARY.md
    with open(REPORTS_DIR / "DATASET_SUMMARY.md", "w") as md:
        md.write("# Dataset Summary\n\n")
        md.write("## Overall Readiness\n")
        ready_count = sum(1 for m in metadata_list if m['ready_for_ml'])
        score = int((ready_count / max(len(metadata_list), 1)) * 100)
        md.write(f"**Readiness Score: {score}%**\n\n")
        md.write("## Missing Datasets\n")
        md.write("- High-Resolution DEM (30m+)\n- Soil Data\n- Live Real-time API credentials\n")

    print(f"Generated profiling reports in {REPORTS_DIR}")

if __name__ == "__main__":
    main()
