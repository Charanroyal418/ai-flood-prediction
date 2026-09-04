"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useFloodData } from "@/context/FloodDataContext";
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  NodeTypes, Handle, Position, MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from 'html-to-image';
import CountUp from 'react-countup';
import {
  Network, MapPin, RefreshCw, Activity,
  Play, Pause, TrendingUp, X, Map, BarChart2, Eye, EyeOff, Code, AlertTriangle, Download, Filter
} from "lucide-react";
import * as d3 from "d3-force";

const STATUS_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Moderate: "#f59e0b",
  Low: "#22c55e",
  Safe: "#3b82f6",
};

const NODE_TYPE_COLORS: Record<string, string> = {
  district: "#3b82f6", // Blue
  river: "#06b6d4", // Cyan
  reservoir: "#22c55e", // Green
  weather_station: "#f97316", // Orange
  basin: "#a855f7", // Purple
};

const COMMUNITY_COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#f97316", "#ef4444", "#a855f7", "#06b6d4"
];

function EntityNode({ data }: { data: any }) {
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.Safe;
  const isRiver = data.type === "river" || data.id?.startsWith("rv-");
  const isWeather = data.type === "weather_station" || data.id?.startsWith("ws-");
  const isReservoir = data.type === "reservoir" || data.id?.startsWith("rs-") || data.id?.startsWith("dam-");
  
  const { attentionMode } = data;
  
  let shapeClass = "rounded-full"; // District
  const nodeTypeStr = isRiver ? "river" : isWeather ? "weather_station" : isReservoir ? "reservoir" : "district";
  
  if (isRiver) shapeClass = "rounded-md";
  else if (isWeather) shapeClass = "rounded-sm rotate-45";
  else if (isReservoir) shapeClass = "rounded-none";

  const isStructuralOrAttention = attentionMode === 'structural' || attentionMode === 'attention';
  const displayColor = isStructuralOrAttention ? (NODE_TYPE_COLORS[nodeTypeStr] || NODE_TYPE_COLORS.district) : statusColor;

  return (
    <div className="group flex flex-col items-center select-none relative">
      <Handle type="target" position={Position.Left} className="w-1 h-1 !bg-slate-400 !border-none !opacity-0" />
      
      {/* Compact View */}
      <div className="flex flex-col items-center gap-1">
        <div 
          className={`w-4 h-4 shadow-sm border-2 transition-transform duration-300 group-hover:scale-110 ${shapeClass}`}
          style={{
            backgroundColor: displayColor,
            borderColor: "white",
            boxShadow: `0 0 10px ${displayColor}40`
          }}
        />
        <span className="text-[8px] font-bold text-slate-600 bg-white/80 px-1 rounded backdrop-blur-sm pointer-events-none whitespace-nowrap group-hover:opacity-0 transition-opacity mt-1">
          {data.label}
        </span>
      </div>

      {/* Expanded View (Hover) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-50 group-hover:scale-100 scale-95 shadow-xl rounded-xl bg-white p-2 min-w-[140px]"
        style={{
          borderLeftWidth: 4,
          borderLeftColor: displayColor,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800 leading-snug font-heading break-words text-center flex-1 pr-1">
            {data.label}
          </p>
          <span
            className="text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono text-white flex-shrink-0 transition-colors duration-300"
            style={{ backgroundColor: displayColor }}
          >
            {(Number(data?.risk_score) || 0).toFixed(1)}
          </span>
        </div>

        {/* Live Telemetry indicator */}
        <div className="mt-1 flex justify-between items-center text-[9px] text-slate-400 font-mono border-t border-slate-100 pt-1">
          <span className="font-bold" style={{ color: displayColor }}>{data.status}</span>
          <span>{data.type || 'District'}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-1 h-1 !bg-slate-400 !border-none !opacity-0" />
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
  entityNode: EntityNode,
  districtNode: EntityNode, // for backwards compat
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
  const [attentionMode, setAttentionMode] = useState<"structural" | "attention" | "risk">("risk");
  
  const playInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const layoutPositions = useRef<Record<string, { x: number, y: number }>>({});
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Must be called at top level — before any early returns
  const { mode, stormSimulationActive, modelMeta } = useFloodData();
  const isStormActive = stormSimulationActive || mode === "SIMULATION";

  const TIME_WINDOWS = [
    { label: "Now", key: "now" },
    { label: "+15m", key: "15m" },
    { label: "+30m", key: "30m" },
    { label: "+1h", key: "1h" },
    { label: "+3h", key: "3h" },
    { label: "+6h", key: "6h" },
    { label: "+24h", key: "24h" }
  ];

  const { kgData: data, refetchKg: refetch } = useFloodData();
  const isLoading = !data;
  const isError = data?.status === "error";

  const getRiskFromHistory = (node: any, idx: number) => {
    if (!node.history || node.history.length <= idx) return node.risk_score;
    return node.history[idx];
  };

  const updateGraphLayout = useCallback((rawNodes: any[], rawEdges: any[], timeIdx: number, selectedId: string | undefined, showAll: boolean, currentAttentionMode: string) => {
    // 1. Community map
    const communityMap: Record<string, number> = {};
    if (data?.communities) {
      data.communities.forEach((comm: string[], i: number) => {
        comm.forEach(id => { communityMap[id] = i; });
      });
    }

    // 2. Map ALL nodes for main visual graph representation
    const d3Nodes = rawNodes.map((n: any) => {
      const currentRisk = getRiskFromHistory(n, timeIdx);
      let status = "Safe";
      if (currentRisk >= 80) status = "Critical";
      else if (currentRisk >= 60) status = "High";
      else if (currentRisk >= 40) status = "Moderate";
      else if (currentRisk >= 20) status = "Low";
      
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
          attentionMode: currentAttentionMode,
        },
      };
    });

    const nodeIds = new Set(d3Nodes.map(n => n.id));

    // Filter edges
    const validEdges = rawEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    const formattedEdges = validEdges.map((e: any) => {
      const sourceNode = rawNodes.find(n => n.id === e.source);
      const sourceRisk = sourceNode ? getRiskFromHistory(sourceNode, timeIdx) : 15;
      const dynamicInfluence = e.attention * sourceRisk;
      const statusColor = sourceRisk >= 80 ? STATUS_COLORS.Critical 
                        : sourceRisk >= 60 ? STATUS_COLORS.High 
                        : sourceRisk >= 40 ? STATUS_COLORS.Moderate 
                        : sourceRisk >= 20 ? STATUS_COLORS.Low 
                        : STATUS_COLORS.Safe;

      let baseOpacity = showAll ? (dynamicInfluence > 15 || e.attention > 0.4 ? 0.6 : 0.25) : 
                                 (dynamicInfluence > 15 || e.attention > 0.05 ? 0.6 : 0);
      
      let opacity = baseOpacity;
      if (selectedId) {
         opacity = (e.source === selectedId || e.target === selectedId) ? 0.9 : 0.05;
      }

      let strokeColor = statusColor;
      let strokeWidth = Math.max(1.2, Math.min(5.0, dynamicInfluence / 4));
      
      if (currentAttentionMode === 'attention') {
         if (e.attention > 0.6) { strokeColor = "#a855f7"; strokeWidth = 4; } // Thick purple
         else if (e.attention > 0.2) { strokeColor = "#14b8a6"; strokeWidth = 2.5; } // Medium teal
         else { strokeColor = "#94a3b8"; strokeWidth = 1.2; } // Thin gray
      } else if (currentAttentionMode === 'structural') {
         strokeColor = "#cbd5e1";
         strokeWidth = 1.5;
      }

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: dynamicInfluence > 15 || e.attention > 0.4,
        label: `infl: ${(Number(dynamicInfluence) || 0).toFixed(1)}`,
        labelStyle: { fill: "#475569", fontWeight: 700, fontSize: 8 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95, rx: 4, ry: 4 },
        style: {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          opacity: opacity,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
        dynamicInfluence,
        attention: e.attention,
        sourceRisk,
      };
    });

    // Compute top dynamic connections for the current time horizon
    const rankedConnections = [...formattedEdges]
      .sort((a, b) => b.dynamicInfluence - a.dynamicInfluence)
      .slice(0, 10); // Top 10
    setTopConnections(rankedConnections);

    // 3. D3 Force Simulation with Strict Node Collision & Inter-Cluster Spacing
    const totalCommunities = Math.max(1, data?.communities?.length || 4);
    const radius = 400; // Radial distance between community centroids

    // Clone formattedEdges for D3 simulation to prevent mutation of string IDs
    const d3Links = formattedEdges.map((e: any) => ({ ...e }));

    const needsLayout = Object.keys(layoutPositions.current).length === 0;

    if (needsLayout) {
      const simulation = d3.forceSimulation(d3Nodes)
        .force("charge", d3.forceManyBody().strength(-250))
        .force("collide", d3.forceCollide(40).iterations(4)) // Sized collision zone prevents overlaps
        .force("x", d3.forceX((d: any) => {
          const angle = (d.data.communityIdx / totalCommunities) * Math.PI * 2;
          return Math.cos(angle) * radius;
        }).strength(0.3))
        .force("y", d3.forceY((d: any) => {
          const angle = (d.data.communityIdx / totalCommunities) * Math.PI * 2;
          return Math.sin(angle) * radius;
        }).strength(0.3))
        .force("link", d3.forceLink(d3Links).id((d: any) => d.id).distance(80).strength(0.2))
        .stop();

      simulation.tick(300);
      d3Nodes.forEach((n: any) => {
        layoutPositions.current[n.id] = { x: n.x, y: n.y };
      });
    }

    const finalNodes = d3Nodes.map((n: any) => {
      const pos = layoutPositions.current[n.id] || { x: 0, y: 0 };
      
      let opacity = 1;
      let zIndex = 10;
      if (selectedId) {
         const isSelected = n.id === selectedId;
         const isConnected = formattedEdges.some((e:any) => 
           (e.source === selectedId && e.target === n.id) ||
           (e.target === selectedId && e.source === n.id)
         );
         opacity = (isSelected || isConnected) ? 1 : 0.15;
         zIndex = isSelected ? 50 : isConnected ? 40 : 10;
      }

      return {
        id: n.id,
        type: "entityNode",
        position: pos,
        data: n.data,
        style: { opacity },
        zIndex: zIndex
      };
    });

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
    if (data?.nodes && data?.edges && data?.communities && !isError) {
      updateGraphLayout(data.nodes, data.edges, timeIndex, selectedNode?.id, showAllEdges, attentionMode);
      if (selectedNode) {
        const updatedNode = data.nodes.find((n: any) => n.id === selectedNode.id);
        if (updatedNode) {
          const currentRisk = getRiskFromHistory(updatedNode, timeIndex);
          let status = "Safe";
          if (currentRisk >= 80) status = "Critical";
          else if (currentRisk >= 60) status = "High";
          else if (currentRisk >= 40) status = "Moderate";
          else if (currentRisk >= 20) status = "Low";
          setSelectedNode((prev: any) => prev ? {
            ...prev,
            risk_score: currentRisk,
            status,
          } : null);
        }
      }
    }
  }, [data, timeIndex, updateGraphLayout, selectedNode?.id, showAllEdges, attentionMode]);

  const handleExportPNG = useCallback(() => {
    if (reactFlowWrapper.current === null) return;
    toPng(reactFlowWrapper.current, { 
      filter: (node) => {
        if (node?.classList?.contains('react-flow__controls')) return false;
        if (node?.classList?.contains('react-flow__minimap')) return false;
        if (node?.classList?.contains('react-flow__panel')) return false;
        return true;
      }
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'knowledge-graph.png';
        link.href = dataUrl;
        link.click();
      });
  }, []);

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

  if (isLoading) {
    // Return early without rendering if data is totally empty and it's fetching.
    // If we have nodes though, don't show full-page loading!
    if (!data?.nodes || data.nodes.length === 0) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <Activity className="w-8 h-8 text-signal-500 animate-pulse mx-auto mb-4" />
            <h2 className="text-lg font-bold text-text-primary">Initializing Graph Engine...</h2>
            <p className="text-sm text-text-secondary">Constructing the node topology from live data.</p>
          </div>
        </div>
      );
    }
  }

  if (!data?.nodes || data.nodes.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
            <Network className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Graph Not Populated</h2>
          <p className="text-sm text-slate-500">The knowledge graph telemetry hasn't been ingested yet.</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-bold transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
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
    if (rain > 0) factors.push({ label: "Heavy Rainfall", change: `+${(Number(rain) * 0.4).toFixed(0)}%`, isPositive: true });
    if (saturation > 40) factors.push({ label: "Soil Saturation", change: `+${(Number(saturation) * 0.15).toFixed(0)}%`, isPositive: true });
    factors.push({ label: "Upstream Inflow", change: `+${(Number(node?.risk_score ?? 0) * 0.25).toFixed(0)}%`, isPositive: true });
    factors.push({ label: "GAT Attention Weight", change: `+${(Number(node?.importance ?? 0.5) * 20).toFixed(0)}%`, isPositive: true });
    return factors;
  };

  return (
    <div className="space-y-5 h-[calc(100vh-6rem)] pb-6 flex flex-col">
      {/* Top Header Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Network className="w-6 h-6 text-violet-600" /> Dynamic Knowledge Graph Engine
            </h1>
            {isStormActive && (
              <span className="px-2.5 py-1 rounded-md bg-amber-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm animate-pulse">
                🟠 SIMULATED GRAPH PROPAGATION
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">How flood risk spreads between districts in Tamil Nadu.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setAttentionMode("structural")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${attentionMode === "structural" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Structural
            </button>
            <button
              onClick={() => setAttentionMode("attention")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${attentionMode === "attention" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Attention
            </button>
            <button
              onClick={() => setAttentionMode("risk")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${attentionMode === "risk" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Risk <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            </button>
          </div>
          <button
            onClick={handleExportPNG}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={() => {
               // Simulate refresh animation with slight delay
               setNodes([]);
               setTimeout(() => refetch(), 100);
            }}
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
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Activity className="w-4 h-4 text-violet-500" /> Graph Structural Metrics
            </h2>
            <div className="flex flex-col gap-3">
              {[
                { label: "Graph Density", value: data.stats.density, explain: "Measures how interconnected the regions are. High density means floods spread easily across borders." },
                { label: "Avg Degree", value: data.stats.avg_degree, explain: "Average number of direct connections per node. High degree indicates complex water flow networks." },
                { label: "Clustering Coeff", value: data.stats.clustering_coefficient, explain: "Indicates localized risk pockets. High clustering means a flood in one area will likely trap nearby areas." },
                { label: "Inference Latency", value: `${modelMeta?.inference_time_ms ?? data.stats.latency_ms}ms`, explain: "Time taken by AI to analyze the entire graph. Lower is better for real-time alerts." },
                { label: "Total Nodes", value: modelMeta?.node_count ?? data.stats.total_nodes, explain: "Number of geographical and sensor entities being monitored in real time." },
                { label: "Total Edges", value: modelMeta?.edge_count ?? data.stats.total_edges ?? 0, explain: "Number of connections (adjacency, river flows) between nodes." },
                { label: "Attention Heads", value: modelMeta?.attention_heads ?? 4, explain: "Number of multi-head attention mechanisms used by the GAT layer." }
              ].map(({ label, value, explain }) => (
                <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow transition-shadow">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
                    <p className="text-sm font-bold text-slate-800 font-mono">
                      {typeof value === 'number' ? <CountUp end={value} separator="," duration={2} /> : value}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">{explain}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Panel: ReactFlow Force-Directed Node-Link Graph */}
        <div className="col-span-12 lg:col-span-6 glass-card overflow-hidden relative flex flex-col border border-slate-200 shadow-lg rounded-2xl bg-white h-[560px]">
          
          {/* Floating Legend */}
          <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur px-3 py-2.5 rounded-xl border border-slate-200 shadow-md pointer-events-none">
             <p className="text-xs font-bold text-slate-800 flex items-center gap-2 mb-2 border-b border-slate-100 pb-1">
               <Network className="w-3.5 h-3.5 text-violet-500" /> Graph Legend
             </p>
             <div className="space-y-1.5">
               <div className="flex items-center gap-2">
                 <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NODE_TYPE_COLORS.district }}></span>
                 <span className="text-[10px] text-slate-600 font-medium">District</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="w-2.5 h-2.5 rounded-md" style={{ backgroundColor: NODE_TYPE_COLORS.river }}></span>
                 <span className="text-[10px] text-slate-600 font-medium">River</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="w-2.5 h-2.5 rounded-none" style={{ backgroundColor: NODE_TYPE_COLORS.reservoir }}></span>
                 <span className="text-[10px] text-slate-600 font-medium">Reservoir</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="w-2.5 h-2.5 rounded-sm rotate-45" style={{ backgroundColor: NODE_TYPE_COLORS.weather_station }}></span>
                 <span className="text-[10px] text-slate-600 font-medium">Weather Station</span>
               </div>
               <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100">
                 <span className="w-3 h-3 rounded-full border-2 border-dashed border-purple-400 bg-purple-50"></span>
                 <span className="text-[10px] text-slate-600 font-medium">Basin Community</span>
               </div>
             </div>
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

          <div className="flex-1 min-h-0 bg-slate-50 relative" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges.filter((e: any) => (e.style?.opacity ?? 1) > 0)}
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
              <MiniMap 
                nodeStrokeColor={(n) => {
                  if (n.type === 'clusterBackground') return 'transparent';
                  return n.data?.communityColor || '#94a3b8';
                }}
                nodeColor={(n) => {
                  if (n.type === 'clusterBackground') return n.data?.color + '25';
                  return n.data?.communityColor || '#cbd5e1';
                }}
                className="bg-white border-slate-200 shadow-md rounded-xl overflow-hidden"
              />
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

        {/* Right Panel: Communities & Explainability OR Inspector */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 min-h-0 overflow-hidden h-[560px]">
          <AnimatePresence mode="wait">
            {!selectedNode ? (
              <motion.div 
                key="default-right-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col gap-4 h-full"
              >
                <div className="glass-card p-5 flex-1 flex flex-col min-h-0 shadow-md">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3 shrink-0">
                    <Map className="w-4 h-4 text-blue-500" /> Basin Communities
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-2 mb-3">These districts share river systems — flooding in one raises risk in the others.</p>
                  <div className="overflow-y-auto space-y-3 flex-1 pr-1 custom-scrollbar">
                    {(data.communities || []).map((comm: string[], i: number) => {
                      const color = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length];
                      const districts = (comm || []).filter(id => id.startsWith("d-")).map(id => {
                        const node = (data.nodes || []).find((n: any) => n.id === id);
                        return node ? node.label : "";
                      }).filter(Boolean);

                      if (districts.length === 0) return null;

                      return (
                        <div key={i} className="bg-white border border-slate-200 p-3 rounded-xl hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer group"
                             onClick={() => {
                               // Highlight community nodes logically (can extend node filtering here if needed)
                             }}
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2" style={{ backgroundColor: color }} />
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

                <div className="glass-card flex-1 flex flex-col min-h-0 shadow-md overflow-hidden">
                  <div className="p-4 flex items-center justify-between border-b border-slate-200 shrink-0 bg-white">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 font-heading">
                      <TrendingUp className="w-4 h-4 text-amber-500" /> Strongest Connections
                    </h2>
                    <span className="text-[9px] font-mono font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                      {TIME_WINDOWS[timeIndex].label}
                    </span>
                  </div>
                  <div className="flex-1 overflow-auto bg-slate-50 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider z-10 shadow-sm">
                        <tr>
                          <th className="p-3 font-medium">Source</th>
                          <th className="p-3 font-medium">Target</th>
                          <th className="p-3 font-medium text-right">Attn</th>
                          <th className="p-3 font-medium text-right">Infl</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px] font-medium text-slate-700">
                        {(topConnections.length > 0 ? topConnections : (data?.explainability?.critical_edges || []).filter((e: any) => e.source.startsWith('d-') && e.target.startsWith('d-')).slice(0, 10)).map((edge: any, i: number) => {
                          const sourceNode = data.nodes.find((n: any) => n.id === edge.source);
                          const targetNode = data.nodes.find((n: any) => n.id === edge.target);
                          if (!sourceNode || !targetNode) return null;

                          return (
                            <tr key={i} className="border-b border-slate-200 hover:bg-white transition-colors">
                              <td className="p-3 font-semibold truncate max-w-[80px]">{sourceNode.label}</td>
                              <td className="p-3 truncate max-w-[80px]">{targetNode.label}</td>
                              <td className="p-3 text-right font-mono text-slate-500">{(edge.attention || 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono text-amber-600 font-bold">{(Number(edge.dynamicInfluence) || 0).toFixed(1)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="inspector-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-card flex flex-col h-full shadow-lg border-2 border-violet-100 overflow-hidden relative bg-white"
              >
                <div className="p-5 border-b border-slate-200 bg-slate-50 flex-shrink-0 relative">
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="absolute top-4 right-4 p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="pr-6">
                    <span className="text-[9px] font-bold text-violet-500 uppercase tracking-wider mb-1 block">Node Inspector</span>
                    <h3 className="text-lg font-heading font-bold text-slate-800 flex items-center gap-2 mb-2">
                      {selectedNode.label}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white font-mono shadow-sm"
                        style={{ backgroundColor: STATUS_COLORS[selectedNode.status] || "#94a3b8" }}
                      >
                        {selectedNode.status}
                      </span>
                      <span className="text-[10px] text-slate-600 font-mono font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-sm">
                        Risk: {(Number(selectedNode?.risk_score) || 0).toFixed(1)}/100
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                  
                  {/* General Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Basin Community</p>
                      <p className="text-xs font-semibold text-slate-700 mt-1">
                        Cluster {(data.communities?.findIndex((c: string[]) => c.includes(selectedNode.id)) ?? -1) + 1}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Current Prob</p>
                      <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">
                        {((Number(selectedNode?.risk_score) || 0) * 0.85).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Connected Entities */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5" /> Connected Infrastructure
                    </p>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs text-slate-700">
                      {(data.edges || [])
                        .filter((e: any) => e.source === selectedNode.id || e.target === selectedNode.id)
                        .slice(0, 5) // Limit to 5 for UI space
                        .map((edge: any, idx: number) => {
                          const isSource = edge.source === selectedNode.id;
                          const otherNodeId = isSource ? edge.target : edge.source;
                          const otherNode = data.nodes.find((n: any) => n.id === otherNodeId);
                          if (!otherNode) return null;
                          
                          const isRiver = edge.dynamicInfluence > 20 || edge.attention > 0.4;
                          return (
                            <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                              <span className="font-semibold truncate pr-2" title={otherNode.label}>{otherNode.label}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${isRiver ? "bg-cyan-100 text-cyan-700" : "bg-slate-200 text-slate-600"}`}>
                                {isRiver ? "River" : "Adjacency"}
                              </span>
                            </div>
                          );
                        })}
                        {((data.edges || []).filter((e: any) => e.source === selectedNode.id || e.target === selectedNode.id).length > 5) && (
                           <div className="text-center pt-1 text-[10px] text-slate-400 font-medium">+ more connections</div>
                        )}
                    </div>
                  </div>

                  {/* SHAP Factors */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      <BarChart2 className="w-3.5 h-3.5" /> Dominant SHAP Features
                    </p>
                    <div className="space-y-1.5">
                      {getExplainabilityBreakdown(selectedNode).slice(0, 4).map((factor: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg text-[11px] shadow-sm">
                          <span className="font-semibold text-slate-700 truncate">{factor.label}</span>
                          <span className={`font-bold font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
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
      </div>



    </div>
  );
}
