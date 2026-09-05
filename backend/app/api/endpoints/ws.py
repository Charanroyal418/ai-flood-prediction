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
from starlette import status
from starlette.websockets import WebSocketState
from sqlalchemy.orm import Session

from app.api import deps
from app.services.ws_manager import ws_manager
from app.models.district import District
from app.models.history import PredictionHistory, WeatherHistory, ModelInference
from app.models.alert import Alert
from app.models.entities import Dam
from app.models.river import RiverLevel
from app.kg.builder import kg_builder

logger = logging.getLogger(__name__)

router = APIRouter()


async def _get_dashboard_snapshot(db: Session) -> dict:
    """Build the initial dashboard snapshot from DB."""
    districts = db.query(District).all()
    all_rivers = db.query(RiverLevel).order_by(RiverLevel.recorded_at.desc()).limit(200).all()
    river_map = {}
    for r in all_rivers:
        if r.district_id not in river_map:
            river_map[r.district_id] = r

    all_dams = db.query(Dam).all()
    dam_map = {dam.district_id: dam for dam in all_dams if dam.district_id is not None}
    valid_dam_fill = [float(dam.fill_pct) for dam in all_dams if dam.fill_pct is not None]
    avg_dam_fill = round(float(sum(valid_dam_fill) / len(valid_dam_fill)), 1) if valid_dam_fill else 58.0

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

        # Canonical color map — must match inference.py get_risk_level_and_color()
        color_map = {
            "Critical": "#ef4444",
            "High":     "#f97316",
            "Moderate": "#f59e0b",
            "Low":      "#22c55e",
            "Safe":     "#3b82f6",
            # Legacy aliases for backwards compat
            "Severe":   "#ef4444",
            "Very Low": "#3b82f6",
            "Warning":  "#f59e0b",
            "Watch":    "#3b82f6",
        }

        lon, lat = 0.0, 0.0
        if d.geom_json:
            geom = d.geom_json
            if isinstance(geom, str):
                try:
                    import json
                    geom = json.loads(geom)
                except Exception:
                    geom = {}
            if isinstance(geom, dict):
                coords = geom.get("coordinates")
                gtype = geom.get("type", "")
                try:
                    if gtype == "Point" and isinstance(coords, (list, tuple)) and len(coords) >= 2:
                        lon, lat = float(coords[0]), float(coords[1])
                    elif gtype in ("Polygon", "MultiPolygon") and coords:
                        pts = coords[0] if gtype == "Polygon" else coords[0][0]
                        if pts and len(pts) > 0:
                            avg_lon = sum(p[0] for p in pts) / len(pts)
                            avg_lat = sum(p[1] for p in pts) / len(pts)
                            lon, lat = float(avg_lon), float(avg_lat)
                except Exception:
                    pass

        dam_obj = dam_map.get(d.id)
        res_val = round(float(dam_obj.fill_pct), 1) if (dam_obj and dam_obj.fill_pct is not None) else avg_dam_fill
        r_rec = river_map.get(d.id)

        district_list.append({
            "district_id": d.id,
            "district_name": d.name,
            "lat": lat,
            "lon": lon,
            "risk_score": latest_pred.current_risk_score,
            "risk_level": latest_pred.current_risk_level,
            "risk_color": color_map.get(latest_pred.current_risk_level, "#22c55e"),
            "confidence": latest_pred.confidence,
            "shap_values": latest_pred.shap_values or [],
            "rainfall_mm": latest_weather.rainfall_mm if latest_weather else 0,
            "humidity": latest_weather.humidity if latest_weather else 0,
            "temperature": latest_weather.temperature if latest_weather else 0,
            "river_level_m": r_rec.current_level if r_rec else 0.0,
            "river_danger_m": r_rec.danger_level if r_rec else 5.0,
            "reservoir_storage": res_val,
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


SUPPORTED_CHANNELS = {"dashboard", "kg", "alerts", "weather", "river", "pipeline"}


async def _send_channel_snapshot(websocket: WebSocket, channel: str):
    """Deliver initial channel snapshot to a subscribed client."""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        if channel in ("dashboard", "weather", "river"):
            snap = await _get_dashboard_snapshot(db)
            snap["channel"] = channel
            await ws_manager.send_to_one(websocket, snap)
        elif channel == "kg":
            snap = await _get_kg_snapshot()
            snap["channel"] = "kg"
            await ws_manager.send_to_one(websocket, snap)
        elif channel == "alerts":
            recent_alerts = (
                db.query(Alert)
                .order_by(Alert.created_at.desc())
                .limit(10)
                .all()
            )
            await ws_manager.send_to_one(websocket, {
                "type": "ALERT_HISTORY",
                "channel": "alerts",
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
        elif channel == "pipeline":
            await ws_manager.send_to_one(websocket, {
                "type": "PIPELINE_STATUS",
                "channel": "pipeline",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "connected",
                "message": "Listening for pipeline updates...",
            })
    except Exception as snap_err:
        logger.warning(f"[WS/unified] Error sending snapshot for {channel}: {snap_err}")
    finally:
        db.close()


async def handle_websocket_connection(websocket: WebSocket, initial_channel: str = None):
    """
    Core WebSocket handler for all routes (/ws, /ws/dashboard, /ws/kg, /ws/alerts, /ws/pipeline).
    
    Guarantees:
    1. Accepts the websocket connection BEFORE any channel parsing or DB queries.
    2. Defaults to 'dashboard' channel if no channel is provided initially.
    3. Handshake and initial setup are wrapped in try/except, closing with WS_1011_INTERNAL_ERROR
       instead of bubbling an exception that causes HTTP 500.
    4. Auto-subscribes to the initial channel and delivers its initial snapshot.
    5. Handles subscribe, ping, get_dashboard, get_kg, and trigger_pipeline messages.
    """
    # ── Step 1: Accept the handshake BEFORE any channel parsing or DB work ──
    try:
        if getattr(websocket, "client_state", None) == WebSocketState.CONNECTING:
            await websocket.accept()
    except Exception as accept_err:
        logger.error(f"[WS] Handshake accept failed: {accept_err}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass
        return

    subscribed_channels = set()

    # ── Step 2: Handshake & initial channel subscription wrapped in try/except ──
    try:
        # Determine initial channel from arg, query parameter, or default to "dashboard"
        query_ch = None
        if hasattr(websocket, "query_params") and websocket.query_params:
            query_ch = websocket.query_params.get("channel") or websocket.query_params.get("initial_channel")
        
        target_channel = (initial_channel or query_ch or "dashboard").lower().strip()
        if not target_channel or target_channel not in SUPPORTED_CHANNELS:
            target_channel = "dashboard"

        logger.info(f"[WS] Client connected to '{target_channel}' stream")

        # Auto-subscribe to the resolved channel
        async with ws_manager._lock:
            if websocket not in ws_manager._connections[target_channel]:
                ws_manager._connections[target_channel].append(websocket)
        subscribed_channels.add(target_channel)

        # Send subscription confirmation
        await ws_manager.send_to_one(websocket, {
            "type": "subscribed",
            "channel": target_channel,
            "status": "ok",
        })

        # Deliver initial snapshot for the subscribed channel
        await _send_channel_snapshot(websocket, target_channel)

    except WebSocketDisconnect:
        logger.info("[WS] Client disconnected during initial handshake")
        for ch in list(subscribed_channels):
            await ws_manager.disconnect(websocket, ch)
        return
    except Exception as init_err:
        logger.error(f"[WS] Error during initial setup: {init_err}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass
        for ch in list(subscribed_channels):
            await ws_manager.disconnect(websocket, ch)
        return

    # ── Step 3: Message Receive Loop ──
    try:
        while True:
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception as recv_err:
                logger.debug(f"[WS] Receive error / client disconnect: {recv_err}")
                break

            if not isinstance(data, dict):
                continue

            action = str(data.get("action", "")).lower().strip()
            msg_type = str(data.get("type", "")).lower().strip()
            # If frontend sends no channel initially, default to "dashboard"
            raw_channel = data.get("channel")
            channel = str(raw_channel).lower().strip() if raw_channel else "dashboard"

            if action == "ping" or msg_type == "ping":
                await ws_manager.send_to_one(websocket, {
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

            elif action == "subscribe":
                # If channel is unsupported or missing, safely fallback to "dashboard"
                if not channel or channel not in SUPPORTED_CHANNELS:
                    channel = "dashboard"

                async with ws_manager._lock:
                    if websocket not in ws_manager._connections[channel]:
                        ws_manager._connections[channel].append(websocket)
                subscribed_channels.add(channel)

                await ws_manager.send_to_one(websocket, {
                    "type": "subscribed",
                    "channel": channel,
                    "status": "ok",
                })

                # Deliver channel snapshot
                await _send_channel_snapshot(websocket, channel)

            elif channel == "dashboard" or action in ("get_dashboard", "get_snapshot"):
                from app.db.session import SessionLocal
                db = SessionLocal()
                try:
                    snap = await _get_dashboard_snapshot(db)
                    snap["channel"] = "dashboard"
                    await ws_manager.send_to_one(websocket, snap)
                except Exception as e:
                    logger.warning(f"[WS] Error getting dashboard snapshot: {e}")
                finally:
                    db.close()

            elif channel == "kg" or action == "get_kg":
                try:
                    snap = await _get_kg_snapshot()
                    snap["channel"] = "kg"
                    await ws_manager.send_to_one(websocket, snap)
                except Exception as e:
                    logger.warning(f"[WS] Error getting kg snapshot: {e}")

            elif action == "trigger_pipeline":
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
                            "channel": "dashboard",
                            "result": result,
                        })
                    finally:
                        pipeline_db.close()

                asyncio.ensure_future(_run())

    except WebSocketDisconnect:
        logger.info("[WS] Client disconnected")
    except Exception as e:
        logger.error(f"[WS] Unexpected error in connection loop: {e}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass
    finally:
        for ch in list(subscribed_channels):
            await ws_manager.disconnect(websocket, ch)


@router.websocket("")
@router.websocket("/")
async def ws_unified(websocket: WebSocket):
    """
    Unified WebSocket endpoint matching NEXT_PUBLIC_WS_URL=wss://.../api/v1/ws.
    Accepts connection immediately before channel parsing and defaults to 'dashboard'.
    """
    await handle_websocket_connection(websocket, initial_channel=None)


@router.websocket("/dashboard")
@router.websocket("/kg")
@router.websocket("/alerts")
@router.websocket("/pipeline")
async def ws_legacy_bridge(websocket: WebSocket):
    """
    Channel-specific legacy WebSocket endpoints.
    Accepts connection immediately and auto-subscribes to the targeted channel.
    """
    channel = websocket.url.path.rstrip("/").split("/")[-1].lower()
    await handle_websocket_connection(websocket, initial_channel=channel)
