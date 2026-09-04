/**
 * WebSocket Client Utilities (Multiplexed)
 * ----------------------------------------
 * Creates ONE WebSocket connection to NEXT_PUBLIC_WS_URL (defaulting to /api/v1/ws)
 * without appending subpaths like /dashboard or /kg.
 * Multiplexes channel subscriptions and messages via JSON payloads:
 *   { "channel": "dashboard" }
 *   { "channel": "kg" }
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
  heartbeatMs?: number;
  maxRetries?: number;
}

export function getWsUrl(): string {
  let url = process.env.NEXT_PUBLIC_WS_URL;
  if (!url) {
    if (typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";
      let host = "localhost:8000";
      if (process.env.NEXT_PUBLIC_API_URL) {
        try {
          host = new URL(process.env.NEXT_PUBLIC_API_URL).host;
        } catch {
          host = process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        }
      }
      url = `${isHttps ? "wss:" : "ws:"}//${host}/api/v1/ws`;
    } else {
      url = "ws://localhost:8000/api/v1/ws";
    }
  }
  // NEVER append /dashboard or /kg - strip them if present
  return url.replace(/\/+(dashboard|kg|alerts|pipeline)\/?$/, "").replace(/\/+$/, "");
}

type MessageListener = (data: Record<string, unknown>) => void;
type StatusListener = (status: WsConnectionStatus) => void;

class WebSocketMultiplexer {
  private ws: WebSocket | null = null;
  private status: WsConnectionStatus = "disconnected";
  private channelListeners = new Map<WsChannel, Set<MessageListener>>();
  private statusListeners = new Set<StatusListener>();
  private activeChannels = new Set<WsChannel>();
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
    const listeners = this.channelListeners.get(channel);
    if (listeners) {
      listeners.add(listener);
    }
    this.activeChannels.add(channel);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRaw({ channel });
    } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    }
  }

  public unsubscribe(channel: WsChannel, listener: MessageListener) {
    const listeners = this.channelListeners.get(channel);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.activeChannels.delete(channel);
      }
    }
  }

  public send(channel: WsChannel, message: Record<string, unknown>) {
    this.sendRaw({ channel, ...message });
  }

  public sendRaw(message: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public connect() {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = getWsUrl();
    this.setStatus("connecting");

    try {
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        this.setStatus("connected");
        this.retryCount = 0;

        // Subscribe to active channels
        this.activeChannels.forEach((ch) => {
          this.sendRaw({ channel: ch });
        });

        // Start heartbeat
        this.clearHeartbeat();
        this.heartbeatTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendRaw({ action: "ping" });
          }
        }, 30_000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === "pong") return;

          const type = data?.type as string | undefined;
          const msgChannel = data?.channel as WsChannel | undefined;

          // Dispatch by explicit channel or message type
          if (msgChannel && this.channelListeners.has(msgChannel)) {
            this.channelListeners.get(msgChannel)!.forEach((cb) => cb(data));
          } else if (type === "INITIAL_SNAPSHOT" || type === "PIPELINE_UPDATE" || type === "PIPELINE_TRIGGERED") {
            this.channelListeners.get("dashboard")?.forEach((cb) => cb(data));
          } else if (type === "KG_INITIAL_SNAPSHOT" || type === "KG_UPDATE") {
            this.channelListeners.get("kg")?.forEach((cb) => cb(data));
          } else if (type === "ALERT_HISTORY" || type === "NEW_ALERT") {
            this.channelListeners.get("alerts")?.forEach((cb) => cb(data));
          } else if (type === "PIPELINE_STATUS") {
            this.channelListeners.get("pipeline")?.forEach((cb) => cb(data));
          } else {
            // General broadcast to all
            this.channelListeners.forEach((listeners) => {
              listeners.forEach((cb) => cb(data));
            });
          }
        } catch (err) {
          console.error("[WS] Failed to parse message:", err);
        }
      };

      socket.onclose = (event) => {
        this.clearHeartbeat();
        this.setStatus("disconnected");

        if (event.code === 1000 || event.code === 1001) return;

        if (this.retryCount < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30_000);
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
}

// Global multiplexer instance across frontend
let multiplexerInstance: WebSocketMultiplexer | null = null;
function getMultiplexer(): WebSocketMultiplexer {
  if (!multiplexerInstance) {
    multiplexerInstance = new WebSocketMultiplexer();
  }
  return multiplexerInstance;
}

/**
 * Hook for managing a multiplexed WebSocket connection to a named channel.
 */
export function useWebSocket({
  channel,
  onMessage,
  onConnect,
  onDisconnect,
  enabled = true,
}: UseWebSocketOptions) {
  const multiplexer = getMultiplexer();
  const [status, setStatus] = useState<WsConnectionStatus>(multiplexer.getStatus());
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

    multiplexer.addStatusListener(handleStatus);
    multiplexer.subscribe(channel, handleMessage);

    return () => {
      multiplexer.removeStatusListener(handleStatus);
      multiplexer.unsubscribe(channel, handleMessage);
    };
  }, [channel, enabled, multiplexer]);

  const send = useCallback(
    (message: Record<string, unknown>) => {
      multiplexer.send(channel, message);
    },
    [channel, multiplexer]
  );

  return { status, send };
}
