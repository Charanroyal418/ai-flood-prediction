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
 * Falls back to 30-second REST polling when WebSocket is disconnected.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useWebSocket, WsConnectionStatus, reconnectWebSocket } from "@/lib/useWebSocket";
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

// ─── Context State ────────────────────────────────────────────────────────────

export type EngineStatus = "online" | "reconnecting" | "offline";
export type AdminState = "authorized" | "unauthorized" | "idle";

export interface FloodDataState {
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
  relativeSyncTime: string;
  // Knowledge Graph Complete Payload
  kgData: any | null;
  // Pipeline (Inference Cycle) Data
  pipelineData: any | null;
  // Connection status per channel
  dashboardStatus: WsConnectionStatus;
  kgStatus: WsConnectionStatus;
  alertStatus: WsConnectionStatus;
  // Engine health (from /api/v1/health only)
  engineStatus: EngineStatus;
  // Admin State
  adminState: AdminState;
  setAdminState: (state: AdminState) => void;
  checkAdminStatus: () => Promise<any>;
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
  /** Re-ping health + reconnect WS + refetch all data — wired to Force Retry button */
  forceRetry: () => Promise<void>;
  isLoading: boolean;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if the error is an AbortError or axios cancellation — not a real backend failure */
function isAbortError(err: any): boolean {
  return (
    err?.name === "AbortError" ||
    err?.code === "ERR_CANCELED" ||
    err?.message === "canceled" ||
    err?.message?.includes("aborted")
  );
}

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
  const [relativeSyncTime, setRelativeSyncTime] = useState<string>("Just now");
  const [pipelineData, setPipelineData] = useState<any | null>(null);
  const [kgData, setKgData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("reconnecting");
  const [adminState, setAdminState] = useState<AdminState>("idle");

  // Check admin status gracefully without throwing or affecting global error state
  const checkAdminStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/admin/pipeline/status");
      if (res?.status === 401 || (res as any)?.isUnauthorized) {
        setAdminState("unauthorized");
        return null;
      }
      if (res?.data) {
        setAdminState("authorized");
        return res.data;
      }
      return null;
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setAdminState("unauthorized");
        return null;
      }
      return null;
    }
  }, []);

  // Listen for background unauthorized event broadcast by api.ts interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      setAdminState("unauthorized");
    };
    if (typeof window !== "undefined") {
      window.addEventListener("floodsense-admin-unauthorized", handleUnauthorized);
      return () => window.removeEventListener("floodsense-admin-unauthorized", handleUnauthorized);
    }
  }, []);

  // ── Safety: never leave isLoading=true beyond 3 seconds ──────────────────
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // ── Relative sync time ────────────────────────────────────────────────────
  useEffect(() => {
    const updateRelativeTime = () => {
      if (!lastUpdated) {
        setRelativeSyncTime("Just now");
        return;
      }
      const now = new Date().getTime();
      const syncTime = new Date(lastUpdated).getTime();
      const diffSecs = Math.floor((now - syncTime) / 1000);

      if (diffSecs < 10) setRelativeSyncTime("Just now");
      else if (diffSecs < 60) setRelativeSyncTime(`${diffSecs} sec ago`);
      else if (diffSecs < 3600) setRelativeSyncTime(`${Math.floor(diffSecs / 60)} min ago`);
      else setRelativeSyncTime(`${Math.floor(diffSecs / 3600)} hr ago`);
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 5000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // ── Engine Health Check (source of truth for engineStatus) ───────────────
  const healthRetryRef = useRef(0);

  const checkEngineHealth = useCallback(async (): Promise<void> => {
    setEngineStatus("reconnecting");
    healthRetryRef.current = 0;

    const attempt = async (): Promise<void> => {
      try {
        const res = await api.get("/api/v1/health", { timeout: 8000 });
        const s = res?.data?.status;
        if (s === "online" || s === "ok" || res?.status === 200) {
          setEngineStatus("online");
          api.get("/api/v1/dashboard/live").then((liveRes) => {
            if (liveRes?.data?.districts?.length) setDistricts(liveRes.data.districts);
            if (liveRes?.data?.alerts?.length) setAlerts(liveRes.data.alerts);
            if (liveRes?.data?.timestamp) setLastUpdated(liveRes.data.timestamp);
          }).catch(() => {});
          return;
        }
        throw new Error("Unexpected health status");
      } catch (err) {
        if (isAbortError(err)) return; // Don't fail on abort
        healthRetryRef.current += 1;
        if (healthRetryRef.current < 3) {
          await new Promise((r) => setTimeout(r, 2000));
          return attempt();
        }
        setEngineStatus("offline");
      }
    };

    await attempt();
  }, []);

  // Run health check once on mount
  useEffect(() => {
    checkEngineHealth();
  }, [checkEngineHealth]);

  // ── Pipeline Data Fetcher ─────────────────────────────────────────────────
  // Use ref to prevent stale closure issues in recursive setTimeout
  const refetchPipelineRef = useRef<() => Promise<void>>(async () => {});

  const refetchPipeline = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/predict/inference-cycle");
      if (res.data) {
        setPipelineData(res.data);
        if (res.data.status === "waiting_for_telemetry" || res.data.status === "processing") {
          setTimeout(() => refetchPipelineRef.current(), 3000);
        }
      }
    } catch (err: any) {
      if (!isAbortError(err)) {
        console.warn("Pipeline fetch failed:", err);
        // Only set error if we don't already have valid data
        setPipelineData((prev: any) => {
          if (prev && prev.status !== "error") return prev;
          return { status: "error", message: err.message || "Pipeline engine offline or timed out." };
        });
      }
    }
  }, []);

  // Keep ref in sync
  useEffect(() => {
    refetchPipelineRef.current = refetchPipeline;
  }, [refetchPipeline]);

  // ── KG Data Fetcher ───────────────────────────────────────────────────────
  const refetchKg = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/kg/topology");
      if (res.data) setKgData(res.data);
    } catch (err: any) {
      if (!isAbortError(err)) {
        console.warn("KG fetch failed:", err);
        setKgData((prev: any) => {
          if (prev && prev.status !== "error") return prev;
          return { status: "error", message: err.message, nodes: [], edges: [], communities: [], stats: {} };
        });
      }
    }
  }, []);

  // ── Initial REST Sync ─────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    // 10s timeout for initial fetch
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        const [dashboardRes, pipelineRes, kgRes] = await Promise.allSettled([
          api.get("/api/v1/dashboard/live", { signal: controller.signal }),
          api.get("/api/v1/predict/inference-cycle", { signal: controller.signal }),
          api.get("/api/v1/kg/topology", { signal: controller.signal }),
        ]);

        if (!isMounted) return;

        // 1. Process Dashboard Live Data
        if (dashboardRes.status === "fulfilled" && dashboardRes.value?.data) {
          const data = dashboardRes.value.data;
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
        }

        // 2. Process Pipeline Data
        if (pipelineRes.status === "fulfilled" && pipelineRes.value?.data) {
          const data = pipelineRes.value.data;
          setPipelineData(data);
          if (data.status === "waiting_for_telemetry" || data.status === "processing") {
            setTimeout(() => refetchPipelineRef.current(), 3000);
          }
        } else if (pipelineRes.status === "rejected") {
          const err = pipelineRes.reason;
          // Don't mark as error if request was simply aborted (cold start / slow network)
          if (!isAbortError(err)) {
            setPipelineData({
              status: "error",
              message: err.message || "Pipeline engine offline or timed out.",
            });
          }
          // If aborted: leave as null — refetchPipeline will retry
        }

        // 3. Process KG Data
        if (kgRes.status === "fulfilled" && kgRes.value?.data) {
          setKgData(kgRes.value.data);
        } else if (kgRes.status === "rejected") {
          const err = kgRes.reason;
          if (!isAbortError(err)) {
            setKgData({ status: "error", message: err.message, nodes: [], edges: [], communities: [], stats: {} });
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn("Initial FloodDataContext fetch warning:", err);
        }
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  // ─── Dashboard Channel ─────────────────────────────────────────────────
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
        // Only refetch pipeline on PIPELINE_UPDATE, not INITIAL_SNAPSHOT
        // (INITIAL_SNAPSHOT is already handled by the initial REST fetch)
        if (type === "PIPELINE_UPDATE") {
          refetchPipelineRef.current();
        }
      }
    },
    []
  );

  const { status: dashboardStatus, send: sendDashboard } = useWebSocket({
    channel: "dashboard",
    onMessage: handleDashboardMessage,
  });

  // ─── Knowledge Graph Channel ───────────────────────────────────────────
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

  // ─── Alerts Channel ────────────────────────────────────────────────────
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

  // ─── REST Polling Fallback (when WebSocket is disconnected/errored) ────
  // Only poll when WS is fully disconnected or in error state.
  // Do NOT poll while still "connecting" — the WS may succeed imminently.
  useEffect(() => {
    if (dashboardStatus === "connected" || dashboardStatus === "connecting") return;

    const poll = async () => {
      const [dashRes, pipeRes, kgRes] = await Promise.allSettled([
        api.get("/api/v1/dashboard/live"),
        api.get("/api/v1/predict/inference-cycle"),
        api.get("/api/v1/kg/topology"),
      ]);

      if (dashRes.status === "fulfilled" && dashRes.value?.data) {
        const d = dashRes.value.data;
        if (d.districts?.length) setDistricts(d.districts);
        if (d.alerts?.length) setAlerts(d.alerts);
        if (d.timestamp) setLastUpdated(d.timestamp);
      }
      if (pipeRes.status === "fulfilled" && pipeRes.value?.data) {
        setPipelineData(pipeRes.value.data);
      }
      if (kgRes.status === "fulfilled" && kgRes.value?.data) {
        setKgData(kgRes.value.data);
      }
    };

    // Poll immediately, then every 30s
    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [dashboardStatus]);

  // ─── Actions ───────────────────────────────────────────────────────────
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
        const res = await api.post(`/api/v1/dashboard/simulate-storm?active=${targetState}`, { active: targetState });
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

  /**
   * Force Retry — re-pings health, reconnects WS, refetches all data.
   * Wired to the "Force Retry" button on any page.
   */
  const forceRetry = useCallback(async () => {
    setIsLoading(true);
    const safetyTimer = setTimeout(() => setIsLoading(false), 5000);
    try {
      // 1. Re-check engine health
      await checkEngineHealth();
      // 2. Reset & reconnect WebSocket
      reconnectWebSocket();
      // 3. Parallel refetch of all data
      const [dashRes] = await Promise.allSettled([
        api.get("/api/v1/dashboard/live"),
        refetchPipelineRef.current(),
        refetchKg(),
      ]);
      if (dashRes.status === "fulfilled" && dashRes.value?.data) {
        const d = dashRes.value.data;
        if (d.districts) setDistricts(d.districts);
        if (d.alerts) setAlerts(d.alerts);
        if (d.timestamp) setLastUpdated(d.timestamp);
      }
    } catch (err) {
      console.warn("[forceRetry] Error:", err);
    } finally {
      clearTimeout(safetyTimer);
      setIsLoading(false);
    }
  }, [checkEngineHealth, refetchKg]);

  // ─── Derived Stats ─────────────────────────────────────────────────────
  const criticalCount = useMemo(
    () =>
      (districts || []).filter((d) =>
        ["Critical", "Severe"].includes(d.risk_level) || d.risk_score >= 80
      ).length,
    [districts]
  );

  const highCount = useMemo(
    () => (districts || []).filter((d) => d.risk_level === "High" || (d.risk_score >= 60 && d.risk_score < 80)).length,
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
    relativeSyncTime,
    dashboardStatus,
    kgStatus,
    alertStatus,
    engineStatus,
    adminState,
    setAdminState,
    checkAdminStatus,
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
    forceRetry,
    pipelineData,
    kgData,
    isLoading,
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
  relativeSyncTime: "Just now",
  dashboardStatus: "disconnected",
  kgStatus: "disconnected",
  alertStatus: "disconnected",
  engineStatus: "reconnecting",
  adminState: "idle",
  setAdminState: () => {},
  checkAdminStatus: async () => null,
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
  forceRetry: async () => {},
  pipelineData: null,
  kgData: null,
  isLoading: false,
};

export function useFloodData(): FloodDataState {
  const ctx = useContext(FloodDataContext);
  // Return safe defaults if called outside a provider (SSR / build-time)
  if (!ctx) return SAFE_DEFAULT;
  return ctx;
}
