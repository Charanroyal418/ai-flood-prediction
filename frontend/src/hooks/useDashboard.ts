"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useFloodData, AdminState } from "@/context/FloodDataContext";

/**
 * useDashboard Hook
 * -----------------
 * Exposes core flood monitoring data along with safe, non-blocking admin queries.
 *
 * Rules:
 * - Wrap all admin API calls in try/catch.
 * - If status === 401: return null, set admin state to "unauthorized", do not throw, do not update global error state.
 * - React Query must use: retry: false for 401, throwOnError: false.
 * - Sidebar navigation must work regardless of admin request failures.
 */
export function useDashboard() {
  const floodData = useFloodData();
  const { adminState, setAdminState } = floodData;

  // ── Safe Admin Metrics Fetcher ─────────────────────────────────────────────
  const fetchAdminMetrics = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/admin/ml/metrics");
      if (res?.status === 401 || (res as any)?.isUnauthorized) {
        setAdminState("unauthorized");
        return null;
      }
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setAdminState("unauthorized");
        return null;
      }
      return null;
    }
  }, [setAdminState]);

  // ── Safe Admin Pipeline Status Fetcher ────────────────────────────────────
  const fetchAdminPipelineStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/admin/pipeline/status");
      if (res?.status === 401 || (res as any)?.isUnauthorized) {
        setAdminState("unauthorized");
        return null;
      }
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setAdminState("unauthorized");
        return null;
      }
      return null;
    }
  }, [setAdminState]);

  // ── Safe Admin GNN Retrain Status Fetcher ─────────────────────────────────
  const fetchAdminGnnStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/admin/ml/retrain-gnn/status");
      if (res?.status === 401 || (res as any)?.isUnauthorized) {
        setAdminState("unauthorized");
        return null;
      }
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setAdminState("unauthorized");
        return null;
      }
      return null;
    }
  }, [setAdminState]);

  // React Query with throwOnError: false, retry: false on 401
  const adminMetricsQuery = useQuery({
    queryKey: ["adminMetricsSafe"],
    queryFn: fetchAdminMetrics,
    enabled: false,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) return false;
      return false;
    },
    throwOnError: false,
  });

  const adminPipelineQuery = useQuery({
    queryKey: ["adminPipelineStatusSafe"],
    queryFn: fetchAdminPipelineStatus,
    enabled: false,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) return false;
      return false;
    },
    throwOnError: false,
  });

  const adminGnnQuery = useQuery({
    queryKey: ["adminGnnStatusSafe"],
    queryFn: fetchAdminGnnStatus,
    enabled: false,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) return false;
      return false;
    },
    throwOnError: false,
  });

  return {
    ...floodData,
    adminState,
    setAdminState,
    fetchAdminMetrics,
    fetchAdminPipelineStatus,
    fetchAdminGnnStatus,
    adminMetricsQuery,
    adminPipelineQuery,
    adminGnnQuery,
  };
}

export default useDashboard;
