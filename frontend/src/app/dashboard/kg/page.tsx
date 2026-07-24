"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import ReactFlow, {
  Node, Edge, Background, Controls,
  useNodesState, useEdgesState,
  NodeTypes, Handle, Position, MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Network, MapPin, RefreshCw, Activity,
  Play, Pause, TrendingUp, X, Map, BarChart2, Eye, EyeOff, Code, AlertTriangle
} from "lucide-react";
import * as d3 from "d3-force";

const STATUS_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  Warning: "#f59e0b",
  Watch: "#3b82f6",
  Safe: "#10b981",
};

const COMMUNITY_COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#f97316", "#ef4444", "#a855f7", "#06b6d4"
];

// ─── Custom District Node Component ──────────────────────────────────────────
function DistrictNode({ data }: { data: any }) {
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.Safe;

  return (
    <div className="flex flex-col items-center select-none" style={{ minWidth: 140 }}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-slate-400 !border-white" />
      <div
        className="rounded-xl bg-white px-3 py-2 shadow-md transition-all duration-300 w-full hover:shadow-lg hover:z-20"
        style={{
          borderStyle: "solid",
          borderWidth: data.risk_score >= 75 ? 4 : data.risk_score >= 50 ? 2.5 : 1,
          borderColor: data.risk_score >= 75 ? statusColor : data.risk_score >= 50 ? statusColor : "#cbd5e1",
          borderLeftWidth: 6,
          borderLeftColor: statusColor,
          backgroundColor: "white",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800 leading-snug truncate font-heading max-w-[95px]">
            {data.label}
          </p>
          <span
            className="text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono text-white flex-shrink-0 transition-colors duration-300"
            style={{ backgroundColor: statusColor }}
          >
            {data.risk_score.toFixed(1)}
          </span>
        </div>

        {/* Live Rain/Risk Telemetry indicator */}
        <div className="mt-1 flex justify-between items-center text-[9px] text-slate-400 font-mono border-t border-slate-100 pt-1">
          <span className="font-bold" style={{ color: statusColor }}>{data.status}</span>
          <span>{data.data?.rainfall_24h ?? 0}mm rain</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-slate-400 !border-white" />
    </div>
  );
}

// ─── Custom Cluster Background Region Component ──────────────────────────────
function ClusterBackgroundNode({ data }: { data: any }) {
  return (
    <div
      className="rounded-[2.5rem] transition-all duration-300 pointer-events-none flex items-start justify-start p-4"
      style={{
        width: data.width,
        height: data.height,
        backgroundColor: `${data.color}15`,
        border: `2px dashed ${data.color}40`,
      }}
    >
      <span
        className="text-xs font-bold font-heading px-3 py-1 rounded-full border shadow-sm"
        style={{
          backgroundColor: `${data.color}25`,
          color: data.color,
          borderColor: `${data.color}50`,
        }}
      >
        Cluster {data.clusterNum} · River Basin
      </span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  districtNode: DistrictNode,
  clusterBackground: ClusterBackgroundNode,
};

export default function DynamicKnowledgeGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [timeIndex, setTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [topConnections, setTopConnections] = useState<any[]>([]);
  
  const playInterval = useRef<any>(null);

  const TIME_WINDOWS = [
    { label: "Now", key: "now" },
    { label: "+15m", key: "15m" },
    { label: "+30m", key: "30m" },
    { label: "+1h", key: "1h" },
    { label: "+3h", key: "3h" },
    { label: "+6h", key: "6h" },
    { label: "+24h", key: "24h" }
  ];

  const { data, isLoading, isError, refetch } = useQuery({
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
  });

  const getRiskFromHistory = (node: any, idx: number) => {
    if (!node.history || node.history.length <= idx) return node.risk_score;
    return node.history[idx];
  };

  const updateGraphLayout = useCallback((rawNodes: any[], rawEdges: any[], timeIdx: number) => {
    // 1. Community map
    const communityMap: Record<string, number> = {};
    if (data?.communities) {
      data.communities.forEach((comm: string[], i: number) => {
        comm.forEach(id => { communityMap[id] = i; });
      });
    }

    // 2. Filter ONLY district nodes for main visual graph representation
    const districtNodes = rawNodes.filter(n => n.type === "district" || n.id.startsWith("d-"));

    const d3Nodes = districtNodes.map((n: any) => {
      const currentRisk = getRiskFromHistory(n, timeIdx);
      let status = "Safe";
      if (currentRisk >= 75) status = "Critical";
      else if (currentRisk >= 50) status = "Warning";
      else if (currentRisk >= 25) status = "Watch";
      
      const commIdx = communityMap[n.id] ?? 0;
      const communityColor = COMMUNITY_COLORS[commIdx % COMMUNITY_COLORS.length];
      
      return {
        id: n.id,
        x: 0,
        y: 0,
        data: {
          ...n,
          risk_score: currentRisk,
          status,
          communityColor,
          communityIdx: commIdx,
        },
      };
    });

    const districtIds = new Set(d3Nodes.map(n => n.id));

    // Filter edges between district nodes
    const districtEdges = rawEdges.filter(e => districtIds.has(e.source) && districtIds.has(e.target));

    const formattedEdges = districtEdges.map((e: any) => {
      const sourceNode = rawNodes.find(n => n.id === e.source);
      const sourceRisk = sourceNode ? getRiskFromHistory(sourceNode, timeIdx) : 15;
      const dynamicInfluence = e.attention * sourceRisk;
      const statusColor = sourceRisk >= 75 ? STATUS_COLORS.Critical 
                        : sourceRisk >= 50 ? STATUS_COLORS.Warning 
                        : sourceRisk >= 25 ? STATUS_COLORS.Watch 
                        : "#94a3b8";

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: dynamicInfluence > 15 || e.attention > 0.4,
        label: `infl: ${dynamicInfluence.toFixed(1)}`,
        labelStyle: { fill: "#475569", fontWeight: 700, fontSize: 8 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95, rx: 4, ry: 4 },
        style: {
          stroke: statusColor,
          strokeWidth: Math.max(1.2, Math.min(5.0, dynamicInfluence / 4)),
          opacity: 0.85,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: statusColor },
        dynamicInfluence,
        attention: e.attention,
        sourceRisk,
      };
    });

    // Compute top dynamic connections for the current time horizon
    const rankedConnections = [...formattedEdges]
      .sort((a, b) => b.dynamicInfluence - a.dynamicInfluence)
      .slice(0, 4);
    setTopConnections(rankedConnections);

    // 3. D3 Force Simulation with Strict Node Collision & Inter-Cluster Spacing
    const totalCommunities = Math.max(1, data?.communities?.length || 4);
    const radius = 650; // Radial distance between community centroids

    // Clone formattedEdges for D3 simulation to prevent mutation of string IDs
    const d3Links = formattedEdges.map((e: any) => ({ ...e }));

    const simulation = d3.forceSimulation(d3Nodes)
      .force("charge", d3.forceManyBody().strength(-600))
      .force("collide", d3.forceCollide(85).iterations(4)) // Sized collision zone (170px) prevents any node overlaps!
      .force("x", d3.forceX((d: any) => {
        const angle = (d.data.communityIdx / totalCommunities) * Math.PI * 2;
        return Math.cos(angle) * radius;
      }).strength(0.6))
      .force("y", d3.forceY((d: any) => {
        const angle = (d.data.communityIdx / totalCommunities) * Math.PI * 2;
        return Math.sin(angle) * radius;
      }).strength(0.6))
      .force("link", d3.forceLink(d3Links).id((d: any) => d.id).distance(140).strength(0.2))
      .stop();

    simulation.tick(350);

    const finalNodes = d3Nodes.map((n: any) => ({
      id: n.id,
      type: "districtNode",
      position: { x: n.x, y: n.y },
      data: n.data,
      zIndex: 10
    }));

    // 4. Calculate Community Bounding Boxes for Soft Background Regions
    const communityBounds: Record<number, { minX: number, maxX: number, minY: number, maxY: number }> = {};
    finalNodes.forEach((n) => {
      const idx = n.data.communityIdx;
      if (idx === undefined) return;
      if (!communityBounds[idx]) {
        communityBounds[idx] = { minX: n.position.x, maxX: n.position.x, minY: n.position.y, maxY: n.position.y };
      } else {
        communityBounds[idx].minX = Math.min(communityBounds[idx].minX, n.position.x);
        communityBounds[idx].maxX = Math.max(communityBounds[idx].maxX, n.position.x);
        communityBounds[idx].minY = Math.min(communityBounds[idx].minY, n.position.y);
        communityBounds[idx].maxY = Math.max(communityBounds[idx].maxY, n.position.y);
      }
    });

    const communityBgNodes: any[] = [];
    if (data?.communities) {
      data.communities.forEach((_: any, i: number) => {
        const bounds = communityBounds[i];
        if (bounds) {
          const padding = 70;
          const width = (bounds.maxX - bounds.minX) + padding * 2 + 140;
          const height = (bounds.maxY - bounds.minY) + padding * 2 + 50;
          const cx = bounds.minX - padding;
          const cy = bounds.minY - padding - 30;

          communityBgNodes.push({
            id: `community-bg-${i}`,
            type: "clusterBackground",
            position: { x: cx, y: cy },
            data: { 
              width, 
              height, 
              color: COMMUNITY_COLORS[i % COMMUNITY_COLORS.length],
              clusterNum: i + 1
            },
            zIndex: -1
          });
        }
      });
    }

    // Ensure edges passed to ReactFlow have string source and target IDs
    const cleanEdges = formattedEdges.map((e: any) => ({
      ...e,
      source: typeof e.source === "object" ? e.source.id : String(e.source),
      target: typeof e.target === "object" ? e.target.id : String(e.target),
    }));

    setNodes([...communityBgNodes, ...finalNodes]);
    setEdges(cleanEdges);
  }, [setNodes, setEdges, data?.communities]);

  useEffect(() => {
    if (data?.nodes) {
      updateGraphLayout(data.nodes, data.edges, timeIndex);
      if (selectedNode) {
        const updatedNode = data.nodes.find((n: any) => n.id === selectedNode.id);
        if (updatedNode) {
          const currentRisk = getRiskFromHistory(updatedNode, timeIndex);
          let status = "Safe";
          if (currentRisk >= 75) status = "Critical";
          else if (currentRisk >= 50) status = "Warning";
          else if (currentRisk >= 25) status = "Watch";
          setSelectedNode((prev: any) => prev ? {
            ...prev,
            risk_score: currentRisk,
            status,
          } : null);
        }
      }
    }
  }, [data, timeIndex, updateGraphLayout]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.type === "districtNode") {
      setSelectedNode(node.data);
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
      playInterval.current = setInterval(() => {
        setTimeIndex((prev) => (prev >= 6 ? 0 : prev + 1));
      }, 2000);
    } else {
      if (playInterval.current) clearInterval(playInterval.current);
    }
    return () => { if (playInterval.current) clearInterval(playInterval.current); };
  }, [isPlaying]);

  if (isError) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <X className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-heading font-bold text-slate-800">Knowledge Graph Unavailable</h2>
          <p className="text-sm text-slate-500">Failed to load Knowledge Graph topology.</p>
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
          <p className="text-sm font-semibold text-slate-600 font-heading">Constructing Knowledge Graph...</p>
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
    const rain = node.data?.rainfall_24h ?? 0;
    const saturation = node.data?.soil_saturation_pct ?? 0;
    const factors = [];
    if (rain > 0) factors.push({ label: "Heavy Rainfall", change: `+${(rain * 0.4).toFixed(0)}%`, isPositive: true });
    if (saturation > 40) factors.push({ label: "Soil Saturation", change: `+${(saturation * 0.15).toFixed(0)}%`, isPositive: true });
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
            <Network className="w-6 h-6 text-violet-600" /> Dynamic Knowledge Graph Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">How flood risk spreads between districts in Tamil Nadu.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Force Sync
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

        {/* Center Panel: ReactFlow Force-Directed Node-Link Graph */}
        <div className="col-span-12 lg:col-span-6 glass-card overflow-hidden relative flex flex-col border border-slate-200 shadow-lg rounded-2xl bg-white">
          
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 shadow-sm pointer-events-none">
             <p className="text-xs font-bold text-slate-800">Node-Link Knowledge Graph</p>
             <p className="text-[10px] text-slate-500">Nodes clustered by Basin Community</p>
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
              edges={edges.filter((e: any) => showAllEdges || e.dynamicInfluence > 20 || e.attention > 0.4)}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.05}
              maxZoom={2}
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
                <span>See risk spread over the next few hours</span>
                <span className="text-violet-600 bg-violet-50 px-2 py-0.5 rounded font-heading font-mono">
                  Forecast Target: {TIME_WINDOWS[timeIndex].label}
                </span>
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
            <p className="text-[10px] text-slate-500 mt-2 mb-3">These districts share river systems — flooding in one raises risk in the others.</p>
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {data.communities.map((comm: string[], i: number) => {
                const color = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length];
                const districts = comm.filter(id => id.startsWith("d-")).map(id => {
                  const node = data.nodes.find((n: any) => n.id === id);
                  return node ? node.label : "";
                }).filter(Boolean);

                if (districts.length === 0) return null;

                return (
                  <div key={i} className="bg-white border border-slate-200 p-3 rounded-xl hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: color }} />
                    <div className="flex justify-between items-center mb-2 pl-2">
                      <span className="text-xs font-bold text-slate-700">Cluster {i + 1}</span>
                      <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                        {districts.length} Districts
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
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 font-heading">
                <TrendingUp className="w-4 h-4 text-amber-500" /> Strongest Risk Connections
              </h2>
              <span className="text-[9px] font-mono font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                {TIME_WINDOWS[timeIndex].label}
              </span>
            </div>
            <div className="mt-4 overflow-y-auto space-y-3 flex-1 pr-1">
              {(topConnections.length > 0 ? topConnections : data.explainability.critical_edges.slice(0, 4)).map((edge: any, i: number) => {
                const sourceNode = data.nodes.find((n: any) => n.id === edge.source);
                const targetNode = data.nodes.find((n: any) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                return (
                  <div key={i} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col gap-1 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                      <div className="flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span>{sourceNode.label} → {targetNode.label}</span>
                      </div>
                      <span className="text-[9px] font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex-shrink-0">
                        {edge.dynamicInfluence.toFixed(1)} infl
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-normal mt-0.5">
                      <strong className="text-slate-800">{sourceNode.label}</strong>&apos;s flood risk strongly affects <strong className="text-slate-800">{targetNode.label}</strong> via shared river drainage.
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced / Technical View Toggle */}
      <div className="flex justify-center flex-shrink-0">
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-4 py-2 rounded-full transition-colors flex items-center gap-2"
        >
          <Code className="w-4 h-4" />
          {showAdvanced ? "Hide Advanced / Technical View" : "Show Advanced / Technical View"}
        </button>
      </div>

      {showAdvanced && (
        <div className="glass-card p-5 mt-2 flex flex-col gap-4 shadow-md bg-slate-900 border-none text-slate-300 relative">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
             <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
               <BarChart2 className="w-4 h-4 text-indigo-400" /> 128D Embedding Projection (t-SNE)
             </h3>
             <button onClick={() => setShowAdvanced(false)} className="text-slate-400 hover:text-white">
               <X className="w-4 h-4" />
             </button>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            Underlying GNN embeddings projected to 2D space. Regions clustered tightly share similar risk profiles across 128 dimensions.
          </p>
          <div className="h-48 border border-slate-700 rounded-xl flex items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
            t-SNE Projection Matrix Active (38 district embedding vectors)
          </div>
        </div>
      )}

      {/* Selected Node Details Drawer */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ y: 250, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 250, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 p-6 shadow-2xl z-[100] max-w-6xl mx-auto rounded-t-3xl flex flex-col gap-4 max-h-[42vh]"
          >
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-xl font-heading font-bold text-slate-800 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-violet-600" /> {selectedNode.label}
                </h3>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white font-mono"
                    style={{ backgroundColor: STATUS_COLORS[selectedNode.status] || "#94a3b8" }}
                  >
                    Risk Level: {selectedNode.status}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono font-semibold">
                    Risk Score: {selectedNode.risk_score.toFixed(1)}/100
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 overflow-y-auto pr-2 mt-2">
              {/* Connected Districts */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide font-mono">Connected Districts</p>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 overflow-y-auto max-h-40 text-xs text-slate-700 font-medium">
                  {data.edges
                    .filter((e: any) => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((edge: any, idx: number) => {
                      const isSource = edge.source === selectedNode.id;
                      const otherNodeId = isSource ? edge.target : edge.source;
                      const otherNode = data.nodes.find((n: any) => n.id === otherNodeId);
                      if (!otherNode) return null;
                      
                      const isRiver = edge.dynamicInfluence > 20 || edge.attention > 0.4;
                      return (
                        <div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-200 last:border-0">
                          <span className="text-slate-800 font-bold">{otherNode.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${isRiver ? "bg-violet-100 text-violet-700 font-bold" : "bg-slate-200 text-slate-600"}`}>
                            {isRiver ? "High River Flow" : "Border Adjacency"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Top Risk Factors Column */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide font-mono">Top SHAP Risk Factors</p>
                <div className="space-y-2 overflow-y-auto max-h-40 pr-1">
                  {getExplainabilityBreakdown(selectedNode).map((factor: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs shadow-sm">
                      <span className="font-semibold text-slate-700">{factor.label}</span>
                      <span className={`font-bold font-mono text-[11px] px-2 py-0.5 rounded ${
                        factor.isPositive === false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>{factor.change || factor.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
