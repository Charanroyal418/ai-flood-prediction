"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Waves, Droplets, MapPin, Activity, AlertTriangle, Info, Wind } from "lucide-react";
import dynamicImport from "next/dynamic";
const ReactECharts = dynamicImport(() => import("echarts-for-react"), { ssr: false });

export default function DistrictDrilldown() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["district", id],
    queryFn: async () => {
      const res = await api.get(`/district/${id}`);
      return res.data;
    },
  });

  // Supabase Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('district_predictions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'district_predictions', filter: `district_id=eq.${id}` },
        (payload: any) => {
          console.log('Realtime update received:', payload);
          // Invalidate and refetch automatically
          queryClient.invalidateQueries({ queryKey: ["district", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (isLoading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ECharts Configurations
  const trendOptions = {
    tooltip: { trigger: "axis" },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.history.map((h: any) => new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    },
    yAxis: { type: 'value', max: 100 },
    series: [
      {
        name: 'Risk Score',
        type: 'line',
        smooth: true,
        data: data.history.map((h: any) => h.risk_score),
        itemStyle: { color: data.risk_color },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: data.risk_color }, { offset: 1, color: 'rgba(255,255,255,0)' }]
          }
        }
      }
    ]
  };

  const featureOptions = {
    tooltip: { trigger: "item" },
    series: [
      {
        name: 'Feature Impact',
        type: 'pie',
        radius: ['40%', '70%'],
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: (data.shap_values || []).map((f: any) => ({
          value: f.value * 100,
          name: f.label,
          itemStyle: { color: f.color }
        }))
      }
    ]
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold text-slate-800">{data.name}</h1>
            <span className="text-xs font-bold px-3 py-1 rounded-full text-white shadow-sm" style={{ background: data.risk_color }}>
              {data.risk_level} Risk
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">District Drill-Down & AI Explanations</p>
        </div>
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Current Risk Score", value: `${data.risk_score}/100`, icon: Activity, color: data.risk_color },
          { label: "Rainfall (24h)", value: `${data.rainfall_mm} mm`, icon: Droplets, color: "#6366f1" },
          { label: "River Level", value: `${data.river_level_m}m`, icon: Waves, color: "#0ea5e9" },
          { label: "Vulnerable Pop", value: `${(data.demographics.vulnerable_population/1000).toFixed(1)}k`, icon: AlertTriangle, color: "#f59e0b" },
        ].map((kpi, i) => (
          <div key={i} className="glass-card p-5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500" style={{ background: kpi.color }} />
            <kpi.icon className="w-5 h-5 mb-3" style={{ color: kpi.color }} />
            <p className="text-2xl font-heading font-bold text-slate-800">{kpi.value}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Trend */}
        <div className="lg:col-span-2 glass-card p-5">
          <h2 className="text-sm font-heading font-bold text-slate-800 mb-4">Risk Trend (Last 24h)</h2>
          <div className="h-[280px]">
            <ReactECharts option={trendOptions} style={{ height: "100%", width: "100%" }} />
          </div>
        </div>

        {/* Feature Importance */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-heading font-bold text-slate-800 mb-4">AI Feature Importance</h2>
          <div className="h-[180px]">
            <ReactECharts option={featureOptions} style={{ height: "100%", width: "100%" }} />
          </div>
          <div className="space-y-2 mt-4">
            {(data.shap_values || []).map((f: any) => (
              <div key={f.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }} />
                  <span className="text-xs text-slate-600 font-medium">{f.label}</span>
                </div>
                <span className="text-xs font-bold text-slate-800">{(f.value * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Historical Floods & Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h2 className="text-sm font-heading font-bold text-slate-800 mb-4">Historical Flood Events</h2>
          <div className="space-y-3">
            {data.historical_floods.map((h: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-800">{h.year} - {h.event}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Est. Damage: ₹{h.damage_cr} Cr</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${h.severity === 'Extreme' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                  {h.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="glass-card p-5">
          <h2 className="text-sm font-heading font-bold text-slate-800 mb-4">Demographics & Infrastructure</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Population", value: data.demographics.population.toLocaleString() },
              { label: "Area", value: `${data.demographics.area_km2} km²` },
              { label: "Density", value: `${data.demographics.density}/km²` },
              { label: "Active Shelters", value: data.demographics.shelters_available },
            ].map((d, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{d.label}</p>
                <p className="text-sm font-bold text-slate-700 mt-1">{d.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
