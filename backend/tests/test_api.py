"""
API Integration Tests
======================
Tests all FloodSense API endpoints end-to-end using FastAPI TestClient
with an in-memory SQLite database.

Run with: pytest tests/test_api.py -v
"""
import pytest


class TestHealthEndpoint:
    """Public health check endpoint must always return 200."""

    def test_health_returns_200(self, client):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200

    def test_health_has_required_fields(self, client):
        resp = client.get("/api/v1/health")
        data = resp.json()
        assert "status" in data

    def test_root_returns_service_info(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "service" in data
        assert data["service"] == "FloodSense AI"


class TestAuthEndpoints:
    """Authentication flow tests."""

    def test_register_creates_user(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "name": "Test User",
            "email": "test_register@example.com",
            "password": "TestPass@2026!",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "test_register@example.com"

    def test_login_with_valid_credentials(self, client):
        # Register first
        client.post("/api/v1/auth/register", json={
            "name": "Login User",
            "email": "test_login@example.com",
            "password": "LoginPass@2026!",
        })
        # Login
        resp = client.post("/api/v1/auth/login", json={
            "email": "test_login@example.com",
            "password": "LoginPass@2026!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_with_wrong_password(self, client):
        client.post("/api/v1/auth/register", json={
            "name": "Bad Pass User",
            "email": "badpass@example.com",
            "password": "CorrectPass@2026!",
        })
        resp = client.post("/api/v1/auth/login", json={
            "email": "badpass@example.com",
            "password": "WrongPassword",
        })
        assert resp.status_code == 401

    def test_me_requires_auth(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_me_returns_user_with_valid_token(self, client, auth_headers):
        resp = client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "email" in data
        assert "role" in data

    def test_duplicate_email_returns_409(self, client):
        payload = {"name": "Dup User", "email": "dup@example.com", "password": "DupPass@2026!"}
        client.post("/api/v1/auth/register", json=payload)
        resp = client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 409

    def test_refresh_token(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "name": "Refresh User", "email": "refresh@example.com", "password": "RefreshPass@2026!",
        })
        refresh = resp.json()["refresh_token"]
        resp2 = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert resp2.status_code == 200
        assert "access_token" in resp2.json()

    def test_invalid_refresh_token(self, client):
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "not.a.valid.token"})
        assert resp.status_code == 401


class TestDashboardEndpoints:
    """Dashboard data endpoints."""

    def test_live_endpoint_returns_200(self, client):
        resp = client.get("/api/v1/dashboard/live")
        assert resp.status_code == 200

    def test_live_has_required_fields(self, client):
        resp = client.get("/api/v1/dashboard/live")
        data = resp.json()
        # Must have these top-level keys
        assert "status" in data
        assert "metrics" in data
        assert "districts" in data
        assert "alerts" in data

    def test_metrics_confidence_not_hardcoded(self, client):
        """model_confidence must be a real computed value, not 0.94."""
        resp = client.get("/api/v1/dashboard/live")
        data = resp.json()
        confidence = data["metrics"].get("model_confidence", None)
        if confidence is not None:
            # It can be 0 if no predictions yet, but must NEVER be exactly 0.94
            assert confidence != 0.94, "model_confidence is still hardcoded to 0.94!"


class TestAdminEndpoints:
    """Admin endpoints require auth."""

    def test_admin_pipeline_status_requires_auth(self, client):
        resp = client.get("/api/v1/admin/pipeline/status")
        assert resp.status_code == 401

    def test_admin_pipeline_status_with_auth(self, client, auth_headers):
        resp = client.get("/api/v1/admin/pipeline/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "pipeline" in data
        assert "database" in data

    def test_admin_etl_trigger_requires_auth(self, client):
        resp = client.post("/api/v1/admin/etl/run")
        assert resp.status_code == 401

    def test_admin_ml_metrics_returns_404_when_no_model(self, client, auth_headers):
        """Should 404 when model hasn't been trained yet."""
        resp = client.get("/api/v1/admin/ml/metrics", headers=auth_headers)
        assert resp.status_code in (200, 404)  # 404 if no model, 200 if trained

    def test_admin_logs_returns_list(self, client, auth_headers):
        resp = client.get("/api/v1/admin/logs", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestKGEndpoints:
    """Knowledge Graph endpoints."""

    def test_kg_graph_returns_200(self, client):
        resp = client.get("/api/v1/kg/graph")
        assert resp.status_code == 200

    def test_kg_graph_has_nodes_and_edges(self, client):
        resp = client.get("/api/v1/kg/graph")
        data = resp.json()
        assert "nodes" in data
        assert "edges" in data
        assert isinstance(data["nodes"], list)
        assert isinstance(data["edges"], list)


class TestSpatialEndpoints:
    """Spatial and district endpoints."""

    def test_districts_endpoint_returns_200(self, client):
        resp = client.get("/api/v1/spatial/district-bounds")
        assert resp.status_code == 200

    def test_prediction_cycle_returns_200(self, client):
        resp = client.get("/api/v1/predict/inference-cycle")
        assert resp.status_code == 200

    def test_prediction_cycle_has_districts(self, client):
        resp = client.get("/api/v1/predict/inference-cycle")
        data = resp.json()
        assert "districts" in data
        assert isinstance(data["districts"], list)

    def test_prediction_cycle_no_uniform_risk_scores(self, client):
        """Risk scores must NOT all be the same (e.g. 15.0 hardcoded fallback)."""
        resp = client.get("/api/v1/predict/inference-cycle")
        data = resp.json()
        districts = data.get("districts", [])
        if len(districts) > 1:
            scores = [d.get("risk_score", 0) for d in districts]
            unique_scores = set(round(s, 1) for s in scores)
            # Must have at least 2 different risk scores across 38 districts
            assert len(unique_scores) > 1, \
                f"All {len(districts)} districts have identical risk scores: {unique_scores}"


class TestRequiredChecklistEndpoints:
    """Explicit tests for all endpoints specified in the QA checklist."""

    def test_checklist_health(self, client):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200

    def test_checklist_dashboard_live(self, client):
        resp = client.get("/api/v1/dashboard/live")
        assert resp.status_code == 200

    def test_checklist_predict_inference_cycle(self, client):
        resp = client.get("/api/v1/predict/inference-cycle")
        assert resp.status_code == 200

    def test_checklist_weather(self, client):
        resp = client.get("/api/v1/weather")
        assert resp.status_code == 200
        assert "data" in resp.json()

    def test_checklist_river(self, client):
        resp = client.get("/api/v1/river")
        assert resp.status_code == 200

    def test_checklist_predictions(self, client):
        resp = client.get("/api/v1/predictions")
        assert resp.status_code == 200

    def test_checklist_kg_topology(self, client):
        resp = client.get("/api/v1/kg/topology")
        assert resp.status_code == 200

    def test_checklist_districts(self, client):
        resp = client.get("/api/v1/districts")
        assert resp.status_code == 200

    def test_checklist_history(self, client):
        resp = client.get("/api/v1/history")
        assert resp.status_code == 200

    def test_checklist_alerts(self, client):
        resp = client.get("/api/v1/alerts")
        assert resp.status_code == 200


class TestWebSocketChecklist:
    """Explicit tests for WebSocket handshakes and channels."""

    def test_ws_unified_handshake_and_ping(self, client):
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_json({"action": "ping"})
            resp = ws.receive_json()
            assert resp.get("type") == "pong"

    def test_ws_dashboard_channel_auto_connect(self, client):
        with client.websocket_connect("/api/v1/ws/dashboard") as ws:
            resp = ws.receive_json()
            assert resp.get("type") in ("subscribed", "INITIAL_SNAPSHOT", "DISTRICT_UPDATE")

    def test_ws_kg_channel_auto_connect(self, client):
        with client.websocket_connect("/api/v1/ws/kg") as ws:
            resp = ws.receive_json()
            assert resp.get("type") in ("subscribed", "KG_INITIAL_SNAPSHOT", "KG_UPDATE")

    def test_ws_alerts_channel_auto_connect(self, client):
        with client.websocket_connect("/api/v1/ws/alerts") as ws:
            resp = ws.receive_json()
            assert resp.get("type") in ("subscribed", "ALERT_HISTORY", "ALERT_DISPATCH")
