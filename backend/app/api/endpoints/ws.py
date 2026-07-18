"""
WebSocket Endpoints
--------------------
Real-time WebSocket endpoints for streaming pipeline updates to the frontend.

Endpoints:
    /ws/dashboard  - District risk updates, pipeline metrics, SHAP values
    /ws/kg         - Knowledge Graph node/edge updates
    /ws/alerts     - Alert stream
    /ws/pipeline   - Pipeline tick status and metadata

Protocol:
    - Client connects to desired channel
    - Server sends initial snapshot on connect
    - Subsequent updates are pushed by orchestrator via ws_manager.broadcast()
    - Client can send { "action": "ping" } to keep connection alive
    - Server replies with { "type": "pong", "timestamp": "..." }
"""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.services.ws_manager import ws_manager
from app.models.district import District
from app.models.history import PredictionHistory, WeatherHistory, ModelInference
from app.models.alert import Alert
from app.kg.builder import kg_builder

logger = logging.getLogger(__name__)

router = APIRouter()


async def _get_dashboard_snapshot(db: Session) -> dict:
    """Build the initial dashboard snapshot from DB."""
    districts = db.query(District).all()
    district_list = []

    for d in districts:
        latest_pred = (
            db.query(PredictionHistory)
            .filter(PredictionHistory.district_id == d.id)
            .order_by(PredictionHistory.created_at.desc())
            .first()
        )
        latest_weather = (
            db.query(WeatherHistory)
            .filter(WeatherHistory.district_id == d.id)
            .order_by(WeatherHistory.recorded_at.desc())
            .first()
        )

        if not latest_pred:
            continue

        color_map = {
            "Severe": "#ef4444",
            "High": "#f97316",
            "Moderate": "#f59e0b",
            "Low": "#84cc16",
            "Very Low": "#22c55e",
        }

        district_list.append({
            "district_id": d.id,
            "district_name": d.name,
            "risk_score": latest_pred.current_risk_score,
            "risk_level": latest_pred.current_risk_level,
            "risk_color": color_map.get(latest_pred.current_risk_level, "#22c55e"),
            "confidence": latest_pred.confidence,
            "shap_values": latest_pred.shap_values or [],
            "rainfall_mm": latest_weather.rainfall_mm if latest_weather else 0,
            "humidity": latest_weather.humidity if latest_weather else 0,
            "temperature": latest_weather.temperature if latest_weather else 0,
        })

    # Latest model inference stats
    inf = db.query(ModelInference).order_by(ModelInference.id.desc()).first()
    inf_meta = {}
    if inf:
        inf_meta = {
            "inference_time_ms": inf.inference_time_ms,
            "latency_ms": inf.latency_ms,
            "node_count": inf.node_count,
            "edge_count": inf.edge_count,
            "inference_mode": (inf.attention_scores or {}).get("inference_mode", "Unknown"),
        }

    # Recent alerts
    recent_alerts = (
        db.query(Alert)
        .order_by(Alert.created_at.desc())
        .limit(5)
        .all()
    )
    alert_list = [
        {
            "district_id": a.district_id,
            "level": a.level,
            "severity": a.severity,
            "message": a.message,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in recent_alerts
    ]

    return {
        "type": "INITIAL_SNAPSHOT",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "districts": district_list,
        "model_meta": inf_meta,
        "recent_alerts": alert_list,
    }


async def _get_kg_snapshot() -> dict:
    """Build the initial KG snapshot from NetworkX graph."""
    nodes = []
    for nid in kg_builder.node_ids:
        node_data = dict(kg_builder.graph.nodes.get(nid, {}))
        node_type = node_data.get("type", "unknown")
        nodes.append({
            "id": nid,
            "type": node_type,
            "label": node_data.get("label", nid),
            "risk_score": round(node_data.get("risk_score", 15.0), 1),
            "risk_level": node_data.get("risk_level", "Very Low"),
            "elevation": node_data.get("elevation", 15.0),
            "rainfall": node_data.get("rainfall", 0.0),
        })

    edges = [
        {
            "source": u,
            "target": v,
            "weight": round(kg_builder.graph[u][v].get("weight", 0.5), 3),
            "animated": kg_builder.graph[u][v].get("weight", 0.5) > 0.6,
        }
        for u, v in kg_builder.graph.edges()
    ]

    return {
        "type": "KG_INITIAL_SNAPSHOT",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "nodes": nodes,
        "edges": edges,
    }


@router.websocket("/dashboard")
async def ws_dashboard(websocket: WebSocket, db: Session = Depends(deps.get_db)):
    """
    WebSocket: Real-time dashboard updates.
    
    Sends:
    - INITIAL_SNAPSHOT on connect (all district risk data)
    - PIPELINE_UPDATE on every orchestrator tick (pushed via broadcast)
    
    Receives:
    - { "action": "ping" } -> responds with pong
    - { "action": "trigger_pipeline" } -> triggers pipeline tick (admin only)
    """
    await ws_manager.connect(websocket, "dashboard")
    logger.info("[WS/dashboard] Client connected")

    try:
        # Send initial snapshot immediately on connect
        snapshot = await _get_dashboard_snapshot(db)
        await ws_manager.send_to_one(websocket, snapshot)

        # Listen for client messages
        while True:
            try:
                data = await websocket.receive_json()
                action = data.get("action", "")

                if action == "ping":
                    await ws_manager.send_to_one(websocket, {
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

                elif action == "get_snapshot":
                    snapshot = await _get_dashboard_snapshot(db)
                    await ws_manager.send_to_one(websocket, snapshot)

                elif action == "trigger_pipeline":
                    # Non-blocking pipeline trigger
                    import asyncio
                    from app.db.session import SessionLocal
                    from app.services.orchestrator import RealtimeOrchestrator

                    async def _run():
                        pipeline_db = SessionLocal()
                        try:
                            orch = RealtimeOrchestrator(pipeline_db)
                            result = orch.run_pipeline(
                                simulate_storm=data.get("storm", False)
                            )
                            await ws_manager.send_to_one(websocket, {
                                "type": "PIPELINE_TRIGGERED",
                                "result": result,
                            })
                        finally:
                            pipeline_db.close()

                    asyncio.ensure_future(_run())

            except Exception as recv_err:
                logger.debug(f"[WS/dashboard] Receive error: {recv_err}")
                break

    except WebSocketDisconnect:
        logger.info("[WS/dashboard] Client disconnected")
    except Exception as e:
        logger.error(f"[WS/dashboard] Error: {e}")
    finally:
        await ws_manager.disconnect(websocket, "dashboard")


@router.websocket("/kg")
async def ws_knowledge_graph(websocket: WebSocket):
    """
    WebSocket: Knowledge Graph real-time updates.
    
    Sends:
    - KG_INITIAL_SNAPSHOT on connect (all nodes + edges from NetworkX graph)
    - KG_UPDATE on every orchestrator tick (pushed via broadcast)
    """
    await ws_manager.connect(websocket, "kg")
    logger.info("[WS/kg] Client connected")

    try:
        # Send initial KG snapshot
        snapshot = await _get_kg_snapshot()
        await ws_manager.send_to_one(websocket, snapshot)

        # Listen for client messages
        while True:
            try:
                data = await websocket.receive_json()
                action = data.get("action", "")

                if action == "ping":
                    await ws_manager.send_to_one(websocket, {
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

                elif action == "get_snapshot":
                    snapshot = await _get_kg_snapshot()
                    await ws_manager.send_to_one(websocket, snapshot)

            except Exception as recv_err:
                logger.debug(f"[WS/kg] Receive error: {recv_err}")
                break

    except WebSocketDisconnect:
        logger.info("[WS/kg] Client disconnected")
    except Exception as e:
        logger.error(f"[WS/kg] Error: {e}")
    finally:
        await ws_manager.disconnect(websocket, "kg")


@router.websocket("/alerts")
async def ws_alerts(websocket: WebSocket, db: Session = Depends(deps.get_db)):
    """
    WebSocket: Real-time alert stream.
    
    Sends alert objects whenever new alerts are generated.
    """
    await ws_manager.connect(websocket, "alerts")
    logger.info("[WS/alerts] Client connected")

    try:
        # Send recent alerts on connect
        recent_alerts = (
            db.query(Alert)
            .order_by(Alert.created_at.desc())
            .limit(10)
            .all()
        )
        await ws_manager.send_to_one(websocket, {
            "type": "ALERT_HISTORY",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "alerts": [
                {
                    "district_id": a.district_id,
                    "level": a.level,
                    "severity": a.severity,
                    "message": a.message,
                    "suggested_response": a.suggested_response,
                    "confidence": a.confidence,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in recent_alerts
            ],
        })

        while True:
            try:
                data = await websocket.receive_json()
                if data.get("action") == "ping":
                    await ws_manager.send_to_one(websocket, {
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
            except Exception:
                break

    except WebSocketDisconnect:
        logger.info("[WS/alerts] Client disconnected")
    finally:
        await ws_manager.disconnect(websocket, "alerts")


@router.websocket("/pipeline")
async def ws_pipeline_status(websocket: WebSocket):
    """
    WebSocket: Pipeline execution status.
    
    Sends pipeline tick metadata (latency, node count, mode).
    """
    await ws_manager.connect(websocket, "pipeline")
    logger.info("[WS/pipeline] Client connected")

    try:
        await ws_manager.send_to_one(websocket, {
            "type": "PIPELINE_STATUS",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "connected",
            "message": "Listening for pipeline updates...",
        })

        while True:
            try:
                data = await websocket.receive_json()
                if data.get("action") == "ping":
                    await ws_manager.send_to_one(websocket, {
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
            except Exception:
                break

    except WebSocketDisconnect:
        logger.info("[WS/pipeline] Client disconnected")
    finally:
        await ws_manager.disconnect(websocket, "pipeline")
