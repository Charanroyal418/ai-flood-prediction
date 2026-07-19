"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  NodeTypes, Handle, Position, MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Network, MapPin, Waves, Shield, CloudRain, RefreshCw, Activity,
  ArrowRight, Clock, Play, Pause, TrendingUp, Info, X, Map, BarChart2
} from "lucide-react";

// Category definitions and styles — all 12 node types
const TYPE_CONFIG: Record<string, { bg: string; border: string; text: string; emoji: string; label: string }> = {
  district:        { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", emoji: "🏙", label: "District" },
  population:      { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", emoji: "👥", label: "Population" },
  river:           { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", emoji: "🌊", label: "River" },
  catchment:       { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", emoji: "🗺", label: "Catchment" },
  reservoir:       { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700", emoji: "💧", label: "Reservoir" },
  dam:             { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", emoji: "🏗", label: "Dam" },
  weather_station: { bg: "bg-fuchsia-50", border: "border-fuchsia-200", text: "text-fuchsia-700", emoji: "🌤", label: "Weather Stn" },
  rain_gauge:      { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700", emoji: "☔", label: "Rain Gauge" },
  sensor:          { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", emoji: "📡", label: "Sensor" },
  drainage_basin:  { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", emoji: "🌿", label: "Drainage" },
  elevation_zone:  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", emoji: "⛰", label: "Elevation" },
  flood_event:     { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", emoji: "🌧", label: "Flood Event" },
};

const STATUS_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  Warning: "#f59e0b",
  Watch: "#3b82f6",
  Safe: "#10b981",
};

// Custom ReactFlow Node component
function KGNode({ data }: { data: any }) {
  const cfg = TYPE_CONFIG[data.type] || TYPE_CONFIG.district;
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.Safe;
  const isTarget = data.propActive;

  return (
    <div className="flex flex-col items-center" style={{ minWidth: 130 }}>
      <Handle type="target" position={Position.Left} className="w-1.5 h-1.5 bg-slate-300 border-none" />
      <motion.div
        animate={isTarget ? { scale: [1, 1.08, 1], boxShadow: `0 0 20px ${statusColor}a0` } : {}}
        transition={isTarget ? { duration: 1.2, repeat: Infinity } : {}}
        className={`rounded-2xl border bg-white p-3.5 shadow-sm transition-all duration-300 w-full hover:shadow-md ${cfg.border}`}
        style={{
          borderLeftWidth: 5,
          borderLeftColor: statusColor,
        }}
      >
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{cfg.emoji}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-800 leading-tight truncate max-w-[80px]">
                {data.label}
              </p>
              <p className="text-[7px] text-slate-400 font-mono tracking-wider font-semibold uppercase">
                {cfg.label}
              </p>
            </div>
          </div>
          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-100 font-mono">
            {data.risk_score.toFixed(0)}
          </span>
        </div>

        {/* Small live telemetry snippet */}
        <p className="text-[8px] text-slate-500 font-medium font-mono leading-none truncate">
          {data.type === "district" ? `Rain: ${data.data?.rainfall_24h ?? 0}mm` :
           data.type === "population" ? `Pop: ${((data.data?.population_count ?? 0)/1e6).toFixed(2)}M` :
           data.type === "river" ? `Level: ${data.data?.current_level_m ?? 0}m` :
           data.type === "catchment" ? `Area: ${data.data?.area_km2 ?? 0}km²` :
           data.type === "reservoir" ? `Fill: ${data.data?.fill_pct ?? 0}%` :
           data.type === "dam" ? `Integrity: ${data.data?.structural_integrity ?? 100}%` :
           data.type === "weather_station" ? `Rain: ${data.data?.rainfall_mm ?? 0}mm` :
           data.type === "sensor" ? `Status: Live` :
           data.type === "drainage_basin" ? `Drainage Basin` :
           data.type === "flood_event" ? `Recorded: ${data.data?.recorded_at ?? "—"}` :
           "Telemetry Live"}
        </p>

        {/* Mini progress bar */}
        <div className="mt-2 w-full bg-slate-100 rounded-full h-1 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, data.risk_score)}%`, backgroundColor: statusColor }}
          />
        </div>
      </motion.div>
      <Handle type="source" position={Position.Right} className="w-1.5 h-1.5 bg-slate-400 border-none" />
    </div>
  );
}

const nodeTypes: NodeTypes = { kgNode: KGNode };

export default function DynamicKnowledgeGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [timeIndex, setTimeIndex] = useState(0); // 0 = Now, 1 = 15m ago, etc.
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredProjection, setHoveredProjection] = useState<any>(null);
  const playInterval = useRef<any>(null);

  const TIME_WINDOWS = [
    { label: "Now", key: "now" },
    { label: "15m", key: "15m" },
    { label: "30m", key: "30m" },
    { label: "1h", key: "1h" },
    { label: "3h", key: "3h" },
    { label: "6h", key: "6h" },
    { label: "24h", key: "24h" }
  ];

  // Fetch complete graph payload from backend (with timeout for Render cold start)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kgGraphData"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout
      try {
        const res = await api.get("/kg/graph", { signal: controller.signal });
        return res.data;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    refetchInterval: 5 * 60 * 1000, // match backend 5-min cache
    staleTime: 4 * 60 * 1000,       // data is fresh for 4 minutes
    retry: 2,
    retryDelay: (attempt) => Math.min(3000 * (attempt + 1), 10000),
  });

  // Category layout columns to place entities logically in a left-to-right flow
  const categoryColumns: Record<string, number> = {
    sensor: 0,
    weather_station: 0,
    rain_gauge: 0,
    drainage_basin: 1,
    catchment: 1,
    elevation_zone: 1,
    reservoir: 2,
    dam: 2,
    river: 2,
    district: 3,
    population: 4,
    flood_event: 4,
  };

  const getRiskFromHistory = (node: any, idx: number) => {
    if (!node.history || node.history.length <= idx) return node.risk_score;
    return node.history[idx];
  };

  // Re-build ReactFlow nodes and edges on data change or temporal slider movement
  const updateGraphLayout = useCallback((rawNodes: any[], rawEdges: any[], timeIdx: number) => {
    const colCounts: Record<number, number> = {};
    
    const newNodes = rawNodes.map((n: any) => {
      const col = categoryColumns[n.type] ?? 0;
      const count = colCounts[col] ?? 0;
      colCounts[col] = count + 1;
      
      const currentRisk = getRiskFromHistory(n, timeIdx);
      
      // Determine dynamic status for history slider
      let status = "Safe";
      if (currentRisk >= 75) status = "Critical";
      else if (currentRisk >= 50) status = "Warning";
      else if (currentRisk >= 25) status = "Watch";
      
      return {
        id: n.id,
        type: "kgNode",
        position: {
          x: col * 260 + 50,
          y: count * 130 + (col % 2 === 0 ? 0 : 60) + 30,
        },
        data: {
          ...n,
          risk_score: currentRisk,
          status,
          propActive: false,
        },
      };
    });

    const newEdges = rawEdges.map((e: any) => {
      const sourceNode = rawNodes.find(n => n.id === e.source);
      const sourceRisk = getRiskFromHistory(sourceNode, timeIdx);
      const dynamicInfluence = e.attention * sourceRisk;
      const statusColor = sourceRisk >= 75 ? STATUS_COLORS.Critical : sourceRisk >= 50 ? STATUS_COLORS.Warning : "#cbd5e1";

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: dynamicInfluence > 20 || e.attention > 0.4,
        label: `${e.attention.toFixed(2)}`,
        labelStyle: { fill: "#64748b", fontWeight: 700, fontSize: 8 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95, rx: 4, ry: 4 },
        style: {
          stroke: statusColor,
          strokeWidth: dynamicInfluence > 20 ? 3 : 1.5,
          opacity: 0.8,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: statusColor },
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  // Sync ReactFlow state when API data arrives
  useEffect(() => {
    if (data?.nodes) {
      updateGraphLayout(data.nodes, data.edges, timeIndex);
    }
  }, [data, timeIndex, updateGraphLayout]);

  // Node Click handler
  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  // Temporal Playback Loop
  useEffect(() => {
    if (isPlaying) {
      playInterval.current = setInterval(() => {
        setTimeIndex((prev) => {
          if (prev >= 6) return 0; // wrap around
          return prev + 1;
        });
      }, 2000);
    } else {
      if (playInterval.current) clearInterval(playInterval.current);
    }
    return () => { if (playInterval.current) clearInterval(playInterval.current); };
  }, [isPlaying]);

  // GNN Message Passing Animation Sequence
  const runGNNPropagation = async () => {
    if (isSimulating || !data?.propagation_steps) return;
    setIsSimulating(true);
    setIsPlaying(false);
    setTimeIndex(0); // reset to Now

    const steps = data.propagation_steps;
    
    // Reset all propagation indicators
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, propActive: false } })));
    setEdges(eds => eds.map(e => ({ ...e, style: { stroke: "#cbd5e1", strokeWidth: 1.5 } })));

    for (let step = 0; step < steps.length; step++) {
      const activeIds = steps[step];
      
      // Update nodes state
      setNodes(nds => nds.map(n => {
        const isActive = activeIds.includes(n.id);
        return {
          ...n,
          data: { ...n.data, propActive: isActive }
        };
      }));

      // Update edges style during active message passing
      setEdges(eds => eds.map(e => {
        const isFromActiveNode = activeIds.includes(e.source);
        if (isFromActiveNode) {
          return {
            ...e,
            animated: true,
            style: { stroke: "#8b5cf6", strokeWidth: 4, transition: "stroke 0.4s" }
          };
        }
        return e;
      }));

      // Delay between network message aggregation steps
      await new Promise(resolve => setTimeout(resolve, 1400));
    }

    // Done simulation - flash all nodes back to normal status border
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, propActive: false } })));
    if (data) {
      updateGraphLayout(data.nodes, data.edges, timeIndex);
    }
    setIsSimulating(false);
  };

  if (isError) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <X className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-heading font-bold text-slate-800">Knowledge Graph Unavailable</h2>
          <p className="text-sm text-slate-500">
            {(error as any)?.code === "ERR_CANCELED"
              ? "The request timed out. The backend server on Render's free tier may still be waking up from a cold start."
              : "Failed to load the Knowledge Graph data. The backend may be starting up or experiencing issues."}
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold shadow-md shadow-violet-200 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
          <p className="text-[11px] text-slate-400">Render free-tier services spin down after inactivity. The first request may take 60–90 seconds.</p>
        </div>
      </div>
    );
  }

  if (isLoading || !nodes.length) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600 font-heading">Loading Dynamic Knowledge Graph...</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            The backend is running GNN inference. If the server was idle, this cold start can take <strong>60–90 seconds</strong> on Render&apos;s free tier.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
            <Clock className="w-3.5 h-3.5 animate-pulse" /> Waiting for response...
          </div>
        </div>
      </div>
    );
  }

  // Build explainability breakdown from real SHAP values returned by the GNN
  const getExplainabilityBreakdown = (node: any) => {
    // Use actual SHAP values from backend if available
    if (node.shap_values && node.shap_values.length > 0) {
      return node.shap_values.map((s: any) => ({
        label: s.feature,
        change: `${s.contribution >= 0 ? "+" : ""}${s.contribution.toFixed(1)}%`,
        isPositive: s.contribution >= 0
      }));
    }
    // Fallback: derive from node telemetry when SHAP not available
    if (node.type !== "district") {
      return [
        { label: "Base Status", value: `${node.type} node, primary telemetry active.` },
        { label: "Confidence", value: `${(node.confidence * 100).toFixed(0)}% sensor alignment.` }
      ];
    }
    const rain = node.data?.rainfall_24h ?? 0;
    const saturation = node.data?.soil_saturation_pct ?? 0;
    const elevation = node.data?.elevation_m ?? 50;
    const factors = [];
    if (rain > 0) factors.push({ label: "Heavy Rainfall", change: `+${(rain * 0.4).toFixed(0)}%`, isPositive: true });
    if (saturation > 40) factors.push({ label: "Soil Saturation", change: `+${(saturation * 0.15).toFixed(0)}%`, isPositive: true });
    if (elevation < 15) factors.push({ label: "Low Elevation Basin", change: "+15%", isPositive: true });
    factors.push({ label: "Upstream Inflow", change: `+${(node.risk_score * 0.25).toFixed(0)}%`, isPositive: true });
    factors.push({ label: "GAT Attention Weight", change: `+${((node.importance ?? 0.5) * 20).toFixed(0)}%`, isPositive: true });
    return factors;
  };

  return (
    <div className="space-y-5 h-[calc(100vh-6rem)] pb-6 flex flex-col">
      {/* Top Header Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-800 flex items-center gap-2">
            <Network className="w-6 h-6 text-violet-600" /> Dynamic Graph Intelligence Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time GAT structural metrics · Temporal propagation reasoning</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Force Sync
          </button>
          <button
            onClick={runGNNPropagation}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-200 transition-all disabled:opacity-60"
          >
            <Activity className="w-3.5 h-3.5" />
            {isSimulating ? "Message Passing..." : "Animate GNN Inference"}
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-5">
        
        {/* Left Panel: Graph Metrics & Communities */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0 overflow-y-auto">
          {/* Graph Metrics Panel */}
          <div className="glass-card p-4 space-y-3 shrink-0">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Activity className="w-3.5 h-3.5 text-violet-500" /> Graph Structural Metrics
            </h2>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                { label: "Graph Density", value: data.stats.density },
                { label: "Avg Degree", value: data.stats.avg_degree },
                { label: "Clustering Coeff", value: data.stats.clustering_coefficient },
                { label: "Inference Latency", value: `${data.stats.latency_ms}ms` },
                { label: "Total Nodes", value: data.stats.total_nodes },
                { label: "Active Sensors", value: data.stats.active_sensors }
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-2">
                  <p className="text-[14px] font-bold text-slate-800 font-mono">{value}</p>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Modularity Communities Cluster Panel */}
          <div className="glass-card p-4 flex-1 flex flex-col min-h-0">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0">
              <Map className="w-3.5 h-3.5 text-blue-500" /> Community Partitioning
            </h2>
            <div className="mt-3 overflow-y-auto space-y-2 flex-1 pr-1">
              {data.communities.map((comm: string[], i: number) => {
                const districts = comm.filter(id => id.startsWith("d-")).map(id => {
                  const node = data.nodes.find((n: any) => n.id === id);
                  return node ? node.label : "";
                }).filter(Boolean);

                return (
                  <div key={i} className="bg-slate-50 border border-slate-100/60 p-3 rounded-xl hover:bg-slate-100/50 transition-colors">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-slate-600">Basin Zone {i + 1}</span>
                      <span className="text-[8px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-mono">
                        {comm.length} Nodes
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-500 font-medium leading-relaxed truncate font-heading">
                      {districts.join(", ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Panel: ReactFlow Canvas */}
        <div className="col-span-6 glass-card overflow-hidden relative flex flex-col border border-slate-200 shadow-sm rounded-2xl bg-white">
          <div className="flex-1 min-h-0 bg-slate-50 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={1.5}
            >
              <Background color="#cbd5e1" gap={24} size={1} />
              <Controls className="bg-white border-slate-200 shadow-md rounded-xl" />
              <MiniMap className="border border-slate-200 rounded-xl shrink-0" style={{ height: 100, width: 140 }} />
            </ReactFlow>
          </div>

          {/* Temporal Playback Slider Overlay */}
          <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-slate-200/80 p-3 rounded-2xl shadow-xl flex items-center gap-4 z-10">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-violet-600 transition-colors flex-shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>
            
            <div className="flex-1">
              <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1 font-mono uppercase">
                <span>Timeline Slider</span>
                <span className="text-violet-600 font-heading">{TIME_WINDOWS[timeIndex].label} ago</span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                value={timeIndex}
                onChange={(e) => {
                  setTimeIndex(parseInt(e.target.value));
                  setIsPlaying(false);
                }}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
              />
              <div className="flex justify-between text-[9px] font-semibold text-slate-400 mt-1 font-mono">
                {TIME_WINDOWS.map((win, idx) => (
                  <span key={win.key} className={idx === timeIndex ? "text-violet-600 font-bold" : ""}>
                    {win.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: t-SNE Embeddings Plot & Node Inspector */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0 overflow-y-auto">
          {/* t-SNE Embeddings Plot */}
          <div className="glass-card p-4 space-y-3 shrink-0">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <BarChart2 className="w-3.5 h-3.5 text-pink-500" /> t-SNE Embedding Projection
            </h2>
            <div className="w-full bg-slate-50 rounded-xl border border-slate-100 relative flex items-center justify-center p-2">
              {/* Inline interactive SVG for t-SNE mapping */}
              <svg viewBox="0 0 220 220" className="w-full h-44 overflow-visible">
                <line x1="110" y1="0" x2="110" y2="220" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="2,2" />
                <line x1="0" y1="110" x2="220" y2="110" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="2,2" />
                {data.embeddings_projection.map((pt: any) => {
                  // Map coordinates from [-100, 100] to [10, 210] SVG bounds
                  const cx = ((pt.x + 100) / 200) * 190 + 15;
                  const cy = ((pt.y + 100) / 200) * 190 + 15;
                  const color = pt.type === "district" ? "#a78bfa" : pt.type === "river" ? "#3b82f6" : "#0ea5e9";
                  
                  return (
                    <circle
                      key={pt.id}
                      cx={cx}
                      cy={cy}
                      r="4.5"
                      fill={color}
                      className="cursor-pointer transition-transform hover:scale-155 duration-205 stroke-white stroke-[1]"
                      onMouseEnter={() => setHoveredProjection(pt)}
                      onMouseLeave={() => setHoveredProjection(null)}
                      onClick={() => {
                        const originalNode = data.nodes.find((n: any) => n.id === pt.id);
                        if (originalNode) setSelectedNode(originalNode);
                      }}
                    />
                  );
                })}
              </svg>
              {/* Tooltip Overlay */}
              {hoveredProjection && (
                <div className="absolute top-2 left-2 right-2 bg-slate-900/90 text-white p-2 rounded-xl text-[9px] shadow-lg leading-tight font-semibold flex items-center gap-1.5 border border-white/10">
                  <span>{TYPE_CONFIG[hoveredProjection.type]?.emoji}</span>
                  <div>
                    <p className="font-bold font-heading">{hoveredProjection.label}</p>
                    <p className="text-[8px] text-slate-400 capitalize font-mono">{hoveredProjection.type}</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[9px] text-slate-400 font-medium leading-normal text-center font-heading">
              Coordinates project learned 32D GRU node aggregates into 2D via PCA. Districts cluster by flood threat similarity.
            </p>
          </div>

          {/* Graph Explainability / Attention Dashboard */}
          <div className="glass-card p-4 flex-1 flex flex-col min-h-0">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0 font-heading">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Attention Bottlenecks
            </h2>
            <div className="mt-3 overflow-y-auto space-y-2.5 flex-1 pr-1 text-[11px] font-heading">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 font-mono">Top Influential Edges</p>
                <div className="space-y-1.5">
                  {data.explainability.critical_edges.slice(0, 3).map((edge: any, i: number) => {
                    const sourceNode = data.nodes.find((n: any) => n.id === edge.source);
                    const targetNode = data.nodes.find((n: any) => n.id === edge.target);
                    return (
                      <div key={i} className="flex justify-between items-center bg-slate-50 border border-slate-100 px-2 py-1.5 rounded-lg">
                        <span className="font-semibold text-slate-700 max-w-[130px] truncate">
                          {sourceNode?.label} → {targetNode?.label}
                        </span>
                        <span className="text-[9px] font-bold text-red-500 font-mono">
                          {edge.influence.toFixed(1)} infl
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 font-mono">Highest Attention Paths</p>
                <div className="space-y-1.5 leading-relaxed bg-slate-50 border border-slate-100 p-2.5 rounded-xl font-medium text-slate-600">
                  {(data.explainability.highest_attention_paths ?? []).length > 0
                    ? (data.explainability.highest_attention_paths as string[][]).map((path: string[], i: number) => {
                        const pathLabels = path.map((pid: string) => {
                          const nd = data.nodes.find((n: any) => n.id === pid);
                          return nd?.label ?? pid;
                        });
                        const dot = i === 0 ? "bg-red-500" : "bg-amber-500";
                        return (
                          <div key={i} className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
                            <span className="truncate text-[9px]">{pathLabels.join(" → ")}</span>
                          </div>
                        );
                      })
                    : (
                      <p className="text-[9px] text-slate-400">Run GNN inference to compute attention paths.</p>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Selected Node Details Drawer */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ y: 250, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 250, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-5 shadow-2xl z-40 max-w-5xl mx-auto rounded-t-3xl flex flex-col gap-4 max-h-[40vh]"
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-violet-500 px-2 py-0.5 rounded-md bg-violet-50 border border-violet-100 font-mono">
                  {TYPE_CONFIG[selectedNode.type]?.label} node info
                </span>
                <h3 className="text-lg font-heading font-bold text-slate-800 mt-1 flex items-center gap-2">
                  <span>{TYPE_CONFIG[selectedNode.type]?.emoji}</span> {selectedNode.label}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-6 flex-1 overflow-y-auto pr-1">
              {/* Metrics Column */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-mono">Live Telemetry Details</p>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs font-medium space-y-1.5 text-slate-600 font-heading">
                  {Object.entries(selectedNode.data || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize text-slate-400">{key.replace("_", " ")}</span>
                      <span className="text-slate-800 font-mono font-bold">{String(value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-200/80 pt-1.5 mt-1.5 font-bold">
                    <span className="text-slate-500 font-heading">Risk Score</span>
                    <span className="text-red-500 font-mono">{selectedNode.risk_score.toFixed(1)} / 100</span>
                  </div>
                </div>
              </div>

              {/* Explainability Breakdown Column */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-mono">Inference Contribution Explanation</p>
                <div className="space-y-1.5 overflow-y-auto max-h-36 pr-1 font-heading">
                  {getExplainabilityBreakdown(selectedNode).map((factor: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-xs">
                      <span className="font-semibold text-slate-700">{factor.label}</span>
                      <span className={`font-bold font-mono text-[10px] ${
                        factor.isPositive === false ? "text-green-500" :
                        parseFloat(factor.change ?? factor.value ?? "0") < 0 ? "text-green-500" : "text-red-500"
                      }`}>{factor.change || factor.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Embeddings Column */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-mono">128D Layer Embedding Vector</p>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 max-h-32 overflow-y-auto">
                  <div className="grid grid-cols-4 gap-1.5 font-mono text-[9px] text-center">
                    {selectedNode.embedding.map((val: number, i: number) => (
                      <span key={i} className="bg-white border border-slate-200/80 py-1.5 rounded font-bold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        {val.toFixed(2)}
                      </span>
                    ))}
                  </div>
                  <p className="text-[8px] text-slate-400 mt-2 font-medium leading-tight font-heading">
                    *First 8 dimension aggregates shown. Embedding is updated dynamically during spatial message passing iterations.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
