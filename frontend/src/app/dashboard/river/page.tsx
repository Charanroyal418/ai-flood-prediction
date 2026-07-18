"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import dynamicImport from "next/dynamic";
const ReactECharts = dynamicImport(() => import("echarts-for-react"), { ssr: false });
import { Waves, AlertTriangle, TrendingUp, RefreshCw, Activity } from "lucide-react";

function RiverCard({ river, index }: { river: any; index: number }) {
  const overflowPct = river.overflow_pct || 0;
  const isCritical = river.status === "Critical";
  const isWarning = river.status === "Warning";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      className="glass-card p-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-heading font-bold text-slate-800">{river.name}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{river.station}</p>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
          isCritical ? "bg-red-50 text-red-700 border-red-100" :
          isWarning ? "bg-amber-50 text-amber-700 border-amber-100" :
          "bg-green-50 text-green-700 border-green-100"
        }`}>
          {river.status}
        </span>
      </div>

      {/* Level gauge */}
      <div className="relative mb-4">
        <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
          <span>Current Level</span>
          <span className="font-semibold text-slate-700">{river.current_m}m / {river.danger_m}m danger</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 relative overflow-hidden">
          <motion.div
            className="h-3 rounded-full"
            style={{
              background: isCritical
                ? "linear-gradient(90deg, #f97316, #ef4444)"
                : isWarning
                ? "linear-gradient(90deg, #f59e0b, #f97316)"
                : "linear-gradient(90deg, #60a5fa, #3b82f6)",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, overflowPct)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          {/* Danger threshold marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 opacity-60"
            style={{ left: "100%" }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-slate-400 mt-1">
          <span>0m</span>
          <span className={`font-bold ${isCritical ? "text-red-500" : isWarning ? "text-amber-500" : "text-green-500"}`}>
            {overflowPct}% of danger level
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 rounded-xl p-2.5 text-center">
          <p className="text-[9px] text-blue-400 font-semibold uppercase">Current</p>
          <p className="text-sm font-heading font-bold text-blue-700">{river.current_m}m</p>
        </div>
        <div className="bg-red-50 rounded-xl p-2.5 text-center">
          <p className="text-[9px] text-red-400 font-semibold uppercase">Danger</p>
          <p className="text-sm font-heading font-bold text-red-700">{river.danger_m}m</p>
        </div>
      </div>
    </motion.div>
  );
}

function RiverLevelChart({ rivers }: { rivers: any[] }) {
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    legend: { data: ["Current Level", "Danger Level"], textStyle: { color: "#94a3b8", fontSize: 11 } },
    grid: { left: 8, right: 8, top: 40, bottom: 60, containLabel: true },
    xAxis: {
      type: "category",
      data: rivers.map(r => r.name.length > 10 ? r.name.slice(0, 10) + "…" : r.name),
      axisLabel: { fontSize: 10, color: "#94a3b8", rotate: 20 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 10, color: "#94a3b8", formatter: "{value}m" },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLine: { show: false },
    },
    series: [
      {
        name: "Current Level",
        type: "bar",
        data: rivers.map(r => ({
          value: r.current_m,
          itemStyle: {
            color: r.status === "Critical" ? "#ef4444" : r.status === "Warning" ? "#f59e0b" : "#3b82f6",
            borderRadius: [6, 6, 0, 0],
          },
        })),
        barWidth: "35%",
        barGap: "10%",
      },
      {
        name: "Danger Level",
        type: "bar",
        data: rivers.map(r => ({
          value: r.danger_m,
          itemStyle: { color: "rgba(239,68,68,0.15)", borderRadius: [6, 6, 0, 0], borderColor: "#ef4444", borderWidth: 1, borderType: "dashed" },
        })),
        barWidth: "35%",
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />;
}

export default function RiverIntelligencePage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rivers"],
    queryFn: async () => {
      const res = await api.get("/dashboard/river");
      return res.data as any[];
    },
    refetchInterval: 10000,
  });

  const rivers = data || [];
  const critical = rivers.filter(r => r.status === "Critical").length;
  const warning = rivers.filter(r => r.status === "Warning").length;
  const avgLevel = rivers.length ? rivers.reduce((a, r) => a + r.overflow_pct, 0) / rivers.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-800">River Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">Live river level monitoring · 9 major rivers of Tamil Nadu</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold border border-blue-100 hover:bg-blue-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Rivers Monitored", value: rivers.length, icon: Waves, color: "text-blue-700", bg: "bg-blue-50" },
          { label: "Critical Level", value: critical, icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50" },
          { label: "Warning Level", value: warning, icon: TrendingUp, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Avg Overflow %", value: `${avgLevel.toFixed(0)}%`, icon: Activity, color: "text-violet-700", bg: "bg-violet-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`glass-card-flat p-4 ${bg}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${bg}`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-xl font-heading font-bold ${color}`}>{value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-heading font-bold text-slate-800 mb-1">River Level Comparison</h2>
        <p className="text-[11px] text-slate-400 mb-4">Current vs. danger level for all monitored rivers</p>
        <div className="h-56">
          {rivers.length > 0 && <RiverLevelChart rivers={rivers} />}
        </div>
      </div>

      {/* River cards */}
      <div>
        <h2 className="text-sm font-heading font-bold text-slate-800 mb-4">Individual River Status</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card h-52 skeleton" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rivers.map((river, i) => <RiverCard key={river.name} river={river} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
