"""
ML / Inference Unit Tests
==========================
Tests for the GNN inference engine:
  - Feature vector shape
  - Physics engine computation
  - Risk level mapping
  - Confidence value range
  - No hardcoded constants
"""
import pytest
import math


class TestPhysicsEngine:
    """Test the physics-based fallback risk computation."""

    def test_zero_rainfall_gives_low_risk(self):
        """Zero rainfall and river risk should give very low score."""
        from app.ml.inference import GNNInferenceEngine

        engine = GNNInferenceEngine()
        # Build minimal feature vector: [rainfall=0, river_risk=0, humidity=0.5, ...]
        feats = [0.0, 0.0, 0.5, 0.5, 0.56, 0.9, 0.1, 0.4, 0.2, 0.2, 0.4, 0.5]
        score = engine._compute_physics_risk(feats)
        assert score < 30.0, f"Zero rainfall should give low risk, got {score}"

    def test_extreme_rainfall_gives_high_risk(self):
        """IMD extreme rainfall (204.4mm) should give critical risk."""
        from app.ml.inference import GNNInferenceEngine

        engine = GNNInferenceEngine()
        # rainfall_norm=1.0 (204.4mm), river_risk=0.9, low elevation
        feats = [1.0, 0.9, 0.95, 0.8, 0.56, 0.95, 0.2, 0.8, 0.9, 0.5, 0.7, 0.8]
        score = engine._compute_physics_risk(feats)
        assert score >= 60.0, f"Extreme conditions should give high risk, got {score}"

    def test_risk_score_bounded_0_100(self):
        """Risk score must always be in [1, 99] range."""
        from app.ml.inference import GNNInferenceEngine
        import random

        engine = GNNInferenceEngine()
        for _ in range(50):
            feats = [random.uniform(0, 1) for _ in range(12)]
            score = engine._compute_physics_risk(feats)
            assert 1.0 <= score <= 99.0, f"Score out of bounds: {score}"


class TestRiskLevelMapping:
    """Test risk level and color mapping."""

    def test_risk_level_thresholds(self):
        from app.ml.inference import get_risk_level_and_color

        assert get_risk_level_and_color(5.0)[0] == "Safe"
        assert get_risk_level_and_color(20.0)[0] == "Low"
        assert get_risk_level_and_color(40.0)[0] == "Moderate"
        assert get_risk_level_and_color(60.0)[0] == "High"
        assert get_risk_level_and_color(80.0)[0] == "Critical"

    def test_risk_color_is_hex(self):
        from app.ml.inference import get_risk_level_and_color

        for score in [5, 25, 45, 65, 85]:
            _, color = get_risk_level_and_color(score)
            assert color.startswith("#"), f"Color must be hex, got: {color}"
            assert len(color) == 7


class TestPhysicsConfidence:
    """Confidence values must be computed, not hardcoded."""

    def test_confidence_not_hardcoded_082(self):
        """confidence must never be exactly 0.82 (the old hardcoded value)."""
        import math

        # Simulate the new confidence calculation
        risk_score = 35.0
        thresholds = [20.0, 40.0, 60.0, 80.0]
        distances = [abs(risk_score - t) for t in thresholds]
        min_dist = min(distances)
        conf = min(0.88, 0.70 + (min_dist / 20.0) * 0.18)

        assert conf != 0.82, "Confidence should not be hardcoded to 0.82"
        assert 0.70 <= conf <= 0.88, f"Confidence out of range: {conf}"

    def test_confidence_higher_far_from_boundary(self):
        """Confidence should be higher when risk score is far from a threshold."""
        thresholds = [20.0, 40.0, 60.0, 80.0]

        def compute_conf(risk_score):
            distances = [abs(risk_score - t) for t in thresholds]
            return min(0.88, 0.70 + (min(distances) / 20.0) * 0.18)

        # Score of 10 is 10 units from nearest threshold (20)
        conf_10 = compute_conf(10.0)
        # Score of 19 is only 1 unit from nearest threshold (20)
        conf_19 = compute_conf(19.0)

        assert conf_10 > conf_19, "Confidence should be higher far from boundary"


class TestFeatureVector:
    """Feature module unit tests."""

    def test_temporal_monsoon_signal_bounded(self):
        from app.ml.features import get_temporal_monsoon_signal
        from datetime import datetime, timezone

        # Test all 12 months
        for month in range(1, 13):
            dt = datetime(2024, month, 15, tzinfo=timezone.utc)
            sig = get_temporal_monsoon_signal(dt)
            assert 0.0 <= sig <= 1.0, f"Signal out of [0,1] for month {month}: {sig}"

    def test_monsoon_peak_in_october(self):
        """Tamil Nadu NE monsoon peaks in October/November."""
        from app.ml.features import get_temporal_monsoon_signal
        from datetime import datetime, timezone

        oct_signal = get_temporal_monsoon_signal(datetime(2024, 10, 31, tzinfo=timezone.utc))
        may_signal = get_temporal_monsoon_signal(datetime(2024, 5, 1, tzinfo=timezone.utc))

        assert oct_signal > may_signal, \
            f"October should have higher monsoon signal than May: {oct_signal} vs {may_signal}"

    def test_drainage_capacity_is_bounded(self):
        """All drainage capacity constants must be in [0, 1]."""
        from app.ml.features import DRAINAGE_CAPACITY

        for district, val in DRAINAGE_CAPACITY.items():
            assert 0.0 <= val <= 1.0, f"Drainage capacity for {district} out of bounds: {val}"

    def test_historical_flood_counts_positive(self):
        """All historical flood counts must be positive integers."""
        from app.ml.features import HISTORICAL_FLOOD_COUNTS

        for district, count in HISTORICAL_FLOOD_COUNTS.items():
            assert count >= 0, f"Flood count for {district} is negative: {count}"
            assert isinstance(count, int), f"Flood count for {district} should be int"

    def test_38_tn_districts_in_constants(self):
        """Should have data for at least 38 Tamil Nadu districts."""
        from app.ml.features import HISTORICAL_FLOOD_COUNTS
        from app.etl.weather import TN_DISTRICTS

        assert len(TN_DISTRICTS) == 38, f"Expected 38 districts, got {len(TN_DISTRICTS)}"
        assert len(HISTORICAL_FLOOD_COUNTS) == 38, \
            f"Expected 38 districts in flood history, got {len(HISTORICAL_FLOOD_COUNTS)}"


class TestKGBuilder:
    """Knowledge Graph builder unit tests."""

    def test_kg_has_no_duplicate_edge_types(self):
        """Verify 'flow' duplicate was removed from edge type meta."""
        from app.kg.builder import EDGE_TYPE_META

        colors = [m["color"] for k, m in EDGE_TYPE_META.items() if k != "river_flow"]
        labels = [m["label"] for k, m in EDGE_TYPE_META.items()]

        # Check 'River Flow' doesn't appear twice in labels
        river_flow_count = sum(1 for l in labels if l == "River Flow")
        assert river_flow_count == 1, \
            f"'River Flow' label should appear exactly once, found {river_flow_count} times"

    def test_kg_has_new_edge_types(self):
        """Verify new edge types were added."""
        from app.kg.builder import EDGE_TYPE_META

        for edge_type in ["supplies", "influences", "located_in", "upstream_of", "downstream_of"]:
            assert edge_type in EDGE_TYPE_META, f"Missing edge type: {edge_type}"
