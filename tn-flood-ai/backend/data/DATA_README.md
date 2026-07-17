# TN FloodAI Data Catalog

This directory (`backend/data/`) acts as the centralized repository for all datasets used in the TN FloodAI MVP.

## Structure
- `/raw`: Unmodified datasets straight from the source, categorized by theme.
- `/cleaned`: Intermediate files after passing through the automated cleaning pipeline.
- `/processed`: Final structured data ready for AI model training or PostGIS ingestion.
- `/gis`: Master storage for `.geojson` and `.shp` files specifically staged for Database ingestion.
- `/raster`: Specialized storage for large TIFF files (like DEM Elevation models).
- `/models`: Storage for serialized Scikit-Learn / XGBoost models (`.pkl`).

## Raw Categories
The `organize_data.py` script automatically scans file names and sorts them into:
1. `boundaries/`: District and administrative shapefiles.
2. `elevation_dem/`: Topographical raster data.
3. `rivers/`: Hydrological networks.
4. `infrastructure/`: Roads, hospitals, and relief shelters.
5. `rainfall/` & `weather/`: Meteorological timeseries.
6. `history/`: Historical flood event records.
