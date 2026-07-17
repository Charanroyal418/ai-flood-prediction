-- Spatial Indexes (GIST) for rapid geospatial queries
CREATE INDEX IF NOT EXISTS idx_districts_geom ON districts USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_taluks_geom ON taluks USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_villages_geom ON villages USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_buildings_geom ON buildings USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_rivers_geom ON rivers USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_dem_tiles_geom ON dem_tiles USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_landcover_geom ON landcover USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_flood_events_geom ON flood_events USING GIST (geom);

-- B-Tree Indexes for Foreign Keys and common lookups
CREATE INDEX IF NOT EXISTS idx_taluks_district_id ON taluks(district_id);
CREATE INDEX IF NOT EXISTS idx_villages_taluk_id ON villages(taluk_id);
CREATE INDEX IF NOT EXISTS idx_weather_forecast_district ON weather_forecast(district_id);
CREATE INDEX IF NOT EXISTS idx_weather_forecast_date ON weather_forecast(forecast_date);
