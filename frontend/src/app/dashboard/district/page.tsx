"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import dynamicImport from "next/dynamic";
const ReactECharts = dynamicImport(() => import("echarts-for-react"), { ssr: false });
import { MapPin, Search, CloudRain, Droplets, Waves, Shield, Brain, TrendingUp } from "lucide-react";

const RISK_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Moderate: "#f59e0b",
  Low: "#22c55e",
  Safe: "#3b82f6",
};

const RISK_BG: Record<string, string> = {
  Critical: "bg-red-50 text-red-700 border-red-100",
  High: "bg-orange-50 text-orange-700 border-orange-100",
  Moderate: "bg-amber-50 text-amber-700 border-amber-100",
  Low: "bg-green-50 text-green-700 border-green-100",
  Safe: "bg-blue-50 text-blue-700 border-blue-100",
};

function DistrictDetailPanel({ district }: { district: any }) {
  const riskPct = district.risk_score;

  const radarOption = {
    backgroundColor: "transparent",
    radar: {
      indicator: [
        { name: "Rainfall", max: 100 },
        { name: "River Level", max: 100 },
        { name: "Humidity", max: 100 },
        { name: "Wind", max: 100 },
        { name: "Flood Prob.", max: 100 },
      ],
      radius: "65%",
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      splitArea: { show: false },
      name: { color: "#94a3b8", fontSize: 10 },
    },
    series: [{
      type: "radar",
      data: [{
        value: [
          Math.min(100, (district.rainfall_mm / 120) * 100),
          Math.min(100, (district.river_level_m / district.river_danger_m) * 100),
          district.humidity,
          Math.min(100, (district.wind_speed / 50) * 100),
          district.flood_probability * 100,
        ],
        itemStyle: { color: district.risk_color || "#6366f1" },
        areaStyle: { color: `${district.risk_color || "#6366f1"}25` },
        lineStyle: { color: district.risk_color || "#6366f1", width: 2 },
      }],
    }],
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Header card */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-heading font-bold text-slate-800">{district.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {district.coastal ? "Coastal District" : "Inland District"} · Pop: {district.population?.toLocaleString("en-IN")}
            </p>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-full border ${RISK_BG[district.risk_level]}`}
          >
            {district.risk_level}
          </span>
        </div>

        {/* Risk score bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">AI Risk Score</span>
            <span className="font-bold" style={{ color: district.risk_color }}>{riskPct}/100</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-3 rounded-full"
              style={{ background: district.risk_color }}
              initial={{ width: 0 }}
              animate={{ width: `${riskPct}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            { label: "Flood Probability", value: `${(district.flood_probability * 100).toFixed(0)}%`, icon: Shield },
            { label: "AI Confidence", value: `${(district.ai_confidence * 100).toFixed(0)}%`, icon: Brain },
            { label: "Rainfall 24h", value: `${district.rainfall_mm}mm`, icon: CloudRain },
            { label: "Humidity", value: `${district.humidity}%`, icon: Droplets },
            { label: "River Level", value: `${district.river_level_m}m`, icon: Waves },
            { label: "Wind Speed", value: `${district.wind_speed}km/h`, icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <Icon className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
              <div>
                <p className="text-[9px] text-slate-400 font-medium">{label}</p>
                <p className="text-xs font-bold text-slate-700">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Radar chart */}
      <div className="glass-card p-5">
        <h3 className="text-xs font-heading font-bold text-slate-700 mb-2">Multi-factor Risk Profile</h3>
        <div className="h-48">
          <ReactECharts option={radarOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
        </div>
      </div>
    </motion.div>
  );
}

export default function DistrictAnalyticsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [sortBy, setSortBy] = useState("risk_score");

  const { data, isLoading } = useQuery({
    queryKey: ["districts"],
    queryFn: async () => {
      const res = await api.get("/dashboard/districts");
      return res.data as any[];
    },
    refetchInterval: 10000,
  });

  const districts = data || [];
  const filtered = districts
    .filter((d: any) => d.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => b[sortBy] - a[sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-800">District Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Per-district flood risk intelligence · {districts.length} districts monitored</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* District list */}
        <div className="xl:col-span-1">
          <div className="glass-card p-4">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search districts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </div>

            {/* Sort */}
            <div className="flex gap-2 mb-3">
              {["risk_score", "rainfall_mm"].map(key => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                    sortBy === key ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {key === "risk_score" ? "By Risk" : "By Rainfall"}
                </button>
              ))}
            </div>

            <div className="space-y-1 max-h-[540px] overflow-y-auto no-scrollbar">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)
              ) : (
                filtered.map((district: any) => (
                  <button
                    key={district.id}
                    onClick={() => setSelected(district)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                      selected?.id === district.id
                        ? "bg-violet-50 border border-violet-200"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ background: district.risk_color }}
                    >
                      {district.risk_score.toFixed(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{district.name}</p>
                      <p className="text-[10px] text-slate-400">{district.rainfall_mm}mm · {district.risk_level}</p>
                    </div>
                    <div className="w-12 bg-slate-100 rounded-full h-1">
                      <div className="h-1 rounded-full" style={{ background: district.risk_color, width: `${district.risk_score}%` }} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="xl:col-span-2">
          {selected ? (
            <DistrictDetailPanel district={selected} />
          ) : (
            <div className="glass-card h-full flex flex-col items-center justify-center p-16 text-center min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="text-base font-heading font-bold text-slate-700">Select a District</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-xs">Click any district from the list to view its detailed risk profile, weather telemetry, and AI predictions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
