-- Foreign Keys
ALTER TABLE taluks ADD CONSTRAINT fk_taluks_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE;
ALTER TABLE villages ADD CONSTRAINT fk_villages_taluk FOREIGN KEY (taluk_id) REFERENCES taluks(id) ON DELETE CASCADE;

ALTER TABLE roads ADD CONSTRAINT fk_roads_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL;
ALTER TABLE buildings ADD CONSTRAINT fk_buildings_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL;

ALTER TABLE flood_events ADD CONSTRAINT fk_flood_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL;
ALTER TABLE weather_forecast ADD CONSTRAINT fk_weather_forecast_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE;
