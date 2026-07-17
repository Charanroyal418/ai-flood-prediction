-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Districts
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    population FLOAT,
    geom geometry(Polygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_districts_geom ON districts USING GIST (geom);

-- Weather
CREATE TABLE IF NOT EXISTS weather (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id INTEGER REFERENCES districts(id),
    temperature FLOAT,
    humidity FLOAT,
    pressure FLOAT,
    status VARCHAR(50),
    recorded_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_weather_recorded_at ON weather(recorded_at);

-- Rainfall
CREATE TABLE IF NOT EXISTS rainfall (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id INTEGER REFERENCES districts(id),
    mm_per_hour FLOAT,
    mm_24h FLOAT,
    recorded_at TIMESTAMP
);

-- River Levels
CREATE TABLE IF NOT EXISTS river_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id INTEGER REFERENCES districts(id),
    river_name VARCHAR(255),
    station_name VARCHAR(255),
    current_level FLOAT,
    danger_level FLOAT,
    recorded_at TIMESTAMP
);

-- Infrastructure (Buildings, Hospitals, Schools, Shelters)
CREATE TABLE IF NOT EXISTS infrastructure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50), -- 'hospital', 'school', 'shelter', 'building'
    name VARCHAR(255),
    district_id INTEGER REFERENCES districts(id),
    capacity INTEGER,
    geom geometry(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_infrastructure_geom ON infrastructure USING GIST (geom);

-- Roads
CREATE TABLE IF NOT EXISTS roads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id INTEGER REFERENCES districts(id),
    type VARCHAR(50),
    geom geometry(LineString, 4326)
);
CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads USING GIST (geom);
