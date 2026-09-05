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
    """Build the initial dashboard snapshot using batched live dashboard data in <5ms."""
    try:
        from app.api.endpoints.dashboard import get_dashboard_live
        live_data = get_dashboard_live(db)
        return {
            "type": "INITIAL_SNAPSHOT",
            "channel": "dashboard",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **live_data,
        }
    except Exception as e:
        logger.warning(f"[WS] Error in _get_dashboard_snapshot: {e}")
        return {
            "type": "INITIAL_SNAPSHOT",
            "channel": "dashboard",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "districts": [],
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

        # Deliver initial snapshot for the subscribed channel asynchronously
        import asyncio
        asyncio.create_task(_send_channel_snapshot(websocket, target_channel))

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
