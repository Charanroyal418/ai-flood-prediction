/**
 * FloodData Context
 * ------------------
 * Global React context that manages real-time flood data from WebSocket
 * connections and exposes it to all dashboard components.
 *
 * Data Flow:
 *   WebSocket (dashboard channel) -> FloodDataContext -> Dashboard pages
 *   WebSocket (kg channel)        -> FloodDataContext -> KG page
 *   WebSocket (alerts channel)    -> FloodDataContext -> Alerts page
 *
 * Replaces TanStack Query polling with push-based updates.
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useWebSocket, WsConnectionStatus } from "@/lib/useWebSocket";

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface ShapValue {
  label: string;
  value: number;
  color: string;
  contribution_pct: number;
}

export interface DistrictRisk {
  district_id: number;
  district_name: string;
  risk_score: number;
  risk_level: string;
  risk_color: string;
  confidence: number;
  shap_values: ShapValue[];
  rainfall_mm: number;
  humidity: number;
  temperature: number;
}

export interface KgNode {
  id: string;
  type: string;
  label: string;
  risk_score: number;
  risk_level: string;
  risk_color: string;
  elevation?: number;
  rainfall?: number;
}

export interface KgEdge {
  source: string;
  target: string;
  weight: number;
  animated: boolean;
}

export interface Alert {
  district_id: number;
  level: string;
  severity: string;
  message: string;
  suggested_response?: string;
  confidence?: number;
  created_at: string;
}

export interface ModelMeta {
  inference_time_ms: number;
  latency_ms: number;
  node_count: number;
  edge_count: number;
  inference_mode: string;
}

// ─── Context State ───────────────────────────────────────────────────────────

interface FloodDataState {
  // Real-time district risk data
  districts: DistrictRisk[];
  // Knowledge Graph
  kgNodes: KgNode[];
  kgEdges: KgEdge[];
  // Alerts
  alerts: Alert[];
  // Model metadata
  modelMeta: ModelMeta | null;
  // Last pipeline update timestamp
  lastUpdated: string | null;
  // Connection status per channel
  dashboardStatus: WsConnectionStatus;
  kgStatus: WsConnectionStatus;
  alertStatus: WsConnectionStatus;
  // Derived stats
  criticalCount: number;
  highCount: number;
  totalNodes: number;
  totalEdges: number;
  // Actions
  triggerPipeline: (storm?: boolean) => void;
  requestSnapshot: () => void;
}

const FloodDataContext = createContext<FloodDataState | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function FloodDataProvider({ children }: { children: React.ReactNode }) {
  const [districts, setDistricts] = useState<DistrictRisk[]>([]);
  const [kgNodes, setKgNodes] = useState<KgNode[]>([]);
  const [kgEdges, setKgEdges] = useState<KgEdge[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [modelMeta, setModelMeta] = useState<ModelMeta | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // ─── Dashboard Channel ─────────────────────────────────────────────
  const handleDashboardMessage = useCallback(
    (data: Record<string, unknown>) => {
      const type = data.type as string;

      if (type === "INITIAL_SNAPSHOT" || type === "PIPELINE_UPDATE") {
        if (data.districts && Array.isArray(data.districts)) {
          setDistricts(data.districts as DistrictRisk[]);
        }
        if (data.model_meta) {
          setModelMeta(data.model_meta as ModelMeta);
        }
        if (data.recent_alerts && Array.isArray(data.recent_alerts)) {
          setAlerts((prev) => {
            const incoming = data.recent_alerts as Alert[];
            // Merge with existing, keeping most recent 50
            const merged = [...incoming, ...prev].slice(0, 50);
            return merged;
          });
        }
        if (data.timestamp) {
          setLastUpdated(data.timestamp as string);
        }
      }
    },
    []
  );

  const { status: dashboardStatus, send: sendDashboard } = useWebSocket({
    channel: "dashboard",
    onMessage: handleDashboardMessage,
  });

  // ─── Knowledge Graph Channel ───────────────────────────────────────
  const handleKgMessage = useCallback((data: Record<string, unknown>) => {
    const type = data.type as string;

    if (type === "KG_INITIAL_SNAPSHOT" || type === "KG_UPDATE") {
      if (data.nodes && Array.isArray(data.nodes)) {
        setKgNodes(data.nodes as KgNode[]);
      }
      if (data.edges && Array.isArray(data.edges)) {
        setKgEdges(data.edges as KgEdge[]);
      }
    }
  }, []);

  const { status: kgStatus } = useWebSocket({
    channel: "kg",
    onMessage: handleKgMessage,
  });

  // ─── Alerts Channel ────────────────────────────────────────────────
  const handleAlertMessage = useCallback((data: Record<string, unknown>) => {
    const type = data.type as string;

    if (type === "ALERT_HISTORY" && Array.isArray(data.alerts)) {
      setAlerts(data.alerts as Alert[]);
    }
    if (type === "NEW_ALERT" && data.alert) {
      setAlerts((prev) => [data.alert as Alert, ...prev].slice(0, 100));
    }
  }, []);

  const { status: alertStatus } = useWebSocket({
    channel: "alerts",
    onMessage: handleAlertMessage,
  });

  // ─── Actions ───────────────────────────────────────────────────────
  const triggerPipeline = useCallback(
    (storm = false) => {
      sendDashboard({ action: "trigger_pipeline", storm });
    },
    [sendDashboard]
  );

  const requestSnapshot = useCallback(() => {
    sendDashboard({ action: "get_snapshot" });
  }, [sendDashboard]);

  // ─── Derived Stats ─────────────────────────────────────────────────
  const criticalCount = useMemo(
    () =>
      districts.filter((d) =>
        ["Severe", "High"].includes(d.risk_level)
      ).length,
    [districts]
  );

  const highCount = useMemo(
    () => districts.filter((d) => d.risk_level === "Moderate").length,
    [districts]
  );

  const value: FloodDataState = {
    districts,
    kgNodes,
    kgEdges,
    alerts,
    modelMeta,
    lastUpdated,
    dashboardStatus,
    kgStatus,
    alertStatus,
    criticalCount,
    highCount,
    totalNodes: kgNodes.length,
    totalEdges: kgEdges.length,
    triggerPipeline,
    requestSnapshot,
  };

  return (
    <FloodDataContext.Provider value={value}>
      {children}
    </FloodDataContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFloodData(): FloodDataState {
  const ctx = useContext(FloodDataContext);
  if (!ctx) {
    throw new Error("useFloodData must be used within a FloodDataProvider");
  }
  return ctx;
}
