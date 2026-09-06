"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Bell, Shield, Clock, MapPin, Brain, ChevronDown, RefreshCw, Activity, CheckCircle, ArrowUpRight } from "lucide-react";
import { useFloodData } from "@/context/FloodDataContext";

const LEVEL_CONFIG: Record<string, { badge: string; text: string; icon: React.ReactNode }> = {
  Critical: { badge: "risk-badge-severe", text: "text-risk-severe", icon: <AlertTriangle className="w-5 h-5 text-risk-severe" /> },
  Warning:  { badge: "risk-badge-high", text: "text-risk-high", icon: <AlertTriangle className="w-5 h-5 text-risk-high" /> },
  Watch:    { badge: "risk-badge-low", text: "text-risk-low", icon: <Brain className="w-5 h-5 text-risk-low" /> },
};

const CANONICAL_DISTRICTS: Record<string, string> = {
  naaaoattinam: "Nagapattinam",
  naoattinam: "Nagapattinam",
  nagapatnam: "Nagapattinam",
  kanchipuram: "Kancheepuram",
  viluppuram: "Villupuram",
  tirupathur: "Tirupattur",
  tiruvallur: "Thiruvallur",
  nilgiris: "The Nilgiris",
};

const sanitizeDistrictName = (name: string): string => {
  if (!name) return "";
  const clean = name.trim();
  return CANONICAL_DISTRICTS[clean.toLowerCase()] || clean;
};

const sanitizeAlertMessage = (msg: string): string => {
  if (!msg) return "";
  return msg.replace(/Naaaoattinam/gi, "Nagapattinam")
            .replace(/Naoattinam/gi, "Nagapattinam");
};

function AlertCard({ alert }: { alert: any }) {
  const { mode, stormSimulationActive } = useFloodData();
  const isStormActive = stormSimulationActive || mode === "SIMULATION";
  const [expanded, setExpanded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  
  const cfg = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.Watch;

  return (
    <div className={`bg-paper-100 border rounded-lg overflow-hidden transition-all ${acknowledged ? 'opacity-60 border-line' : isStormActive ? 'border-risk-high' : 'border-line'} ${expanded ? 'shadow-card' : ''}`}>
      <div 
        className="w-full p-4 text-left cursor-pointer hover:bg-line/20 flex gap-4 items-start"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0 mt-1">
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <div className="flex gap-2 items-center">
              <span className={`risk-badge ${isStormActive ? 'risk-badge-high' : cfg.badge}`}>
                {isStormActive ? "SIMULATED ALERT" : `${alert.level.toUpperCase()} ALERT`}
              </span>
              <span className="text-[10px] text-text-secondary font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(alert.created_at || Date.now()).toLocaleTimeString("en-US", { hour12: false })}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
          <p className={`text-sm font-semibold mb-1 ${acknowledged ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
            {sanitizeAlertMessage(alert.message)}
          </p>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-text-secondary font-mono flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {sanitizeDistrictName(alert.district || "Statewide")}
            </span>
            <span className="text-[10px] text-text-secondary font-mono flex items-center gap-1">
              <Brain className="w-3 h-3" /> {(Number(alert?.confidence ?? 0.94) * 100).toFixed(1)}% CONFIDENCE
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-line/50 bg-paper-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Rainfall (24h)</p>
              <p className="text-sm font-mono font-bold text-text-primary">{alert.rainfall_mm != null ? `${alert.rainfall_mm} mm` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Model Conf</p>
              <p className="text-sm font-mono font-bold text-text-primary">{(Number(alert?.confidence ?? 0.94) * 100).toFixed(1)}%</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Recommended Action</p>
              <p className="text-xs font-semibold text-text-primary">{alert.suggested_response || "Evacuate low-lying zones immediately."}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); setAcknowledged(!acknowledged); }}
              className="btn-secondary"
            >
              <CheckCircle className="w-4 h-4" /> {acknowledged ? "Unacknowledge" : "Acknowledge"}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); }}
              className="btn-primary !bg-risk-severe hover:!bg-red-800"
            >
              <ArrowUpRight className="w-4 h-4" /> Escalate to EOC
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlertCenterPage() {
  const [filterLevel, setFilterLevel] = useState("all");
  const { alerts: wsAlerts, alertStatus, requestSnapshot } = useFloodData();

  const alerts = wsAlerts || [];
  
  // Sort by severity (Critical > Warning > Watch)
  const severityScore = (level: string) => {
    if (level === 'Critical') return 3;
    if (level === 'Warning') return 2;
    return 1;
  };
  
  const sortedAlerts = [...alerts].sort((a, b) => severityScore(b.level) - severityScore(a.level));
  const filtered = filterLevel === "all" ? sortedAlerts : sortedAlerts.filter(a => a.level === filterLevel);
  
  const critical = alerts.filter(a => a.level === "Critical" || a.severity === "Red").length;
  const warning = alerts.filter(a => a.level === "Warning" || a.severity === "Orange").length;

  return (
    <div className="flex flex-col gap-4">
      {/* ── HEADER ACTION STRIP ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl text-text-primary">Alert Center</h1>
          <p className="text-xs text-text-secondary mt-1">GDNN-generated early warnings & dispatches</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-xs text-text-secondary">
            <div className={`w-2 h-2 rounded-full ${alertStatus === 'connected' ? 'bg-signal-500' : 'bg-risk-moderate'}`} />
            <span>{alertStatus === 'connected' ? `LINK SECURE · ${alerts.length} ALERTS` : 'CONNECTING...'}</span>
          </div>
          <button onClick={() => requestSnapshot()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Sync
          </button>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="metric-card !h-auto">
          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Critical Alerts</p>
          <p className="text-3xl font-mono font-bold text-risk-severe">{critical}</p>
        </div>
        <div className="metric-card !h-auto">
          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Warnings</p>
          <p className="text-3xl font-mono font-bold text-risk-high">{warning}</p>
        </div>
        <div className="metric-card !h-auto">
          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Safe Nodes</p>
          <p className="text-3xl font-mono font-bold text-risk-low">{38 - (critical + warning)}</p>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="flex gap-2">
        {["all", "Critical", "Warning", "Watch"].map(level => (
          <button
            key={level}
            onClick={() => setFilterLevel(level)}
            className={`px-4 py-1.5 rounded text-xs font-semibold font-mono transition-colors border ${
              filterLevel === level
                ? level === "Critical" ? "bg-risk-severe text-white border-risk-severe" : level === "Warning" ? "bg-risk-high text-white border-risk-high" : level === "Watch" ? "bg-risk-low text-white border-risk-low" : "bg-paper-100 text-text-primary border-line"
                : "bg-paper-100 text-text-secondary border-line hover:bg-line/30"
            }`}
          >
            {level === "all" ? "ALL_ALERTS" : level.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── ALERTS LIST ── */}
      <div className="flex flex-col gap-2">
        {alertStatus === "connecting" && alerts.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-paper-100 border border-line rounded-lg p-12 text-center flex flex-col items-center">
            <Shield className="w-12 h-12 text-risk-low mb-4" />
            <h2 className="text-lg font-bold text-text-primary mb-1">All Clear</h2>
            <p className="text-sm text-text-secondary">No active alerts matching criteria. GDNN monitoring continues.</p>
          </div>
        ) : (
          filtered.map((alert) => <AlertCard key={alert.district_id + '-' + alert.created_at} alert={alert} />)
        )}
      </div>
    </div>
  );
}
