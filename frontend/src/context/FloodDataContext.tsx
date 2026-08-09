"use client";

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

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useWebSocket, WsConnectionStatus } from "@/lib/useWebSocket";
import api from "@/lib/api";

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
  wind_speed?: number;
  pressure?: number;
  river_level_m?: number;
  river_danger_m?: number;
  flood_probability?: number;
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
  rainfall_mm?: number;
  district?: string;
}

export interface ModelMeta {
  inference_time_ms: number;
  latency_ms: number;
  node_count: number;
  edge_count: number;
  inference_mode: string;
  attention_heads?: number;
}

export interface SimulationMeta {
  scenario: string;
  category: string;
  startedAt: string;
  durationMinutes: number;
  simulationId: string;
  predictionSource: string;
}

// ─── Context State ───────────────────────────────────────────────────────────

interface FloodDataState {
  // Mode indicator
  mode: "LIVE" | "SIMULATION";
  // Real-time district risk data
  districts: DistrictRisk[];
  // Knowledge Graph
  kgNodes: KgNode[];
  kgEdges: KgEdge[];
  // Alerts
  alerts: Alert[];
  // Model metadata
  modelMeta: ModelMeta | null;
  // Simulation State & Metadata
  stormSimulationActive: boolean;
  simulationMeta: SimulationMeta;
  // Last pipeline update timestamp
  lastUpdated: string | null;
  // Knowledge Graph Complete Payload
  kgData: any | null;
  // Pipeline (Inference Cycle) Data
  pipelineData: any | null;
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
  toggleStormSimulation: (active?: boolean) => Promise<void>;
  stopSimulation: () => Promise<void>;
  requestSnapshot: () => void;
  refetchPipeline: () => Promise<void>;
  refetchKg: () => Promise<void>;
}

const FloodDataContext = createContext<FloodDataState | null>(null);

const DEFAULT_SIM_META: SimulationMeta = {
  scenario: "Cyclone Michaung",
  category: "Very Severe Cyclonic Storm",
  startedAt: "22:45",
  durationMinutes: 30,
  simulationId: "SIM-20260727-001",
  predictionSource: "Simulated Weather Inputs",
};

// ─── Provider ────────────────────────────────────────────────────────────────

export function FloodDataProvider({ children }: { children: React.ReactNode }) {
  const [districts, setDistricts] = useState<DistrictRisk[]>([]);
  const [kgNodes, setKgNodes] = useState<KgNode[]>([]);
  const [kgEdges, setKgEdges] = useState<KgEdge[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [modelMeta, setModelMeta] = useState<ModelMeta | null>(null);
  const [stormSimulationActive, setStormSimulationActive] = useState<boolean>(false);
  const [simulationMeta, setSimulationMeta] = useState<SimulationMeta>(DEFAULT_SIM_META);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [pipelineData, setPipelineData] = useState<any | null>(null);
  const [kgData, setKgData] = useState<any | null>(null);

  // Initial Sync from REST API
  useEffect(() => {
    let isMounted = true;
    api.get("/dashboard/live").then((res) => {
      if (!isMounted || !res.data) return;
      const data = res.data;
      if (data.metrics?.storm_simulation_active !== undefined) {
        setStormSimulationActive(Boolean(data.metrics.storm_simulation_active));
      }
      if (data.storm_simulation) {
        setSimulationMeta({
          scenario: data.storm_simulation.scenario || DEFAULT_SIM_META.scenario,
          category: data.storm_simulation.category || DEFAULT_SIM_META.category,
          startedAt: data.storm_simulation.started_at || DEFAULT_SIM_META.startedAt,
          durationMinutes: data.storm_simulation.duration_minutes || 30,
          simulationId: data.storm_simulation.simulation_id || DEFAULT_SIM_META.simulationId,
          predictionSource: data.storm_simulation.prediction_source || DEFAULT_SIM_META.predictionSource,
        });
      }
      if (data.districts && Array.isArray(data.districts)) {
        setDistricts(data.districts);
      }
      if (data.alerts && Array.isArray(data.alerts)) {
        setAlerts(data.alerts);
      }
      if (data.timestamp) {
        setLastUpdated(data.timestamp);
      }
    }).catch(err => {
      console.warn("Initial FloodDataContext fetch warning:", err);
    });

    return () => { isMounted = false; };
  }, []);

  const refetchPipeline = useCallback(async () => {
    try {
      const res = await api.get("/predict/inference-cycle", { timeout: 15000 });
      if (res.data) {
        setPipelineData(res.data);
        if (res.data.status === "waiting_for_telemetry" || res.data.status === "processing") {
          setTimeout(refetchPipeline, 3000);
        }
      }
    } catch (err: any) {
      console.warn("Pipeline fetch failed:", err);
      setPipelineData({ status: "error", message: err.message || "Pipeline engine offline or timed out." });
    }
  }, []);

  const refetchKg = useCallback(async () => {
    try {
      const res = await api.get("/kg/graph", { timeout: 15000 });
      if (res.data) setKgData(res.data);
    } catch (err: any) {
      console.warn("KG fetch failed:", err);
      setKgData({ status: "error", message: err.message, nodes: [] });
    }
  }, []);

  useEffect(() => {
    refetchPipeline();
    refetchKg();
  }, [refetchPipeline, refetchKg]);

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
        if (data.storm_simulation_active !== undefined) {
          setStormSimulationActive(Boolean(data.storm_simulation_active));
        } else if (data.storm_simulation !== undefined) {
          setStormSimulationActive(Boolean(data.storm_simulation));
        }
        if (data.recent_alerts && Array.isArray(data.recent_alerts)) {
          setAlerts((prev) => {
            const incoming = data.recent_alerts as Alert[];
            const merged = [...incoming, ...prev].slice(0, 50);
            return merged;
          });
        }
        if (data.timestamp) {
          setLastUpdated(data.timestamp as string);
        }
        if (type === "PIPELINE_UPDATE" || type === "INITIAL_SNAPSHOT") {
          refetchPipeline();
        }
      }
    },
    [refetchPipeline]
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

  const toggleStormSimulation = useCallback(
    async (active?: boolean) => {
      const targetState = active !== undefined ? active : !stormSimulationActive;
      setStormSimulationActive(targetState);
      try {
        const res = await api.post(`/dashboard/simulate-storm?active=${targetState}`);
        if (res.data?.storm_simulation_active !== undefined) {
          setStormSimulationActive(res.data.storm_simulation_active);
        }
        if (res.data?.storm_simulation) {
          setSimulationMeta({
            scenario: res.data.storm_simulation.scenario || DEFAULT_SIM_META.scenario,
            category: res.data.storm_simulation.category || DEFAULT_SIM_META.category,
            startedAt: res.data.storm_simulation.started_at || DEFAULT_SIM_META.startedAt,
            durationMinutes: res.data.storm_simulation.duration_minutes || 30,
            simulationId: res.data.storm_simulation.simulation_id || DEFAULT_SIM_META.simulationId,
            predictionSource: res.data.storm_simulation.prediction_source || DEFAULT_SIM_META.predictionSource,
          });
        }
        sendDashboard({ action: "get_snapshot" });
        return res.data;
      } catch (err) {
        console.error("Failed to toggle storm simulation:", err);
        throw err;
      }
    },
    [stormSimulationActive, sendDashboard]
  );

  const stopSimulation = useCallback(async () => {
    await toggleStormSimulation(false);
  }, [toggleStormSimulation]);

  const requestSnapshot = useCallback(() => {
    sendDashboard({ action: "get_snapshot" });
  }, [sendDashboard]);

  // ─── Derived Stats ─────────────────────────────────────────────────
  const criticalCount = useMemo(
    () =>
      districts.filter((d) =>
        ["Critical", "Severe"].includes(d.risk_level) || d.risk_score >= 80
      ).length,
    [districts]
  );

  const highCount = useMemo(
    () => districts.filter((d) => d.risk_level === "High" || (d.risk_score >= 60 && d.risk_score < 80)).length,
    [districts]
  );

  const mode: "LIVE" | "SIMULATION" = stormSimulationActive ? "SIMULATION" : "LIVE";

  const value: FloodDataState = {
    mode,
    districts,
    kgNodes,
    kgEdges,
    alerts,
    modelMeta,
    stormSimulationActive,
    simulationMeta,
    lastUpdated,
    dashboardStatus,
    kgStatus,
    alertStatus,
    criticalCount,
    highCount,
    totalNodes: kgNodes.length,
    totalEdges: kgEdges.length,
    triggerPipeline,
    toggleStormSimulation,
    stopSimulation,
    requestSnapshot,
    refetchPipeline,
    refetchKg,
    pipelineData,
    kgData,
  };

  return (
    <FloodDataContext.Provider value={value}>
      {children}
    </FloodDataContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Safe defaults returned when hook is called outside a FloodDataProvider (e.g. SSR) */
const SAFE_DEFAULT: FloodDataState = {
  mode: "LIVE",
  districts: [],
  kgNodes: [],
  kgEdges: [],
  alerts: [],
  modelMeta: null,
  stormSimulationActive: false,
  simulationMeta: DEFAULT_SIM_META,
  lastUpdated: null,
  dashboardStatus: "disconnected",
  kgStatus: "disconnected",
  alertStatus: "disconnected",
  criticalCount: 0,
  highCount: 0,
  totalNodes: 0,
  totalEdges: 0,
  triggerPipeline: () => {},
  toggleStormSimulation: async () => {},
  stopSimulation: async () => {},
  requestSnapshot: () => {},
  refetchPipeline: async () => {},
  refetchKg: async () => {},
  pipelineData: null,
  kgData: null,
};

export function useFloodData(): FloodDataState {
  const ctx = useContext(FloodDataContext);
  // Return safe defaults if called outside a provider (SSR / build-time)
  if (!ctx) return SAFE_DEFAULT;
  return ctx;
}

