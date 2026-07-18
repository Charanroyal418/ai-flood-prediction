/**
 * WebSocket Client Utilities
 * ---------------------------
 * Provides a typed WebSocket hook for connecting to the backend
 * real-time channels (dashboard, kg, alerts, pipeline).
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Heartbeat ping/pong to keep connection alive
 * - TypeScript-typed message handlers
 * - Graceful cleanup on component unmount
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  "ws://localhost:8000/api/v1/ws";

export type WsChannel = "dashboard" | "kg" | "alerts" | "pipeline";

export type WsConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

interface UseWebSocketOptions {
  channel: WsChannel;
  onMessage: (data: Record<string, unknown>) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  enabled?: boolean;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatMs?: number;
  /** Max reconnect attempts (default: 10) */
  maxRetries?: number;
}

/**
 * Hook for managing a WebSocket connection to a named channel.
 *
 * @example
 * const { status, send } = useWebSocket({
 *   channel: "dashboard",
 *   onMessage: (data) => setDashboardData(data),
 * });
 */
export function useWebSocket({
  channel,
  onMessage,
  onConnect,
  onDisconnect,
  enabled = true,
  heartbeatMs = 30_000,
  maxRetries = 10,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<WsConnectionStatus>("disconnected");

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${WS_BASE_URL}/${channel}`;
    setStatus("connecting");

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus("connected");
        retriesRef.current = 0;
        onConnect?.();

        // Start heartbeat
        clearHeartbeat();
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "ping" }));
          }
        }, heartbeatMs);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          // Ignore pong messages
          if (data?.type === "pong") return;
          onMessage(data);
        } catch (err) {
          console.error(`[WS/${channel}] Failed to parse message:`, err);
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        clearHeartbeat();
        setStatus("disconnected");
        onDisconnect?.();

        // Don't reconnect if intentionally closed
        if (event.code === 1000 || event.code === 1001) return;

        // Exponential backoff reconnect
        if (retriesRef.current < maxRetries) {
          const delay = Math.min(
            1000 * Math.pow(2, retriesRef.current),
            30_000
          );
          retriesRef.current += 1;
          console.log(
            `[WS/${channel}] Reconnecting in ${delay}ms (attempt ${retriesRef.current}/${maxRetries})`
          );
          setTimeout(connect, delay);
        } else {
          console.error(`[WS/${channel}] Max retries exceeded.`);
          setStatus("error");
        }
      };

      ws.onerror = () => {
        setStatus("error");
      };
    } catch (err) {
      console.error(`[WS/${channel}] Connection failed:`, err);
      setStatus("error");
    }
  }, [channel, enabled, heartbeatMs, maxRetries, onMessage, onConnect, onDisconnect, clearHeartbeat]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      connect();
    }
    return () => {
      mountedRef.current = false;
      clearHeartbeat();
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [connect, enabled, clearHeartbeat]);

  return { status, send };
}
