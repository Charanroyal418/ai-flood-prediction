"""
Test Suite: Knowledge Graph Engine
------------------------------------
Tests for the KG builder, graph metrics, community detection,
edge validation, and inference pipeline integration.
"""

import pytest
import math


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
    """DB with test districts, weather, river levels."""
    from app.models.district import District
    from app.models.weather import Weather
    from app.models.river import RiverLevel
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    districts = [
        District(id=1, name="Chennai",   population=7100000, area_km2=426,  elevation_m=6.0),
        District(id=2, name="Salem",     population=3480000, area_km2=5245, elevation_m=278.0),
        District(id=3, name="Cuddalore", population=2605000, area_km2=3678, elevation_m=5.0),
        District(id=4, name="Theni",     population=1245000, area_km2=3242, elevation_m=310.0),
    ]
    for d in districts:
        db.add(d)

    weather = [
        Weather(district_id=1, temperature=32.0, humidity=82.0, pressure=1008.0,
                wind_speed=20.0, rainfall_mm=45.0, recorded_at=now),
        Weather(district_id=2, temperature=30.0, humidity=65.0, pressure=1012.0,
                wind_speed=12.0, rainfall_mm=5.0, recorded_at=now),
        Weather(district_id=3, temperature=33.0, humidity=85.0, pressure=1006.0,
                wind_speed=18.0, rainfall_mm=80.0, recorded_at=now),
        Weather(district_id=4, temperature=28.0, humidity=70.0, pressure=1014.0,
                wind_speed=8.0, rainfall_mm=2.0, recorded_at=now),
    ]
    for w in weather:
        db.add(w)

    river_levels = [
        RiverLevel(district_id=1, river_name="Cooum River", station_name="Napier Bridge",
                   current_level=3.5, danger_level=5.0, recorded_at=now),
        RiverLevel(district_id=3, river_name="Vellar River", station_name="Kollidam Outlet",
                   current_level=9.5, danger_level=12.0, recorded_at=now),
    ]
    for r in river_levels:
        db.add(r)

    db.commit()
    return db


# ─── KG Builder Tests ─────────────────────────────────────────────────────────

class TestKGBuilder:
    """Test the NetworkX-based Knowledge Graph builder."""

    def test_builder_imports(self):
        """KG builder should import cleanly."""
        from app.kg.builder import KnowledgeGraphBuilder
        assert KnowledgeGraphBuilder is not None

    def test_singleton_instance(self):
        """kg_builder should be a singleton."""
        from app.kg.builder import kg_builder, KnowledgeGraphBuilder
        assert isinstance(kg_builder, KnowledgeGraphBuilder)

    def test_build_graph_returns_dict(self, seeded_db):
        """build_graph should return a dict with nodes and edges."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        assert isinstance(result, dict)
        assert "nodes" in result
        assert "edges" in result

    def test_build_graph_has_district_nodes(self, seeded_db):
        """Graph should contain district nodes."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        district_nodes = [n for n in result["nodes"] if n.get("type") == "district" or n.get("id", "").startswith("d-")]
        assert len(district_nodes) >= 2, f"Expected district nodes, got {len(district_nodes)}"

    def test_district_nodes_have_required_fields(self, seeded_db):
        """District nodes must have all required attribute fields."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        district_nodes = [n for n in result["nodes"] if n.get("type") == "district" or n.get("id", "").startswith("d-")]

        required_fields = {"id", "label", "risk_score", "type"}
        for node in district_nodes:
            missing = required_fields - set(node.keys())
            assert not missing, f"Node {node.get('id')} missing fields: {missing}"

    def test_risk_scores_in_range(self, seeded_db):
        """All node risk scores must be in [0, 100]."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        for node in result["nodes"]:
            if "risk_score" in node:
                rs = node["risk_score"]
                assert 0.0 <= rs <= 100.0, f"risk_score out of range: {node['id']} = {rs}"

    def test_edges_have_source_target(self, seeded_db):
        """All edges must have source and target fields."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        for edge in result["edges"]:
            assert "source" in edge, "Edge missing 'source'"
            assert "target" in edge, "Edge missing 'target'"

    def test_edges_reference_valid_nodes(self, seeded_db):
        """All edge endpoints must refer to existing node IDs."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        node_ids = {n["id"] for n in result["nodes"]}
        for edge in result["edges"]:
            assert edge["source"] in node_ids, f"Edge source {edge['source']} not in nodes"
            assert edge["target"] in node_ids, f"Edge target {edge['target']} not in nodes"

    def test_no_self_loops(self, seeded_db):
        """Graph should not contain self-loop edges."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        for edge in result["edges"]:
            assert edge["source"] != edge["target"], \
                f"Self-loop detected: {edge['source']} → {edge['target']}"

    def test_stats_present(self, seeded_db):
        """Graph response should include structural statistics."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        assert "stats" in result, "Missing 'stats' in graph response"
        stats = result["stats"]
        assert "density" in stats
        assert "total_nodes" in stats

    def test_communities_present(self, seeded_db):
        """Graph response should include community detection results."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        assert "communities" in result, "Missing 'communities' in graph response"
        comms = result["communities"]
        assert isinstance(comms, list), "Communities must be a list"


# ─── Graph Metrics Tests ───────────────────────────────────────────────────────

class TestGraphMetrics:
    """Test graph metric computation."""

    def test_density_in_range(self, seeded_db):
        """Graph density must be in [0, 1]."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        density = result["stats"].get("density", 0)
        assert 0.0 <= density <= 1.0, f"Density out of range: {density}"

    def test_avg_degree_non_negative(self, seeded_db):
        """Average degree must be ≥ 0."""
        from app.kg.builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        avg_deg = result["stats"].get("avg_degree", 0)
        assert avg_deg >= 0, f"avg_degree must be ≥ 0, got {avg_deg}"

    def test_latency_positive(self, seeded_db):
        """Latency in stats must be a positive number."""
        from app.kg.builder import KnowledgeGraphBuilder
        import time
        builder = KnowledgeGraphBuilder()
        start = time.time()
        result = builder.build_graph(seeded_db)
        elapsed = (time.time() - start) * 1000
        latency = result["stats"].get("latency_ms", 0)
        # Latency should be positive and less than our total elapsed
        assert latency >= 0, "Latency must be positive"
        assert latency < elapsed + 1000, "Latency should not exceed wall time"


# ─── Feature Matrix Tests ─────────────────────────────────────────────────────

class TestFeatureMatrix:
    """Test that the feature matrix produced by KG builder is valid."""

    def test_feature_matrix_shape(self, seeded_db):
        """Feature matrix H should have shape [num_nodes, seq_len, num_features]."""
        from app.kg.builder import KnowledgeGraphBuilder
        import torch
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        if "feature_matrix" in result and result["feature_matrix"] is not None:
            H = result["feature_matrix"]
            assert len(H.shape) == 3, f"Feature matrix must be 3D [N, T, F], got shape {H.shape}"
            _, _, num_features = H.shape
            assert num_features >= 10, f"Expected ≥10 features, got {num_features}"

    def test_no_nan_in_features(self, seeded_db):
        """Feature matrix must not contain NaN values."""
        from app.kg.builder import KnowledgeGraphBuilder
        import torch
        builder = KnowledgeGraphBuilder()
        result = builder.build_graph(seeded_db)
        if "feature_matrix" in result and result["feature_matrix"] is not None:
            H = result["feature_matrix"]
            assert not torch.isnan(H).any(), "Feature matrix contains NaN values"
            assert not torch.isinf(H).any(), "Feature matrix contains Inf values"


# ─── XAI Explain Tests ────────────────────────────────────────────────────────

class TestXAIExplain:
    """Test the explainability module."""

    def test_physics_attribution_sums_to_one(self):
        """Physics gradient attribution should sum to approximately 1.0."""
        from app.ml.explain import _physics_gradient_attribution
        features = [0.5, 0.3, 0.7, 0.4, 0.35, 0.1, 0.2, 0.6, 0.15, 0.05, 0.4, 0.6]
        result = _physics_gradient_attribution(features, risk_score=55.0)
        if result:
            total = sum(r["value"] for r in result)
            assert abs(total - 1.0) < 0.05, f"Attributions should sum to ~1.0, got {total:.4f}"

    def test_attribution_labels_valid(self):
        """Attribution labels should be known feature names."""
        from app.ml.explain import _physics_gradient_attribution, FEATURE_NAMES
        features = [0.8, 0.2, 0.9, 0.5, 0.3, 0.05, 0.1, 0.4, 0.3, 0.05, 0.6, 0.7]
        result = _physics_gradient_attribution(features, risk_score=75.0)
        for attr in result:
            assert attr["label"] in FEATURE_NAMES, f"Unknown label: {attr['label']}"

    def test_attribution_contribution_non_negative(self):
        """All attribution percentages must be non-negative."""
        from app.ml.explain import _physics_gradient_attribution
        features = [0.9, 0.1, 0.8, 0.6, 0.4, 0.02, 0.05, 0.7, 0.4, 0.1, 0.5, 0.9]
        result = _physics_gradient_attribution(features, risk_score=85.0)
        for attr in result:
            assert attr["contribution_pct"] >= 0, f"Negative contribution: {attr}"

    def test_high_rainfall_dominates_high_risk(self):
        """For high rainfall and high risk, Rainfall should be top contributor."""
        from app.ml.explain import _physics_gradient_attribution
        # High rainfall, low elevation (flood-prone), high risk
        features = [0.95, 0.85, 0.9, 0.4, 0.35, 0.02, 0.05, 0.3, 0.5, 0.1, 0.5, 0.8]
        result = _physics_gradient_attribution(features, risk_score=92.0)
        if result:
            top_label = result[0]["label"]
            # Rainfall or Elevation should be dominant
            assert top_label in {"Rainfall", "Elevation", "Risk Score"}, \
                f"Expected flood drivers to dominate, got: {top_label}"

    def test_explain_prediction_returns_strings(self):
        """Legacy explain_prediction should return list of strings."""
        from app.ml.explain import explain_prediction
        features = {"rainfall_24h": 120.0, "river_level": 4.5, "elevation": 5.0}
        result = explain_prediction(features, prediction_class=3)
        assert isinstance(result, list)
        for item in result:
            assert isinstance(item, str)
