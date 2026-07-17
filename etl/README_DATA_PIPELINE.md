# TN FloodAI - ETL Data Pipeline

This repository automates **Phase 3B** of the Flood Prediction System. It scans, deduplicates, validates, cleans, and imports geospatial and tabular datasets into PostGIS.

## Folder Structure

```text
tn-flood-ai/etl/
├── config.py                 # Core paths and DB strings
├── 01_scanner.py             # Deduplicates & organizes raw files
├── 02_validator_cleaner.py   # Cleans CSVs and standardizes GeoJSONs
├── 03_profiler.py            # Generates metadata and markdown reports
├── sql/
│   └── schema.sql            # PostGIS table definitions
└── importers/
    └── import_boundaries.py  # Script to ingest geometries to DB
```

## Cleaning Workflow

1. **Scan**: Run `python 01_scanner.py`. It calculates SHA-256 hashes to archive duplicates, extracts `.zip` files automatically, and routes files (based on keywords like `rainfall`, `.shp`, `.osm`) into `datasets/raw/<category>`.
2. **Clean**: Run `python 02_validator_cleaner.py`. This utilizes `pandas` and `geopandas` to normalize district names (e.g., `Tuticorin` -> `Thoothukudi`), repair invalid GIS geometries (`make_valid()`), ensure all files are EPSG:4326, and export them into `datasets/cleaned/`.
3. **Profile**: Run `python 03_profiler.py`. Generates detailed `.json` metadata alongside comprehensive markdown reports in `datasets/reports/`.
4. **Database Import**: After initializing the schema with `psql -f sql/schema.sql`, run the importer scripts in `importers/` to stream the clean data into the PostgreSQL/PostGIS database.

## Prerequisites
You must have the following Python libraries installed:
```bash
pip install pandas geopandas rasterio shapely sqlalchemy psycopg2-binary geoalchemy2
```
