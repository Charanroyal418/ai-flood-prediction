# Database Schema & Data Models

This document outlines the PostgreSQL + PostGIS schema designed for the FloodSense AI Phase 3C architecture.

## ER Diagram (Core)

- `districts` (1) -> (*) `taluks` (1) -> (*) `villages`
- `districts` (1) -> (*) `weather`, `rainfall`, `river_levels`
- `districts` (1) -> (*) `roads`, `buildings`, `hospitals`, `shelters`

## Spatial Geometries

All spatial data is stored in **EPSG:4326** (WGS 84).

| Table | Geometry Type | Purpose |
|---|---|---|
| `districts` | `Polygon` | Administrative boundary |
| `roads` | `LineString` | Highway & street network |
| `buildings` | `Polygon` | Critical infrastructure footprints |
| `dem_tiles` | `Polygon` | Bounding box of raster elevation tiles |
| `rivers` | `MultiLineString` | Hydrological flow paths |
| `flood_events` | `Polygon` | Historical inundated areas |

## Indexing Strategy
To ensure millisecond response times for the FastAPI dashboard, we utilize:
- **GIST Indexes**: Placed on every `geom` column to rapidly compute bounding box intersections before exact geometry matching.
- **B-Tree Indexes**: Placed on all `district_id` foreign keys and timestamp columns (`recorded_at`, `forecast_date`).

## SQLAlchemy & GeoAlchemy2
The backend ORM is entirely synchronous with this schema. We use `geoalchemy2.Geometry` to cast incoming PostGIS EWKB blobs back into Shapely/GeoJSON representations for the REST API.
