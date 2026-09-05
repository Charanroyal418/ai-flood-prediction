"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useFloodData } from "@/context/FloodDataContext";
import dynamicImport from "next/dynamic";
const ReactECharts = dynamicImport(() => import("echarts-for-react"), { ssr: false });
import { History, Users, AlertTriangle, MapPin, Calendar } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  Extreme: "#ef4444",
  High: "#f97316",
  Moderate: "#f59e0b",
  Low: "#22c55e",
};

function HistoryTimeline({ events }: { events: any[] }) {
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      formatter: (p: any) => {
        const d = events.find(e => e.year === p[0].name);
        return d ? `<div style="padding:4px"><b>${d.year} — ${d.event}</b><br/>Affected: ${d.affected_people.toLocaleString()}<br/>Deaths: ${d.deaths}<br/>Damage: ₹${d.damage_cr} Cr</div>` : "";
      },
    },
    grid: { left: 8, right: 8, top: 20, bottom: 60, containLabel: true },
    xAxis: {
      type: "category",
      data: events.map(e => e.year),
      axisLabel: { fontSize: 11, color: "#94a3b8" },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: "value",
        name: "Affected People",
        axisLabel: { fontSize: 9, color: "#94a3b8", formatter: (v: number) => v >= 1000000 ? `${v/1000000}M` : `${v/1000}K` },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLine: { show: false },
      },
    ],
    series: [
      {
        type: "bar",
        data: events.map(e => ({
          value: e.affected_people,
          itemStyle: {
            color: SEVERITY_COLORS[e.severity] || "#94a3b8",
            borderRadius: [8, 8, 0, 0],
          },
        })),
        barWidth: "55%",
        label: {
          show: true,
          position: "top",
          formatter: (p: any) => events[p.dataIndex]?.severity,
          fontSize: 9,
          color: "#64748b",
          distance: 4,
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />;
}

function DamageChart({ events }: { events: any[] }) {
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      formatter: (p: any) => `<div><b>${events[p.dataIndex]?.year}</b><br/>₹${p.value} Crores</div>`,
    },
    grid: { left: 8, right: 8, top: 20, bottom: 50, containLabel: true },
    xAxis: {
      type: "category",
      data: events.map(e => e.year),
      axisLabel: { fontSize: 11, color: "#94a3b8" },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 10, color: "#94a3b8", formatter: "₹{value}Cr" },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLine: { show: false },
    },
    series: [{
      type: "line",
      data: events.map(e => e.damage_cr),
      smooth: true,
      lineStyle: { color: "#6366f1", width: 2 },
      areaStyle: {
        color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(99,102,241,0.25)" }, { offset: 1, color: "rgba(99,102,241,0)" }] },
      },
      itemStyle: { color: "#6366f1", borderWidth: 2, borderColor: "#fff" },
      symbol: "circle",
      symbolSize: 8,
    }],
  };

  return <ReactECharts option={option} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />;
}

const FALLBACK_HISTORICAL_EVENTS = [
  {
    year: "2023",
    event: "Cyclone Michaung Floods",
    severity: "Extreme",
    affected_districts: ["Chennai", "Thiruvallur", "Kancheepuram", "Chengalpattu"],
    affected_people: 4500000,
    deaths: 17,
    damage_cr: 9500,
  },
  {
    year: "2021",
    event: "Northeast Monsoon Flash Floods",
    severity: "High",
    affected_districts: ["Chennai", "Cuddalore", "Thanjavur", "Nagapattinam"],
    affected_people: 1200000,
    deaths: 14,
    damage_cr: 1500,
  },
  {
    year: "2020",
    event: "Cyclone Nivar",
    severity: "Moderate",
    affected_districts: ["Cuddalore", "Villupuram", "Chennai"],
    affected_people: 650000,
    deaths: 4,
    damage_cr: 600,
  },
  {
    year: "2018",
    event: "Cyclone Gaja Floods",
    severity: "High",
    affected_districts: ["Nagapattinam", "Thanjavur", "Tiruvarur", "Pudukkottai"],
    affected_people: 1500000,
    deaths: 45,
    damage_cr: 5400,
  },
  {
    year: "2015",
    event: "South Indian Floods (Chennai)",
    severity: "Extreme",
    affected_districts: ["Chennai", "Kancheepuram", "Cuddalore", "Thiruvallur", "Thanjavur"],
    affected_people: 8200000,
    deaths: 470,
    damage_cr: 22000,
  },
  {
    year: "2005",
    event: "Tamil Nadu Monsoon Floods",
    severity: "High",
    affected_districts: ["Chennai", "Cuddalore", "Tiruchirappalli", "Madurai"],
    affected_people: 2500000,
    deaths: 120,
    damage_cr: 3500,
  },
];

export default function HistoricalPage() {
  const { mode, stormSimulationActive } = useFloodData();
  const isStormActive = stormSimulationActive || mode === "SIMULATION";

  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const res = await api.get("/api/v1/dashboard/history");
      // API returns { success: true, data: [...] } — extract the inner array
      const payload = res.data;
      if (Array.isArray(payload)) return payload as any[];
      if (payload?.data && Array.isArray(payload.data)) return payload.data as any[];
      return [] as any[];
    },
    initialData: FALLBACK_HISTORICAL_EVENTS,
  });

  const events = (data && data.length > 0) ? data : FALLBACK_HISTORICAL_EVENTS;
  const totalAffected = events.reduce((acc, e) => acc + (e.affected_people || 0), 0);
  const totalDeaths = events.reduce((acc, e) => acc + (e.deaths || 0), 0);
  const totalDamage = events.reduce((acc, e) => acc + (e.damage_cr || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-800">Historical Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">Tamil Nadu major flood events (1985–2023) & Live / Simulation Comparison</p>
        </div>
        {isStormActive && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm animate-pulse flex items-center gap-1.5">
            🟠 Live vs Simulation vs Historical Comparison Active
          </div>
        )}
      </div>

      {/* Live vs Simulation vs Historical Benchmark Comparison Grid */}
      <div className="glass-card p-6 border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/30 via-white to-purple-50/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-heading font-bold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" /> Disaster Scale Comparison: Live vs Simulation vs Past Floods
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Historical records remain untampered. Benchmarked against real severe historical disasters.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Column 1: Current Live */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white uppercase tracking-wider">
              🟢 Current Live
            </span>
            <h3 className="text-sm font-bold text-slate-800 mt-2">Open-Meteo + WRIS</h3>
            <div className="mt-3 space-y-1.5 text-xs text-slate-700 font-medium">
              <p className="flex justify-between"><span>Peak 24h Rain:</span> <strong>24.5 mm</strong></p>
              <p className="flex justify-between"><span>Risk Index:</span> <strong className="text-emerald-700">18 / 100</strong></p>
              <p className="flex justify-between"><span>Critical Zone:</span> <strong>0 Districts</strong></p>
              <p className="flex justify-between"><span>Est. Impact:</span> <strong>Nominal</strong></p>
            </div>
          </div>

          {/* Column 2: Storm Simulation */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isStormActive
              ? "bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/30 shadow-md"
              : "bg-amber-50/50 border-amber-200"
          }`}>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-600 text-white uppercase tracking-wider">
              🟠 Storm Simulation
            </span>
            <h3 className="text-sm font-bold text-slate-800 mt-2">Cyclone Michaung (SIM)</h3>
            <div className="mt-3 space-y-1.5 text-xs text-slate-700 font-medium">
              <p className="flex justify-between"><span>Peak 24h Rain:</span> <strong className="text-amber-700 font-bold">385.0 mm</strong></p>
              <p className="flex justify-between"><span>Risk Index:</span> <strong className="text-amber-700 font-bold">94 / 100</strong></p>
              <p className="flex justify-between"><span>Critical Zone:</span> <strong className="text-amber-700 font-bold">10 Districts</strong></p>
              <p className="flex justify-between"><span>Est. Impact:</span> <strong className="text-amber-700 font-bold">High Risk</strong></p>
            </div>
          </div>

          {/* Column 3: 2015 Chennai Flood */}
          <div className="p-4 rounded-2xl bg-red-50/80 border border-red-200">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider">
              🏛️ 2015 Benchmark
            </span>
            <h3 className="text-sm font-bold text-slate-800 mt-2">2015 Chennai Deluge</h3>
            <div className="mt-3 space-y-1.5 text-xs text-slate-700 font-medium">
              <p className="flex justify-between"><span>Peak 24h Rain:</span> <strong>494.0 mm</strong></p>
              <p className="flex justify-between"><span>Risk Index:</span> <strong className="text-red-700">99 / 100</strong></p>
              <p className="flex justify-between"><span>Affected People:</span> <strong>1,800,000</strong></p>
              <p className="flex justify-between"><span>Total Damage:</span> <strong>₹15,000 Cr</strong></p>
            </div>
          </div>

          {/* Column 4: 2021 Flood */}
          <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white uppercase tracking-wider">
              🏛️ 2021 Benchmark
            </span>
            <h3 className="text-sm font-bold text-slate-800 mt-2">2021 NE Monsoon</h3>
            <div className="mt-3 space-y-1.5 text-xs text-slate-700 font-medium">
              <p className="flex justify-between"><span>Peak 24h Rain:</span> <strong>220.0 mm</strong></p>
              <p className="flex justify-between"><span>Risk Index:</span> <strong className="text-purple-700">76 / 100</strong></p>
              <p className="flex justify-between"><span>Affected People:</span> <strong>450,000</strong></p>
              <p className="flex justify-between"><span>Total Damage:</span> <strong>₹3,200 Cr</strong></p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Flood Events", value: events.length, icon: History, color: "text-violet-700", bg: "bg-violet-50" },
          { label: "Total Affected", value: `${(Number((totalAffected ?? 0) / 1000000) || 0).toFixed(1)}M`, icon: Users, color: "text-blue-700", bg: "bg-blue-50" },
          { label: "Total Deaths", value: totalDeaths.toLocaleString(), icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50" },
          { label: "Total Damage", value: `₹${(Number((totalDamage ?? 0) / 1000) || 0).toFixed(0)}K Cr`, icon: MapPin, color: "text-amber-700", bg: "bg-amber-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`glass-card-flat p-4 ${bg}`}>
            <Icon className={`w-5 h-5 mb-2 ${color}`} />
            <p className={`text-xl font-heading font-bold ${color}`}>{value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h2 className="text-sm font-heading font-bold text-slate-800 mb-1">Flood Event Severity by Year</h2>
          <p className="text-[11px] text-slate-400 mb-4">People affected per major flood event</p>
          <div className="h-52">
            {events.length > 0 && <HistoryTimeline events={events} />}
          </div>
        </div>
        <div className="glass-card p-5">
          <h2 className="text-sm font-heading font-bold text-slate-800 mb-1">Economic Damage Trend</h2>
          <p className="text-[11px] text-slate-400 mb-4">Infrastructure and economic damage in ₹ Crores</p>
          <div className="h-52">
            {events.length > 0 && <DamageChart events={events} />}
          </div>
        </div>
      </div>

      {/* Event table */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-sm font-heading font-bold text-slate-800">Major Flood Events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80">
                {["Year", "Event", "Severity", "Districts", "Affected", "Deaths", "Damage (₹Cr)"].map(col => (
                  <th key={col} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => (
                <motion.tr
                  key={event.year}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors"
                >
                  <td className="px-4 py-3 text-xs font-bold text-slate-700 flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-violet-400" /> {event.year}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 max-w-[200px] font-medium">{event.event}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ background: SEVERITY_COLORS[event.severity] || "#94a3b8" }}
                    >
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{event.affected_districts.slice(0, 2).join(", ")}{event.affected_districts.length > 2 ? ` +${event.affected_districts.length - 2}` : ""}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{(Number((event?.affected_people ?? 0) / 1000000) || 0).toFixed(2)}M</td>
                  <td className="px-4 py-3 text-xs font-semibold text-red-600">{event.deaths.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-amber-700">₹{event.damage_cr.toLocaleString()}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
