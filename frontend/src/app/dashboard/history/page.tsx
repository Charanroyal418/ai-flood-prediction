"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
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
        return d ? `<div style="font-family:Inter;padding:4px"><b>${d.year} — ${d.event}</b><br/>Affected: ${d.affected_people.toLocaleString()}<br/>Deaths: ${d.deaths}<br/>Damage: ₹${d.damage_cr} Cr</div>` : "";
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
      formatter: (p: any) => `<div style="font-family:Inter"><b>${events[p.dataIndex]?.year}</b><br/>₹${p.value} Crores</div>`,
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

export default function HistoricalIntelligencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const res = await api.get("/dashboard/history");
      return res.data as any[];
    },
  });

  const events = data || [];
  const totalDeaths = events.reduce((a, e) => a + e.deaths, 0);
  const totalAffected = events.reduce((a, e) => a + e.affected_people, 0);
  const totalDamage = events.reduce((a, e) => a + e.damage_cr, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-800">Historical Intelligence</h1>
        <p className="text-sm text-slate-500 mt-1">Tamil Nadu major flood events · 1985–2023 · Used to train GDNN model</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Flood Events", value: events.length, icon: History, color: "text-violet-700", bg: "bg-violet-50" },
          { label: "Total Affected", value: `${(totalAffected / 1000000).toFixed(1)}M`, icon: Users, color: "text-blue-700", bg: "bg-blue-50" },
          { label: "Total Deaths", value: totalDeaths.toLocaleString(), icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50" },
          { label: "Total Damage", value: `₹${(totalDamage / 1000).toFixed(0)}K Cr`, icon: MapPin, color: "text-amber-700", bg: "bg-amber-50" },
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
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{(event.affected_people / 1000000).toFixed(2)}M</td>
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
