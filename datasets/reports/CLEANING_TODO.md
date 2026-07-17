# Cleaning TODO

### cwc_rainfall_2021_2025.csv
- Handle missing values (NaNs) in precipitation columns.
- Normalize timestamp format to ISO 8601.
- Resample to consistent daily/hourly frequencies.

### cwc_river_water_levels_2021_2025.csv
- Identify and remove duplicate sensor readings.
- Fill short gaps in telemetry data using linear interpolation.
- Normalize column names (e.g., standardizing `wl`, `water_level`, `level_m`).

### census_2011_population_data.xlsx
- Drop unstructured header/footer rows.
- Pivot tables to map District/Taluk IDs to population density metrics.
- Export cleaned output to a standardized CSV format for database ingestion.

### osm_southern_zone.pbf
- Use `osmium` or `ogr2ogr` to extract the `highway`, `building`, and `amenity=hospital` layers.
- Clip the extracted features to the Tamil Nadu district boundaries to reduce file size.
- Reproject extracted features to EPSG:4326.

### tn_district_boundaries.geojson
- Validate geometries (fix invalid polygons, self-intersections).
- Ensure CRS is explicitly defined as EPSG:4326.
- Standardize district name spellings to match the CWC and IMD datasets.

### PDF Flood Reports
- Manually digitize the maps/tables into polygons or tabular data.
- Georeference any static maps using QGIS.
