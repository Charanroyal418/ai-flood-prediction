"""
WebSocket Connection Manager
------------------------------
Manages all active WebSocket connections for real-time streaming.

Features:
- Connection pools per channel (dashboard, kg, alerts)
- Broadcast to all connected clients in a channel
- Automatic cleanup on disconnect
- JSON message serialization
"""

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connection pools.
    
    Channels:
    - "dashboard": Real-time district risk grid + metrics
    - "kg": Knowledge graph node/edge updates
    - "alerts": Alert stream
    - "pipeline": Pipeline tick status
    """

    def __init__(self):
        # channel_name -> list of active connections
        self._connections: Dict[str, List[WebSocket]] = defaultdict(list)
        self._lock: Optional[asyncio.Lock] = None
        self._main_loop: Optional[asyncio.AbstractEventLoop] = None

    def set_main_loop(self, loop: asyncio.AbstractEventLoop):
        """Set the main application event loop for thread-safe cross-thread scheduling."""
        self._main_loop = loop
        self._lock = asyncio.Lock()

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def connect(self, websocket: WebSocket, channel: str = "dashboard"):
        """Accept and register a new WebSocket connection."""
        from starlette.websockets import WebSocketState
        try:
            if getattr(websocket, "client_state", None) == WebSocketState.CONNECTING:
                await websocket.accept()
        except Exception as e:
            logger.warning(f"[WS] accept() in connect(): {e}")

        async with self._get_lock():
            if websocket not in self._connections[channel]:
                self._connections[channel].append(websocket)
        logger.info(
            f"[WS] Client connected to '{channel}' channel. "
            f"Total: {len(self._connections[channel])}"
        )

    async def disconnect(self, websocket: WebSocket, channel: str = "dashboard"):
        """Remove a disconnected WebSocket."""
        async with self._get_lock():
            conns = self._connections[channel]
            if websocket in conns:
                conns.remove(websocket)
        logger.info(
            f"[WS] Client disconnected from '{channel}'. "
            f"Remaining: {len(self._connections[channel])}"
        )

    async def broadcast(self, message: Dict[str, Any], channel: str = "dashboard"):
        """Broadcast a JSON message to all clients in a channel."""
        payload = json.dumps(message, default=str)
        dead_connections: List[WebSocket] = []

        async with self._get_lock():
            connections = list(self._connections[channel])

        for ws in connections:
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"[WS] Failed to send to client: {e}")
                dead_connections.append(ws)

        # Cleanup dead connections
        if dead_connections:
            async with self._get_lock():
                for dead in dead_connections:
                    try:
                        self._connections[channel].remove(dead)
                    except ValueError:
                        pass

    def broadcast_sync(self, message: Dict[str, Any], channel: str = "dashboard"):
        """
        Thread-safe synchronous broadcast from any worker thread or sync endpoint.
        Delegates coroutine execution to the main uvicorn event loop without blocking.
        """
        try:
            loop = getattr(self, "_main_loop", None)
            if loop and loop.is_running():
                asyncio.run_coroutine_threadsafe(self.broadcast(message, channel), loop)
                return

            # Fallback: check if the current thread has a running loop
            try:
                current_loop = asyncio.get_running_loop()
                if current_loop.is_running():
                    current_loop.create_task(self.broadcast(message, channel))
                    return
            except RuntimeError:
                pass
        except Exception as e:
            logger.warning(f"[WS] broadcast_sync error: {e}")

    async def send_to_one(
        self, websocket: WebSocket, message: Dict[str, Any]
    ):
        """Send a message to a single client."""
        try:
            await websocket.send_text(json.dumps(message, default=str))
        except Exception as e:
            logger.warning(f"[WS] Failed to send personal message: {e}")

    def get_connection_count(self, channel: Optional[str] = None) -> Dict[str, int]:
        """Return connection counts per channel."""
        if channel:
            return {channel: len(self._connections[channel])}
        return {ch: len(conns) for ch, conns in self._connections.items()}

    async def broadcast_all_channels(self, message: Dict[str, Any]):
        """Broadcast to every connected client across all channels."""
        for channel in list(self._connections.keys()):
            await self.broadcast(message, channel)


# Global singleton instance (imported across the app)
ws_manager = ConnectionManager()
