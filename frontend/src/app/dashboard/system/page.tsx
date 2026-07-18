"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Activity, Database, Brain, Zap, Cloud, Bell, RefreshCw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

function ServiceCard({ name, status, details, icon: Icon, color, bg }: any) {
  const isOnline = status === "online" || status === "operational";

  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="glass-card p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
          isOnline ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          {isOnline ? "Online" : "Offline"}
        </div>
      </div>
      <p className="text-sm font-heading font-bold text-slate-800">{name}</p>
      <div className="mt-3 space-y-1.5">
        {Object.entries(details || {}).slice(0, 4).map(([key, val]) => (
          <div key={key} className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 capitalize">{key.replace(/_/g, " ")}</span>
            <span className="text-[10px] font-semibold text-slate-700 text-right max-w-[120px] truncate">
              {typeof val === "number" ? (typeof val === "number" && val % 1 !== 0 ? val.toFixed(2) : val.toLocaleString()) : String(val)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function SystemHealthPage() {
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["systemHealth"],
    queryFn: async () => {
      const res = await api.get("/system/health");
      return res.data;
    },
    refetchInterval: 15000,
  });

  const services = data?.services || {};
  const telemetry = data?.telemetry || {};

  const serviceConfig = [
    { key: "gdnn_model", name: "GDNN Model", icon: Brain, color: "text-violet-600", bg: "bg-violet-50" },
    { key: "knowledge_graph", name: "Knowledge Graph", icon: Activity, color: "text-indigo-600", bg: "bg-indigo-50" },
    { key: "weather_etl", name: "Weather ETL", icon: Cloud, color: "text-blue-600", bg: "bg-blue-50" },
    { key: "alert_engine", name: "Alert Engine", icon: Bell, color: "text-red-600", bg: "bg-red-50" },
    { key: "database", name: "Database", icon: Database, color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-800">System Health</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time platform diagnostics · All services status</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400">
            Last check: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN") : "—"}
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 text-green-600 text-xs font-semibold border border-green-100 hover:bg-green-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Overall status */}
      <div className={`glass-card p-5 ${data?.status === "operational" ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${data?.status === "operational" ? "bg-green-100" : "bg-red-100"}`}>
            {data?.status === "operational" ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <AlertTriangle className="w-6 h-6 text-red-600" />}
          </div>
          <div>
            <p className={`text-base font-heading font-bold ${data?.status === "operational" ? "text-green-800" : "text-red-800"}`}>
              {data?.status === "operational" ? "All Systems Operational" : "System Degraded"}
            </p>
            <p className="text-xs text-slate-500">FloodSense AI Platform · Tamil Nadu Disaster Intelligence</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-slate-400">Platform uptime</p>
            <p className="text-sm font-bold text-slate-700">{telemetry.uptime_hours?.toFixed(0) ?? "—"}h</p>
          </div>
        </div>
      </div>

      {/* Telemetry row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Sensors Active", value: telemetry.sensors_active ?? "—", icon: Activity, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "API Calls Today", value: telemetry.api_calls_today?.toLocaleString() ?? "—", icon: Zap, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Avg Response", value: telemetry.avg_response_ms ? `${telemetry.avg_response_ms.toFixed(0)}ms` : "—", icon: Clock, color: "text-green-600", bg: "bg-green-50" },
          { label: "Districts Monitored", value: telemetry.districts_monitored ?? 38, icon: Activity, color: "text-indigo-600", bg: "bg-indigo-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`glass-card-flat p-4 ${bg}`}>
            <Icon className={`w-4 h-4 mb-2 ${color}`} />
            <p className={`text-xl font-heading font-bold ${color}`}>{value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Service cards */}
      <div>
        <h2 className="text-sm font-heading font-bold text-slate-800 mb-4">Service Status</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-card h-40 skeleton" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {serviceConfig.map(svc => (
              <ServiceCard
                key={svc.key}
                name={svc.name}
                status={services[svc.key]?.status}
                details={services[svc.key]}
                icon={svc.icon}
                color={svc.color}
                bg={svc.bg}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
