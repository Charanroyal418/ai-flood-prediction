"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import dynamicImport from "next/dynamic";
const ReactECharts = dynamicImport(() => import("echarts-for-react"), { ssr: false });
const FloodMap = dynamicImport(() => import("@/components/map/FloodMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[260px] flex items-center justify-center bg-slate-50 text-xs text-slate-400">
      Loading regional geospatial map...
    </div>
  ),
});

import {
  MapPin,
  Search,
  CloudRain,
  Droplets,
  Waves,
  Shield,
  Brain,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Info,
  Thermometer,
  Mountain,
  Compass,
  Database,
  History,
} from "lucide-react";
import { useFloodData } from "@/context/FloodDataContext";

const RISK_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  Severe: "#ef4444",
  High: "#f97316",
  Moderate: "#f59e0b",
  Low: "#22c55e",
  Safe: "#3b82f6",
  Unavailable: "#94a3b8",
};

const RISK_BG: Record<string, string> = {
  Critical: "bg-red-50 text-red-700 border-red-100",
  Severe: "bg-red-50 text-red-700 border-red-100",
  High: "bg-orange-50 text-orange-700 border-orange-100",
  Moderate: "bg-amber-50 text-amber-700 border-amber-100",
  Low: "bg-green-50 text-green-700 border-green-100",
  Safe: "bg-blue-50 text-blue-700 border-blue-100",
  Unavailable: "bg-slate-50 text-slate-600 border-slate-200",
};

const RISK_ORDER: Record<string, number> = {
  Critical: 5,
  Severe: 5,
  High: 4,
  Moderate: 3,
  Low: 2,
  Safe: 1,
  Unavailable: 0,
};

/**
 * Strict formatting helper: never converts null, undefined, or NaN to 0.
 * Displays "—" for missing values.
 */
function formatVal(val: any, suffix: string = "", decimals?: number): string {
  if (val === null || val === undefined || val === "" || (typeof val === "number" && isNaN(val))) {
    return "—";
  }
  if (typeof val === "number") {
    return decimals !== undefined ? `${val.toFixed(decimals)}${suffix}` : `${val}${suffix}`;
  }
  return `${val}${suffix}`;
}

function DistrictDetailPanel({ district }: { district: any }) {
  const { mode, stormSimulationActive } = useFloodData();
  const isStormActive = stormSimulationActive || mode === "SIMULATION";
  const riskScore = district.risk_score ?? district.riskScore;
  const riskLevel = district.risk_level ?? district.floodRisk ?? "Unavailable";
  const riskColor = district.risk_color || RISK_COLORS[riskLevel] || "#94a3b8";

  const rainfallVal = district.rainfall_mm ?? district.rainfall ?? district.rainfall24h;
  const riverLevelVal = district.river_level_m ?? district.riverLevel;
  const riverDangerVal = district.river_danger_m;
  const humidityVal = district.humidity;
  const windVal = district.wind_speed ?? district.wind;
  const probVal = district.flood_probability;

  // Safe radar computations — avoids NaN
  const radarRain = rainfallVal != null ? Math.min(100, (Number(rainfallVal) / 120) * 100) : 0;
  const radarRiver = (riverLevelVal != null && riverDangerVal && riverDangerVal > 0)
    ? Math.min(100, (Number(riverLevelVal) / Number(riverDangerVal)) * 100)
    : (riverLevelVal != null ? Math.min(100, Number(riverLevelVal) * 15) : 0);
  const radarHumid = humidityVal != null ? Math.min(100, Number(humidityVal)) : 0;
  const radarWind = windVal != null ? Math.min(100, (Number(windVal) / 50) * 100) : 0;
  const radarProb = probVal != null ? Math.min(100, Number(probVal) * 100) : (riskScore != null ? Math.min(100, Number(riskScore)) : 0);

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
        value: [radarRain, radarRiver, radarHumid, radarWind, radarProb],
        itemStyle: { color: riskColor },
        areaStyle: { color: `${riskColor}25` },
        lineStyle: { color: riskColor, width: 2 },
      }],
    }],
  };

  const metrics = [
    { label: "Flood Probability", value: probVal != null ? `${(Number(probVal) * 100).toFixed(1)}%` : "—", icon: Shield },
    { label: "AI Confidence", value: district.ai_confidence != null ? `${(Number(district.ai_confidence) * 100).toFixed(1)}%` : (district.confidence != null ? `${(Number(district.confidence) * 100).toFixed(1)}%` : "—"), icon: Brain },
    { label: "Rainfall 24h", value: formatVal(rainfallVal, " mm", 1), icon: CloudRain },
    { label: "Humidity", value: formatVal(humidityVal, "%", 0), icon: Droplets },
    { label: "River Level", value: formatVal(riverLevelVal, " m", 2), icon: Waves },
    { label: "River Risk Ratio", value: formatVal(district.river_risk ?? district.riverRisk, "%", 1), icon: AlertTriangle },
    { label: "Wind Speed", value: formatVal(windVal, " km/h", 1), icon: TrendingUp },
    { label: "Temperature", value: formatVal(district.temperature, "°C", 1), icon: Thermometer },
    { label: "Elevation", value: formatVal(district.elevation_m ?? district.elevation, " m", 0), icon: Mountain },
    { label: "Terrain Slope", value: formatVal(district.slope, "°", 1), icon: Compass },
    { label: "Reservoir Storage", value: formatVal(district.reservoir_storage ?? district.reservoirStorage, "%", 1), icon: Database },
    { label: "Historical Floods", value: formatVal(district.historical_flood_count ?? district.historicalFloodCount, " recorded"), icon: History },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Header card */}
      <div className={`glass-card p-5 border transition-colors ${isStormActive ? "bg-amber-50/20 border-amber-200" : ""}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-heading font-bold text-slate-800">{district.name}</h2>
              {isStormActive && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500 text-white uppercase tracking-wider shadow-sm">
                  Simulated Analytics
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {district.coastal ? "Coastal District" : "Inland District"} · Pop: {district.population != null ? Number(district.population).toLocaleString("en-IN") : "—"}
            </p>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${RISK_BG[riskLevel] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
            {riskLevel}
          </span>
        </div>

        {/* Risk score bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">AI Risk Score</span>
            <span className="font-bold" style={{ color: riskColor }}>
              {riskScore != null ? `${Number(riskScore).toFixed(1)}/100` : "Unavailable"}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-3 rounded-full"
              style={{ background: riskColor }}
              initial={{ width: 0 }}
              animate={{ width: `${riskScore != null ? Math.min(100, Math.max(0, Number(riskScore))) : 0}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </div>

        {/* Environmental & Risk Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition-colors">
              <Icon className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-slate-400 font-medium truncate">{label}</p>
                <p className="text-xs font-bold text-slate-700 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Radar chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-heading font-bold text-slate-700">Multi-factor Risk Profile</h3>
          {district.last_updated && (
            <span className="text-[10px] text-slate-400">
              Updated: {new Date(district.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="h-48">
          <ReactECharts option={radarOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
        </div>
      </div>
    </motion.div>
  );
}

export default function DistrictAnalyticsPage() {
  const [search, setSearch] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"risk_score" | "rainfall_mm">("risk_score");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["districts"],
    queryFn: async () => {
      const res = await api.get("/api/v1/dashboard/districts");
      const payload = res.data;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.districts)) return payload.districts;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.data?.districts)) return payload.data.districts;
      return [];
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    const handleSimChange = () => {
      refetch();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("floodsense-simulation-changed", handleSimChange);
      return () => window.removeEventListener("floodsense-simulation-changed", handleSimChange);
    }
  }, [refetch]);

  // Real-time WebSocket telemetry context
  const { districts: wsDistricts } = useFloodData();

  // Deduplicate, normalize, and overlay live WebSocket telemetry
  const uniqueDistricts = useMemo(() => {
    const baseList = Array.isArray(data)
      ? data
      : (data?.districts || []);
    
    // Map base items
    const map = new Map<string, any>();
    for (const d of baseList) {
      const nameKey = (d.name || d.district_name || "").toLowerCase().trim();
      const idKey = String(d.id ?? d.district_id ?? "");
      const key = nameKey || idKey;
      if (key) {
        map.set(key, {
          ...d,
          id: d.id ?? d.district_id,
          name: d.name ?? d.district_name,
        });
      }
    }

    // Overlay WebSocket telemetry if available
    if (Array.isArray(wsDistricts) && wsDistricts.length > 0) {
      for (const wd of wsDistricts) {
        const nameKey = (wd.name || wd.district_name || "").toLowerCase().trim();
        const idKey = String(wd.id ?? wd.district_id ?? "");
        const key = nameKey || idKey;
        if (key && map.has(key)) {
          const prev = map.get(key);
          map.set(key, {
            ...prev,
            ...wd,
            id: wd.id ?? wd.district_id ?? prev.id,
            name: wd.name ?? wd.district_name ?? prev.name,
            risk_score: wd.risk_score ?? wd.riskScore ?? prev.risk_score,
            risk_level: wd.risk_level ?? wd.floodRisk ?? prev.risk_level,
            risk_color: wd.risk_color ?? prev.risk_color,
            rainfall_mm: wd.rainfall_mm ?? wd.rainfall ?? prev.rainfall_mm,
            river_level_m: wd.river_level_m ?? wd.riverLevel ?? prev.river_level_m,
            reservoir_storage: wd.reservoir_storage ?? wd.reservoirStorage ?? prev.reservoir_storage,
            humidity: wd.humidity ?? prev.humidity,
            wind_speed: wd.wind_speed ?? wd.wind ?? prev.wind_speed,
            temperature: wd.temperature ?? prev.temperature,
            flood_probability: wd.flood_probability ?? prev.flood_probability,
          });
        } else if (key) {
          map.set(key, {
            ...wd,
            id: wd.id ?? wd.district_id,
            name: wd.name ?? wd.district_name,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [data, wsDistricts]);

  // Auto-select first district if none is selected
  useEffect(() => {
    if (!selectedDistrictId && uniqueDistricts.length > 0) {
      setSelectedDistrictId(uniqueDistricts[0].id);
    }
  }, [uniqueDistricts, selectedDistrictId]);

  const selectedDistrict = useMemo(() => {
    if (!selectedDistrictId) return null;
    return uniqueDistricts.find(d => d.id === selectedDistrictId) || null;
  }, [uniqueDistricts, selectedDistrictId]);

  // Filter & sort
  const filtered = useMemo(() => {
    return uniqueDistricts
      .filter((d: any) => {
        if (!search) return true;
        const q = search.toLowerCase().trim();
        return d?.name?.toLowerCase().includes(q);
      })
      .sort((a: any, b: any) => {
        if (sortBy === "risk_score") {
          const aScore = a.risk_score ?? a.riskScore;
          const bScore = b.risk_score ?? b.riskScore;
          if (aScore != null && bScore != null) return bScore - aScore;
          if (aScore != null) return -1;
          if (bScore != null) return 1;
          const aRank = RISK_ORDER[a.risk_level ?? a.floodRisk] ?? -1;
          const bRank = RISK_ORDER[b.risk_level ?? b.floodRisk] ?? -1;
          return bRank - aRank;
        } else if (sortBy === "rainfall_mm") {
          const aRain = a.rainfall_mm ?? a.rainfall ?? a.rainfall24h;
          const bRain = b.rainfall_mm ?? b.rainfall ?? b.rainfall24h;
          if (aRain != null && bRain != null) return bRain - aRain;
          if (aRain != null) return -1;
          if (bRain != null) return 1;
          return 0;
        }
        return 0;
      });
  }, [uniqueDistricts, search, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-800">District Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">
          Per-district flood risk intelligence · <span className="font-semibold text-violet-600">{uniqueDistricts.length}</span> districts monitored
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* District list & Interactive Map column */}
        <div className="xl:col-span-1 space-y-4">
          {/* Synchronized Geographic Map Card */}
          <div className="glass-card p-2 overflow-hidden h-[280px] relative border border-slate-200">
            <FloodMap
              districts={uniqueDistricts}
              selectedDistrictId={selectedDistrictId}
              onMarkerClick={(id) => setSelectedDistrictId(id)}
            />
          </div>

          {/* District list Card */}
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
              {(["risk_score", "rainfall_mm"] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                    sortBy === key ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {key === "risk_score" ? "By Risk" : "By Rainfall"}
                </button>
              ))}
            </div>

            {/* District List State Rendering */}
            <div className="space-y-1 max-h-[460px] overflow-y-auto no-scrollbar">
              {isLoading && uniqueDistricts.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-14 skeleton rounded-xl mb-1.5" />
                ))
              ) : isError && uniqueDistricts.length === 0 ? (
                <div className="p-6 text-center flex flex-col items-center justify-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-amber-500 mb-1" />
                  <p className="text-xs font-semibold text-slate-700">Unable to load district intelligence</p>
                  <p className="text-[10px] text-slate-400">Failed to connect to the backend pipeline</p>
                  <button
                    onClick={() => refetch()}
                    className="mt-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                  <Info className="w-6 h-6 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-700">No district data available</p>
                  <p className="text-[10px] text-slate-400">
                    {search ? `No districts match "${search}"` : "No monitored districts found"}
                  </p>
                </div>
              ) : (
                filtered.map((district: any) => {
                  const dScore = district.risk_score ?? district.riskScore;
                  const dLevel = district.risk_level ?? district.floodRisk ?? "Unavailable";
                  const dColor = district.risk_color || RISK_COLORS[dLevel] || "#94a3b8";
                  const dRain = district.rainfall_mm ?? district.rainfall ?? district.rainfall24h;
                  const isSelected = selectedDistrictId === district.id;

                  return (
                    <button
                      key={district.id}
                      onClick={() => setSelectedDistrictId(district.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                        isSelected
                          ? "bg-violet-50 border border-violet-200 shadow-sm"
                          : "hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-xs"
                        style={{ background: dColor }}
                      >
                        {dScore != null ? Number(dScore).toFixed(0) : "—"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-800 truncate">{district.name}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${RISK_BG[dLevel] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {dLevel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                          <span>{formatVal(dRain, "mm", 1)}</span>
                          <span>·</span>
                          <span>{district.river_status || (district.river_level_m != null ? `${district.river_level_m}m` : "—")}</span>
                        </div>
                      </div>
                      {dScore != null && (
                        <div className="w-10 bg-slate-100 rounded-full h-1 shrink-0">
                          <div
                            className="h-1 rounded-full"
                            style={{ background: dColor, width: `${Math.min(100, Math.max(0, Number(dScore)))}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Selected District Detail panel */}
        <div className="xl:col-span-2">
          {selectedDistrict ? (
            <DistrictDetailPanel district={selectedDistrict} />
          ) : (
            <div className="glass-card h-full flex flex-col items-center justify-center p-16 text-center min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="text-base font-heading font-bold text-slate-700">Select a District</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-xs">
                Click any district from the list or interactive map to view its detailed risk profile, weather telemetry, and AI predictions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
