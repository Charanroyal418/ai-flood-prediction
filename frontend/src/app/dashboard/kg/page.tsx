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
  ArrowRight, Clock, Play, Pause, TrendingUp, Info, X, Map, BarChart2, Eye, EyeOff
} from "lucide-react";
import * as d3 from "d3-force";

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

const COMMUNITY_COLORS = [
  "#818cf8", "#f472b6", "#34d399", "#fbbf24", "#fb923c", "#f87171", "#c084fc", "#38bdf8"
];

// Custom ReactFlow Node component
function KGNode({ data }: { data: any }) {
  const cfg = TYPE_CONFIG[data.type] || TYPE_CONFIG.district;
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.Safe;
  const isTarget = data.propActive;
  const communityColor = data.communityColor || cfg.bg;

  return (
    <div className="flex flex-col items-center" style={{ minWidth: 130 }}>
      <Handle type="target" position={Position.Left} className="w-1.5 h-1.5 bg-slate-300 border-none" />
      <motion.div
        animate={isTarget ? { scale: [1, 1.08, 1], boxShadow: `0 0 20px ${statusColor}a0` } : {}}
        transition={isTarget ? { duration: 1.2, repeat: Infinity } : {}}
        className={`rounded-2xl bg-white p-3.5 shadow-sm transition-all duration-300 w-full hover:shadow-md ${cfg.border}`}
        style={{
          borderStyle: 'solid',
          borderWidth: data.risk_score >= 75 ? 3 : data.risk_score >= 50 ? 2 : 1,
          borderColor: data.risk_score >= 75 ? statusColor : undefined,
          borderLeftWidth: 5,
          borderLeftColor: statusColor,
          backgroundColor: data.communityColor ? `${data.communityColor}20` : 'white',
          transform: `scale(${1 + (data.risk_score / 100) * 0.15})`
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
  const [timeIndex, setTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAllEdges, setShowAllEdges] = useState(false);
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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kgGraphData"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      try {
        const res = await api.get("/kg/graph", { signal: controller.signal });
        return res.data;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(3000 * (attempt + 1), 10000),
  });

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

  const updateGraphLayout = useCallback((rawNodes: any[], rawEdges: any[], timeIdx: number) => {
    // Create a map of nodeId -> communityIndex for color coding
    const communityMap: Record<string, number> = {};
    if (data?.communities) {
      data.communities.forEach((comm: string[], i: number) => {
        comm.forEach(id => { communityMap[id] = i; });
      });
    }

    const newNodes = rawNodes.map((n: any) => {
      const currentRisk = getRiskFromHistory(n, timeIdx);
      let status = "Safe";
      if (currentRisk >= 75) status = "Critical";
      else if (currentRisk >= 50) status = "Warning";
      else if (currentRisk >= 25) status = "Watch";
      
      const commIdx = communityMap[n.id];
      const communityColor = commIdx !== undefined ? COMMUNITY_COLORS[commIdx % COMMUNITY_COLORS.length] : undefined;
      
      return {
        id: n.id,
        type: "kgNode",
        x: 0, // for d3
        y: 0, // for d3
        data: {
          ...n,
          risk_score: currentRisk,
          status,
          propActive: false,
          communityColor,
          communityIdx: commIdx ?? 0
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
        // metadata for thresholding
        dynamicInfluence,
        attention: e.attention
      };
    });

    // Run static D3 force simulation
    const simulation = d3.forceSimulation(newNodes)
      .force("charge", d3.forceManyBody().strength(-800))
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX((d: any) => {
        const idx = d.data.communityIdx;
        const angle = (idx / 8) * Math.PI * 2;
        return Math.cos(angle) * 600;
      }).strength(0.3))
      .force("y", d3.forceY((d: any) => {
        const idx = d.data.communityIdx;
        const angle = (idx / 8) * Math.PI * 2;
        return Math.sin(angle) * 600;
      }).strength(0.3))
      .force("link", d3.forceLink(newEdges).id((d: any) => d.id).distance(150).strength(0.1))
      .stop();

    // Fast-forward simulation
    simulation.tick(300);

    const finalNodes = newNodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      position: { x: n.x, y: n.y },
      data: n.data
    }));

    // Generate community label nodes
    const communityLabelNodes: any[] = [];
    if (data?.communities) {
      data.communities.forEach((_: any, i: number) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 800; // place labels further out
        communityLabelNodes.push({
          id: `community-label-${i}`,
          type: "default",
          position: { x: Math.cos(angle) * r, y: Math.sin(angle) * r },
          data: { label: `Cluster ${i + 1}` },
          style: {
            background: COMMUNITY_COLORS[i % COMMUNITY_COLORS.length] + '20',
            color: COMMUNITY_COLORS[i % COMMUNITY_COLORS.length],
            border: `2px solid ${COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]}`,
            borderRadius: '20px',
            fontWeight: 'bold',
            padding: '10px 20px',
            fontSize: '16px',
            pointerEvents: 'none'
          }
        });
      });
    }

    setNodes([...finalNodes, ...communityLabelNodes]);
    setEdges(newEdges);
  }, [setNodes, setEdges, data?.communities]);

  useEffect(() => {
    if (data?.nodes) {
      updateGraphLayout(data.nodes, data.edges, timeIndex);
    }
  }, [data, timeIndex, updateGraphLayout]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      playInterval.current = setInterval(() => {
        setTimeIndex((prev) => {
          if (prev >= 6) return 0;
          return prev + 1;
        });
      }, 2000);
    } else {
      if (playInterval.current) clearInterval(playInterval.current);
    }
    return () => { if (playInterval.current) clearInterval(playInterval.current); };
  }, [isPlaying]);

  const runGNNPropagation = async () => {
    if (isSimulating || !data?.propagation_steps) return;
    setIsSimulating(true);
    setIsPlaying(false);
    setTimeIndex(0);

    const steps = data.propagation_steps;
    
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, propActive: false } })));
    setEdges(eds => eds.map(e => ({ ...e, style: { stroke: "#cbd5e1", strokeWidth: 1.5 } })));

    for (let step = 0; step < steps.length; step++) {
      const activeIds = steps[step];
      
      setNodes(nds => nds.map(n => {
        const isActive = activeIds.includes(n.id);
        return {
          ...n,
          data: { ...n.data, propActive: isActive }
        };
      }));

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

      await new Promise(resolve => setTimeout(resolve, 1400));
    }

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
            Failed to load the Knowledge Graph data.
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold shadow-md shadow-violet-200 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
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
        </div>
      </div>
    );
  }

  const getExplainabilityBreakdown = (node: any) => {
    if (node.shap_values && node.shap_values.length > 0) {
      return node.shap_values.map((s: any) => {
        const contrib = s.contribution ?? s.contribution_pct ?? 0;
        return {
          label: s.feature || s.label || "Unknown Feature",
          change: `${contrib >= 0 ? "+" : ""}${Number(contrib).toFixed(1)}%`,
          isPositive: contrib >= 0
        };
      });
    }
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
          <p className="text-xs text-slate-500 mt-0.5">Real-time Knowledge Graph · AI Flood Susceptibility Partitioning</p>
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
        
        {/* Left Panel: Graph Metrics */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 min-h-0 overflow-y-auto">
          
          <div className="glass-card p-5 space-y-4 shrink-0 shadow-md">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3 font-heading">
              <Activity className="w-4 h-4 text-violet-500" /> Graph Structural Metrics
            </h2>
            <div className="flex flex-col gap-3">
              {[
                { label: "Graph Density", value: data.stats.density, explain: "Measures how interconnected the regions are. High density means floods spread easily across borders." },
                { label: "Avg Degree", value: data.stats.avg_degree, explain: "Average number of direct connections per node. High degree indicates complex water flow networks." },
                { label: "Clustering Coeff", value: data.stats.clustering_coefficient, explain: "Indicates localized risk pockets. High clustering means a flood in one area will likely trap nearby areas." },
                { label: "Inference Latency", value: `${data.stats.latency_ms}ms`, explain: "Time taken by AI to analyze the entire graph. Lower is better for real-time alerts." },
                { label: "Total Nodes", value: data.stats.total_nodes, explain: "Number of geographical and sensor entities being monitored in real time." },
                { label: "Active Sensors", value: data.stats.active_sensors, explain: "Live data sources continuously feeding the Knowledge Graph." }
              ].map(({ label, value, explain }) => (
                <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow transition-shadow">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
                    <p className="text-sm font-bold text-slate-800 font-mono">{value}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">{explain}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Panel: ReactFlow Canvas */}
        <div className="col-span-12 lg:col-span-6 glass-card overflow-hidden relative flex flex-col border border-slate-200 shadow-lg rounded-2xl bg-white">
          
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 shadow-sm pointer-events-none">
             <p className="text-xs font-bold text-slate-800">Spatial Flow Graph</p>
             <p className="text-[10px] text-slate-500">Nodes are clustered by Basin Community</p>
          </div>

          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={() => setShowAllEdges(!showAllEdges)}
              className="flex items-center gap-1.5 bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {showAllEdges ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-violet-500" />}
              {showAllEdges ? "Hide Minor Edges" : "Show All Edges"}
            </button>
          </div>

          <div className="flex-1 min-h-0 bg-slate-50 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges.filter((e: any) => showAllEdges || e.dynamicInfluence > 15 || e.attention > 0.3)}
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
            </ReactFlow>
          </div>

          {/* Temporal Playback Slider Overlay */}
          <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-slate-200 p-3 rounded-2xl shadow-xl flex items-center gap-4 z-10">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors flex-shrink-0 shadow-md shadow-violet-200"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>
            
            <div className="flex-1 px-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2 font-mono uppercase tracking-wider">
                <span>Timeline Slider</span>
                <span className="text-violet-600 bg-violet-50 px-2 py-0.5 rounded font-heading">{TIME_WINDOWS[timeIndex].label} ago</span>
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
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
              />
              <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-2 font-mono">
                {TIME_WINDOWS.map((win, idx) => (
                  <span key={win.key} className={idx === timeIndex ? "text-violet-600 font-bold" : ""}>
                    {win.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Communities & Explainability */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 min-h-0 overflow-y-auto">
          
          <div className="glass-card p-5 flex-1 flex flex-col min-h-0 shadow-md">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3 shrink-0">
              <Map className="w-4 h-4 text-blue-500" /> Basin Communities
            </h2>
            <p className="text-[10px] text-slate-500 mt-2 mb-3">AI clusters interconnected nodes that flood together.</p>
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {data.communities.map((comm: string[], i: number) => {
                const color = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length];
                const districts = comm.filter(id => id.startsWith("d-")).map(id => {
                  const node = data.nodes.find((n: any) => n.id === id);
                  return node ? node.label : "";
                }).filter(Boolean);

                return (
                  <div key={i} className="bg-white border border-slate-200 p-3 rounded-xl hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: color }} />
                    <div className="flex justify-between items-center mb-2 pl-2">
                      <span className="text-xs font-bold text-slate-700">Cluster {i + 1}</span>
                      <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                        {comm.length} Nodes
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed pl-2">
                      {districts.join(", ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-5 flex-1 flex flex-col min-h-0 shadow-md">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3 shrink-0 font-heading">
              <TrendingUp className="w-4 h-4 text-amber-500" /> AI Attention Bottlenecks
            </h2>
            <div className="mt-4 overflow-y-auto space-y-4 flex-1 pr-1">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Top Influential Edges</p>
                <div className="space-y-2">
                  {data.explainability.critical_edges.slice(0, 3).map((edge: any, i: number) => {
                    const sourceNode = data.nodes.find((n: any) => n.id === edge.source);
                    const targetNode = data.nodes.find((n: any) => n.id === edge.target);
                    return (
                      <div key={i} className="flex justify-between items-center bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                        <span className="font-semibold text-slate-700 text-[10px] max-w-[150px] truncate">
                          {sourceNode?.label} → {targetNode?.label}
                        </span>
                        <span className="text-[10px] font-bold text-red-500 font-mono">
                          {edge.influence.toFixed(1)} infl
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Highest Attention Paths</p>
                <div className="space-y-2 bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-slate-600">
                  {(data.explainability.highest_attention_paths ?? []).length > 0
                    ? (data.explainability.highest_attention_paths as string[][]).map((path: string[], i: number) => {
                        const pathLabels = path.map((pid: string) => {
                          const nd = data.nodes.find((n: any) => n.id === pid);
                          return nd?.label ?? pid;
                        });
                        const dot = i === 0 ? "bg-red-500" : "bg-amber-500";
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
                            <span className="text-[10px] text-slate-700 leading-tight">
                              {pathLabels.join(" → ")}
                            </span>
                          </div>
                        );
                      })
                    : (
                      <p className="text-[10px] text-slate-400">Run GNN inference to compute attention paths.</p>
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
            className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 p-6 shadow-2xl z-40 max-w-6xl mx-auto rounded-t-3xl flex flex-col gap-4 max-h-[40vh]"
          >
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 px-2.5 py-1 rounded-md bg-violet-100 border border-violet-200 font-mono">
                  {TYPE_CONFIG[selectedNode.type]?.label} Entity
                </span>
                <h3 className="text-xl font-heading font-bold text-slate-800 mt-2 flex items-center gap-2">
                  <span>{TYPE_CONFIG[selectedNode.type]?.emoji}</span> {selectedNode.label}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-1 overflow-y-auto pr-2">
              {/* Metrics Column */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide font-mono">Live Telemetry Details</p>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs font-medium space-y-2 text-slate-700">
                  {Object.entries(selectedNode.data || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize text-slate-500">{key.replace(/_/g, " ")}</span>
                      <span className="font-mono font-bold text-slate-800">{String(value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-200 pt-2 mt-2 font-bold">
                    <span className="text-slate-500 uppercase tracking-widest">Risk Score</span>
                    <span className="text-red-500 font-mono text-sm">{selectedNode.risk_score.toFixed(1)} / 100</span>
                  </div>
                </div>
              </div>

              {/* Explainability Breakdown Column */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide font-mono">Inference Contribution</p>
                <div className="space-y-2 overflow-y-auto max-h-40 pr-1">
                  {getExplainabilityBreakdown(selectedNode).map((factor: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs shadow-sm">
                      <span className="font-semibold text-slate-700">{factor.label}</span>
                      <span className={`font-bold font-mono text-[11px] px-2 py-0.5 rounded ${
                        factor.isPositive === false ? "bg-green-100 text-green-700" :
                        parseFloat(factor.change ?? factor.value ?? "0") < 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>{factor.change || factor.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Embeddings Column */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide font-mono">128D Layer Embedding Vector</p>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 h-full flex flex-col">
                  <div className="grid grid-cols-4 gap-2 font-mono text-[10px] text-center mb-3">
                    {selectedNode.embedding.map((val: number, i: number) => (
                      <span key={i} className="bg-white border border-slate-200 py-1.5 rounded font-bold text-slate-700 shadow-sm">
                        {val.toFixed(2)}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-auto">
                    *First 8 dimension aggregates shown. Embedding is updated dynamically during spatial message passing iterations by the GNN.
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
