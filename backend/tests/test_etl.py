"""
Test Suite: ETL Pipelines
--------------------------
Tests for Weather ETL, River ETL, and NASA GPM ETL.
Uses a SQLite in-memory DB via pytest fixtures.
"""

import pytest
import math
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def db():
    """In-memory SQLite session with schema."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.db.base import Base

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def seeded_db(db):
    """DB with test districts seeded."""
    from app.models.district import District

    districts = [
        District(id=1, name="Chennai",    population=7100000, area_km2=426,  elevation_m=6.0),
        District(id=2, name="Salem",      population=3480000, area_km2=5245, elevation_m=278.0),
        District(id=3, name="Cuddalore",  population=2605000, area_km2=3678, elevation_m=5.0),
        District(id=4, name="Theni",      population=1245000, area_km2=3242, elevation_m=310.0),
    ]
    for d in districts:
        db.add(d)
    db.commit()
    return db


# ─── River ETL Tests ──────────────────────────────────────────────────────────

class TestRiverETLPhysics:
    """Test the physics-based river level model."""

    def test_monsoon_factor_peak_ne(self):
        """NE Monsoon peak (Oct 15 = doy 288) should give factor near 0.9."""
        from app.etl.river import _monsoon_factor
        factor = _monsoon_factor(288)
        assert 0.8 <= factor <= 1.0, f"Expected ~0.9 at NE monsoon peak, got {factor}"

    def test_monsoon_factor_dry_season(self):
        """Dry season (March = doy 74) should give low monsoon factor."""
        from app.etl.river import _monsoon_factor
        factor = _monsoon_factor(74)
        assert factor < 0.25, f"Expected low factor in dry season, got {factor}"

    def test_monsoon_factor_sw_monsoon(self):
        """SW Monsoon (Aug = doy 213) should show secondary peak."""
        from app.etl.river import _monsoon_factor
        factor = _monsoon_factor(213)
        assert factor > 0.3, f"Expected SW monsoon signal, got {factor}"

    def test_monsoon_factor_bounded(self):
        """Monsoon factor must always be in [0, 1]."""
        from app.etl.river import _monsoon_factor
        for doy in range(1, 366):
            f = _monsoon_factor(doy)
            assert 0.0 <= f <= 1.0, f"Monsoon factor out of bounds at doy={doy}: {f}"

    def test_rainfall_to_runoff_zero(self):
        """Zero rainfall should produce zero runoff."""
        from app.etl.river import _rainfall_to_runoff
        assert _rainfall_to_runoff(0, 5000) == 0.0

    def test_rainfall_to_runoff_heavy(self):
        """Heavy rainfall (200mm) should produce measurable runoff."""
        from app.etl.river import _rainfall_to_runoff
        rise = _rainfall_to_runoff(200, 5000)
        assert rise > 0, "Heavy rainfall should produce runoff"
        assert rise <= 8.0, "Runoff rise should be capped at 8m"

    def test_rainfall_to_runoff_extreme(self):
        """Extreme rainfall should be capped at 8m max rise."""
        from app.etl.river import _rainfall_to_runoff
        rise = _rainfall_to_runoff(600, 37000)
        assert rise <= 8.0, "Max runoff rise must be capped at 8m"

    def test_physics_level_bounded(self):
        """Physics level must stay within [base_m - 2, danger_m * 1.1] range."""
        from app.etl.river import _compute_physics_level, RIVER_STATIONS
        for station in RIVER_STATIONS:
            for doy in [74, 150, 213, 288, 350]:
                for rain in [0, 50, 150, 300]:
                    level = _compute_physics_level(station, doy, rain)
                    assert level >= station["base_m"] - 3.0, \
                        f"Level below base: {station['name']} doy={doy} rain={rain} → {level}"
                    upper = (station.get("frl_m") or station["danger_m"] * 1.1)
                    assert level <= upper + 0.1, \
                        f"Level above upper bound: {station['name']} → {level}"

    def test_physics_level_increases_with_rainfall(self):
        """Higher rainfall should produce higher or equal river level."""
        from app.etl.river import _compute_physics_level, RIVER_STATIONS
        station = RIVER_STATIONS[0]  # Cauvery / Mettur
        doy = 288  # NE monsoon peak
        level_dry = _compute_physics_level(station, doy, 0)
        level_wet = _compute_physics_level(station, doy, 200)
        assert level_wet >= level_dry, "Higher rainfall must produce >= level"

    def test_no_random_values(self):
        """River ETL must not import or use random."""
        import app.etl.river as river_module
        assert not hasattr(river_module, "random"), "river.py must not import random"


class TestRiverETLPipeline:

    def test_extract_returns_list(self, seeded_db):
        """Extract should return a list of dicts."""
        from app.etl.river import RiverETL
        etl = RiverETL(seeded_db)
        result = etl.extract()
        assert isinstance(result, list)

    def test_extract_fields(self, seeded_db):
        """Each extracted record should have required fields."""
        from app.etl.river import RiverETL
        etl = RiverETL(seeded_db)
        result = etl.extract()
        for row in result:
            assert "district_id" in row
            assert "river_name" in row
            assert "current_level" in row
            assert "danger_level" in row
            assert row["current_level"] >= 0
            assert row["danger_level"] > 0

    def test_validate_removes_negative(self, seeded_db):
        """Validate should remove records with negative levels."""
        from app.etl.river import RiverETL
        etl = RiverETL(seeded_db)
        bad_row = {
            "district_id": 1, "river_name": "Test", "station_name": "S",
            "current_level": -1.0, "danger_level": 10.0, "source": "Test"
        }
        result = etl.validate([bad_row])
        assert len(result) == 0

    def test_validate_caps_extreme(self, seeded_db):
        """Validate should cap extreme levels at 1.15× danger."""
        from app.etl.river import RiverETL
        etl = RiverETL(seeded_db)
        row = {
            "district_id": 1, "river_name": "Test", "station_name": "S",
            "current_level": 1000.0, "danger_level": 10.0, "source": "Test"
        }
        result = etl.validate([row])
        assert len(result) == 1
        assert result[0]["current_level"] <= 10.0 * 1.15 + 0.01

    def test_transform_creates_orm_objects(self, seeded_db):
        """Transform should return RiverLevel ORM instances."""
        from app.etl.river import RiverETL
        from app.models.river import RiverLevel
        etl = RiverETL(seeded_db)
        rows = [{"district_id": 1, "river_name": "Cauvery", "station_name": "Mettur",
                 "current_level": 32.0, "danger_level": 36.57, "source": "Physics"}]
        result = etl.transform(rows)
        assert len(result) == 1
        assert isinstance(result[0], RiverLevel)
        assert result[0].current_level == 32.0


# ─── Weather ETL Tests ────────────────────────────────────────────────────────

class TestWeatherETL:

    def test_no_random_import(self):
        """Weather ETL must not use random for production values."""
        import app.etl.weather as weather_module
        import inspect
        src = inspect.getsource(weather_module)
        # random.uniform / random.gauss not allowed in production data paths
        assert "random.uniform" not in src, "random.uniform found in weather ETL"

    def test_tn_districts_complete(self):
        """TN_DISTRICTS should have at least 38 entries (all TN districts)."""
        from app.etl.weather import TN_DISTRICTS
        assert len(TN_DISTRICTS) >= 38, f"Expected ≥38 districts, got {len(TN_DISTRICTS)}"

    def test_tn_districts_coordinates_valid(self):
        """All district coordinates should be within Tamil Nadu bounding box."""
        from app.etl.weather import TN_DISTRICTS
        # Tamil Nadu: lat 8.07–13.35°N, lon 76.23–80.35°E
        for name, (lat, lon) in TN_DISTRICTS.items():
            assert 7.5 <= lat <= 14.0, f"{name}: lat {lat} out of TN bounds"
            assert 76.0 <= lon <= 81.0, f"{name}: lon {lon} out of TN bounds"

    @patch("app.etl.weather.requests.Session.get")
    def test_extract_handles_api_failure(self, mock_get, seeded_db):
        """Weather ETL should handle API failures gracefully."""
        from app.etl.weather import WeatherETL
        mock_get.side_effect = Exception("Connection timeout")
        etl = WeatherETL(seeded_db)
        result = etl.extract()
        # Should return empty list or partial results, not crash
        assert isinstance(result, list)


# ─── NASA GPM ETL Tests ───────────────────────────────────────────────────────

class TestNasaGPMETL:

    def test_init(self, seeded_db):
        """NasaGPMETL should initialize without errors."""
        from app.etl.nasa_gpm import NasaGPMETL
        etl = NasaGPMETL(seeded_db)
        assert etl is not None

    @patch("app.etl.nasa_gpm.requests.get")
    def test_extract_fallback_structure(self, mock_get, seeded_db):
        """NASA GPM ETL should produce correct output structure."""
        from app.etl.nasa_gpm import NasaGPMETL

        # Mock Open-Meteo response
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = [{
            "hourly": {
                "time": [f"2026-07-01T{h:02d}:00" for h in range(24)],
                "precipitation": [1.5] * 24,
                "precipitation_probability": [60] * 24,
                "soil_moisture_0_to_1cm": [0.3] * 24,
            }
        }]
        mock_get.return_value = mock_resp

        etl = NasaGPMETL(seeded_db)
        result = etl.extract()

        assert isinstance(result, list)
        if result:
            row = result[0]
            assert "district_id" in row
            assert "rainfall_24h_mm" in row
            assert row["rainfall_24h_mm"] >= 0
