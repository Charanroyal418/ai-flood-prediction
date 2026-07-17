-- Administrative Boundaries
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    population FLOAT,
    geom geometry(Polygon, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS taluks (
    id SERIAL PRIMARY KEY,
    district_id INTEGER,
    name VARCHAR(255) NOT NULL,
    geom geometry(Polygon, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS villages (
    id SERIAL PRIMARY KEY,
    taluk_id INTEGER,
    name VARCHAR(255) NOT NULL,
    geom geometry(Polygon, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Infrastructure
CREATE TABLE IF NOT EXISTS roads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id INTEGER,
    type VARCHAR(50),
    geom geometry(LineString, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id INTEGER,
    type VARCHAR(50),
    geom geometry(Polygon, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hydrology & Terrain
CREATE TABLE IF NOT EXISTS rivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    type VARCHAR(50),
    geom geometry(MultiLineString, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dem_tiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tile_name VARCHAR(255) UNIQUE,
    geom geometry(Polygon, 4326),
    file_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS landcover (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_name VARCHAR(255),
    geom geometry(MultiPolygon, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Telemetry & Forecasts
CREATE TABLE IF NOT EXISTS flood_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id INTEGER,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    severity VARCHAR(50),
    geom geometry(Polygon, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weather_forecast (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id INTEGER,
    forecast_date TIMESTAMP,
    predicted_rainfall FLOAT,
    predicted_temp FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20),
    message TEXT,
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
