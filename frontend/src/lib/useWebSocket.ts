/**
 * WebSocket Client Utilities (Single Unified Multiplexer)
 * --------------------------------------------------------
 * Creates exactly ONE WebSocket connection to process.env.NEXT_PUBLIC_WS_URL.
 * No channel-specific sockets (/ws/dashboard, /ws/kg, /ws/alerts).
 *
 * After onopen, sends:
 *   { action: "subscribe", channel: "dashboard" }
 *   { action: "subscribe", channel: "kg" }
 *   { action: "subscribe", channel: "alerts" }
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";

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
}

const DEFAULT_WS_URL = "wss://tn-flood-ai-backend.onrender.com/api/v1/ws";

export function getWsUrl(): string {
  let url = process.env.NEXT_PUBLIC_WS_URL || DEFAULT_WS_URL;
  if (typeof window !== "undefined") {
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal && !process.env.NEXT_PUBLIC_WS_URL) {
      url = "ws://localhost:8000/api/v1/ws";
    }
  }
  // Guarantee NO subpaths like /dashboard, /kg, /alerts are ever appended
  return url
    .replace(/\/+(dashboard|kg|alerts|pipeline)\/?$/i, "")
    .replace(/\/+$/, "");
}

type MessageListener = (data: Record<string, unknown>) => void;
type StatusListener = (status: WsConnectionStatus) => void;

class SharedWebSocket {
  private socket: WebSocket | null = null;
  private status: WsConnectionStatus = "disconnected";
  private channelListeners = new Map<WsChannel, Set<MessageListener>>();
  private statusListeners = new Set<StatusListener>();
  private retryCount = 0;
  private maxRetries = 10;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.channelListeners.set("dashboard", new Set());
    this.channelListeners.set("kg", new Set());
    this.channelListeners.set("alerts", new Set());
    this.channelListeners.set("pipeline", new Set());
  }

  public getStatus(): WsConnectionStatus {
    return this.status;
  }

  public getSocket(): WebSocket | null {
    return this.socket;
  }

  private setStatus(newStatus: WsConnectionStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (err) {
        console.error("[WS] Status listener error:", err);
      }
    });
  }

  public addStatusListener(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.status);
  }

  public removeStatusListener(listener: StatusListener) {
    this.statusListeners.delete(listener);
  }

  public subscribe(channel: WsChannel, listener: MessageListener) {
    this.channelListeners.get(channel)?.add(listener);
    this.ensureConnected();
  }

  public unsubscribe(channel: WsChannel, listener: MessageListener) {
    this.channelListeners.get(channel)?.delete(listener);
  }

  public send(channel: WsChannel, message: Record<string, unknown>) {
    this.sendRaw({ channel, ...message });
  }

  public sendRaw(message: Record<string, unknown>) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  public ensureConnected() {
    if (typeof window === "undefined") return;
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.connect();
  }

  public connect() {
    if (typeof window === "undefined") return;
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = getWsUrl();
    this.setStatus("connecting");

    try {
      // Exactly ONE new WebSocket() instance in the entire project
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => {
        this.setStatus("connected");
        this.retryCount = 0;

        // Subscribe to channels immediately after connection
        socket.send(
          JSON.stringify({
            action: "subscribe",
            channel: "dashboard",
          })
        );

        socket.send(
          JSON.stringify({
            action: "subscribe",
            channel: "kg",
          })
        );

        socket.send(
          JSON.stringify({
            action: "subscribe",
            channel: "alerts",
          })
        );

        // Heartbeat keepalive every 30s
        this.clearHeartbeat();
        this.heartbeatTimer = setInterval(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ action: "ping" }));
          }
        }, 30000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === "pong") return;

          const type = data?.type as string | undefined;
          const msgChannel = data?.channel as WsChannel | undefined;

          if (msgChannel && this.channelListeners.has(msgChannel)) {
            this.channelListeners.get(msgChannel)!.forEach((cb) => cb(data));
          } else if (
            type === "INITIAL_SNAPSHOT" ||
            type === "PIPELINE_UPDATE" ||
            type === "PIPELINE_TRIGGERED"
          ) {
            this.channelListeners.get("dashboard")?.forEach((cb) => cb(data));
          } else if (type === "KG_INITIAL_SNAPSHOT" || type === "KG_UPDATE") {
            this.channelListeners.get("kg")?.forEach((cb) => cb(data));
          } else if (type === "ALERT_HISTORY" || type === "NEW_ALERT") {
            this.channelListeners.get("alerts")?.forEach((cb) => cb(data));
          } else if (type === "PIPELINE_STATUS") {
            this.channelListeners.get("pipeline")?.forEach((cb) => cb(data));
          } else {
            this.channelListeners.forEach((listeners) => {
              listeners.forEach((cb) => cb(data));
            });
          }
        } catch (err) {
          console.error("[WS] Message parsing error:", err);
        }
      };

      socket.onclose = (event) => {
        this.clearHeartbeat();
        this.setStatus("disconnected");

        if (event.code === 1000 || event.code === 1001) return;

        if (this.retryCount < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
          this.retryCount += 1;
          this.reconnectTimer = setTimeout(() => this.connect(), delay);
        } else {
          this.setStatus("error");
        }
      };

      socket.onerror = () => {
        // Handled in onclose
      };
    } catch {
      this.setStatus("error");
    }
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public resetAndReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearHeartbeat();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onopen = null;
      this.socket.onmessage = null;
      if (
        this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING
      ) {
        this.socket.close(1000, "Manual reset");
      }
      this.socket = null;
    }
    this.retryCount = 0;
    this.setStatus("connecting");
    this.connect();
  }
}

// Single shared WebSocket instance across the entire frontend
let sharedSocketInstance: SharedWebSocket | null = null;

export function getSharedWebSocket(): SharedWebSocket {
  if (!sharedSocketInstance) {
    sharedSocketInstance = new SharedWebSocket();
  }
  return sharedSocketInstance;
}

/** Trigger a full WebSocket reset + reconnect from anywhere (e.g. Force Retry). */
export function reconnectWebSocket(): void {
  getSharedWebSocket().resetAndReconnect();
}

/**
 * Hook for consuming from the shared single WebSocket connection.
 */
export function useWebSocket({
  channel,
  onMessage,
  onConnect,
  onDisconnect,
  enabled = true,
}: UseWebSocketOptions) {
  const shared = getSharedWebSocket();
  const [status, setStatus] = useState<WsConnectionStatus>(shared.getStatus());
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const onConnectRef = useRef(onConnect);
  onConnectRef.current = onConnect;

  const onDisconnectRef = useRef(onDisconnect);
  onDisconnectRef.current = onDisconnect;

  useEffect(() => {
    if (!enabled) return;

    const handleStatus = (newStatus: WsConnectionStatus) => {
      setStatus(newStatus);
      if (newStatus === "connected") {
        onConnectRef.current?.();
      } else if (newStatus === "disconnected" || newStatus === "error") {
        onDisconnectRef.current?.();
      }
    };

    const handleMessage: MessageListener = (data) => {
      onMessageRef.current(data);
    };

    shared.addStatusListener(handleStatus);
    shared.subscribe(channel, handleMessage);

    return () => {
      shared.removeStatusListener(handleStatus);
      shared.unsubscribe(channel, handleMessage);
    };
  }, [channel, enabled, shared]);

  const send = useCallback(
    (message: Record<string, unknown>) => {
      shared.send(channel, message);
    },
    [channel, shared]
  );

  const reconnect = useCallback(() => {
    shared.resetAndReconnect();
  }, [shared]);

  return { status, send, reconnect };
}
