"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useFloodData } from "@/context/FloodDataContext";
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useStore,
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

const COMMUNITY_NAMES = [
  "Cauvery", "Vaigai", "Tamirabarani", "Palar", "Cooum-Adyar", "Ponnaiyar", "Vellar", "Kosasthalaiyar"
];

const ID_MAP: Record<string, string> = {
  "sn-5": "Cuddalore",
  "sn-6": "Sathanur Reservoir",
  "rg-1": "Cooum River",
  "rg-2": "Vaigai River",
  "rg-3": "Tamirabharani River",
  "db-1": "Palar River",
  "db-3": "Bhavani River",
};

const normalizeEntityName = (name: string, id?: string) => {
  if (id && ID_MAP[id]) return ID_MAP[id];
  let cleanName = (name || "").replace(/^(sn|rg|rv|ws|rs|d)-\d+[-_\s]*/i, '').trim();
  if (!cleanName && id) cleanName = id;
  if (!cleanName) return "";
  return cleanName.replace(/(\sDam)+$/i, ' Dam').replace(/(\sReservoir)+$/i, ' Reservoir');
};

function EntityNode({ data }: { data: any }) {
  const zoom = useStore((s) => s.transform[2]);
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

  const showLabel = nodeTypeStr === "district" || zoom >= 2.0;

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
        {showLabel && (
          <span className="text-[8px] font-bold text-slate-600 bg-white/80 px-1 rounded backdrop-blur-sm pointer-events-none whitespace-nowrap group-hover:opacity-0 transition-opacity mt-1">
            {data.label}
          </span>
        )}
      </div>

      {/* Expanded View (Hover) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-50 group-hover:scale-100 scale-95 shadow-xl rounded-xl bg-white p-2 min-w-[160px]"
        style={{
          borderLeftWidth: 4,
          borderLeftColor: displayColor,
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs font-bold text-slate-800 leading-snug font-heading break-words text-left flex-1 pr-1">
            {data.label}
          </p>
          <span
            className="text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono text-white flex-shrink-0 transition-colors duration-300"
            style={{ backgroundColor: displayColor }}
          >
            {(Number(data?.risk_score) || 0).toFixed(1)}
          </span>
        </div>

        <div className="flex flex-col gap-1 text-[9px] text-slate-500 font-medium">
          {data.communityName && (
            <div className="flex justify-between items-center">
              <span>Basin:</span> <span className="font-bold text-slate-700">{data.communityName}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span>Status:</span> <span className="font-bold" style={{ color: displayColor }}>{data.status}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Degree:</span> <span className="font-bold text-slate-700">{data.degree || 0}</span>
          </div>
          {data.connectedNodes && data.connectedNodes.length > 0 && (
            <div className="mt-1 pt-1 border-t border-slate-100">
              <span className="block mb-0.5">Connected:</span>
              <span className="text-[8px] text-slate-400 leading-tight block">
                {data.connectedNodes.join(", ")}
              </span>
            </div>
          )}
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
  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
  const [visibleTypes, setVisibleTypes] = useState({
    district: true, river: true, reservoir: true, weather_station: true, basin: true
  });
  const [rfInstance, setRfInstance] = useState<any>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const playInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const layoutPositions = useRef<Record<string, { x: number, y: number }>>({});
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Must be called at top level — before any early returns
  const { mode, stormSimulationActive, modelMeta, lastUpdated, relativeSyncTime, dashboardStatus } = useFloodData();
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

  const { kgData: data, refetchKg: refetch, forceRetry } = useFloodData();
  const isError = data?.status === "error";

  // ── 3-second skeleton timeout ──
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const getRiskFromHistory = (node: any, idx: number) => {
    if (!node.history || node.history.length <= idx) return node.risk_score;
    return node.history[idx];
  };

  const handleMove = useCallback((e: any, viewport: any) => {
    setZoomLevel(prev => {
       if (viewport.zoom < 1.6 && prev >= 1.6) return 1.5;
       if (viewport.zoom >= 1.6 && viewport.zoom < 2.0 && (prev < 1.6 || prev >= 2.0)) return 1.6;
       if (viewport.zoom >= 2.0 && prev < 2.0) return 2.0;
       return prev;
    });
  }, []);

  const updateGraphLayout = useCallback((rawNodes: any[], rawEdges: any[], timeIdx: number, selectedId: string | undefined, showAll: boolean, currentAttentionMode: string, vTypes: any, sComm: number | null, currentZoom: number) => {
    // 1. Community map
    const communityMap: Record<string, number> = {};
    (data?.communities || []).forEach((comm: string[], i: number) => {
      comm.forEach((nodeId: string) => {
        communityMap[nodeId] = i;
      });
    });

    const filteredRawNodes = rawNodes.filter(n => {
      const typeStr = n.type === "river" || n.id?.startsWith("rv-") ? "river" :
                      n.type === "weather_station" || n.id?.startsWith("ws-") ? "weather_station" :
                      n.type === "reservoir" || n.id?.startsWith("rs-") || n.id?.startsWith("dam-") ? "reservoir" : "district";
      if (!vTypes[typeStr]) return false;
      return true;
    });

    // 2. Map ALL nodes for main visual graph representation
    const d3Nodes = filteredRawNodes.map((n: any) => {
      const currentRisk = getRiskFromHistory(n, timeIdx);
      let status = "Safe";
      if (currentRisk >= 80) status = "Critical";
      else if (currentRisk >= 60) status = "High";
      else if (currentRisk >= 40) status = "Moderate";
      else if (currentRisk >= 20) status = "Low";
      
      const commIdx = communityMap[n.id] ?? 0;
      const communityColor = COMMUNITY_COLORS[commIdx % COMMUNITY_COLORS.length];
      const communityName = COMMUNITY_NAMES[commIdx % COMMUNITY_NAMES.length];
      
      const typeStr = n.type === "river" || n.id?.startsWith("rv-") ? "river" :
                      n.type === "weather_station" || n.id?.startsWith("ws-") ? "weather_station" :
                      n.type === "reservoir" || n.id?.startsWith("rs-") || n.id?.startsWith("dam-") ? "reservoir" : "district";
      const isMinor = typeStr === "weather_station" || typeStr === "reservoir";
      const shouldHideRiver = typeStr === "river" && currentZoom < 1.6;
      const shouldHideMinor = isMinor && currentZoom < 2.0;
      const shouldHide = shouldHideRiver || shouldHideMinor;
      
      return {
        id: n.id,
        x: 0,
        y: 0,
        data: {
          ...n,
          label: normalizeEntityName(n.label, n.id),
          risk_score: currentRisk,
          status,
          communityColor,
          communityIdx: commIdx,
          communityName,
          attentionMode: currentAttentionMode,
          isHidden: shouldHide,
          timeIndex: timeIdx,
        },
      };
    });

    const nodeIds = new Set(d3Nodes.map(n => n.id));
    const validEdges = rawEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    const formattedEdges = validEdges.map((e: any) => {
      const sourceNode = filteredRawNodes.find(n => n.id === e.source);
      const sourceRisk = sourceNode ? getRiskFromHistory(sourceNode, timeIdx) : 15;
      const dynamicInfluence = e.attention * sourceRisk;
      const statusColor = sourceRisk >= 80 ? STATUS_COLORS.Critical 
                        : sourceRisk >= 60 ? STATUS_COLORS.High 
                        : sourceRisk >= 40 ? STATUS_COLORS.Moderate 
                        : sourceRisk >= 20 ? STATUS_COLORS.Low 
                        : STATUS_COLORS.Safe;

      let strokeColor = statusColor;
      const isFuture = timeIdx > 0;
      const glowEffect = isFuture && dynamicInfluence > 15;
      
      if (currentAttentionMode === 'attention') {
         if (e.attention > 0.6) { strokeColor = "#a855f7"; }
         else if (e.attention > 0.2) { strokeColor = "#14b8a6"; }
         else { strokeColor = "#94a3b8"; }
      } else if (currentAttentionMode === 'structural') {
         strokeColor = "#cbd5e1";
      }

      const isAnimated = isFuture && (dynamicInfluence > 15 || e.attention > 0.4);

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: isAnimated,
        label: `infl: ${(Number(dynamicInfluence) || 0).toFixed(1)}`,
        labelStyle: { fill: "#475569", fontWeight: 700, fontSize: 8 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95, rx: 4, ry: 4 },
        style: {
          stroke: strokeColor,
          filter: glowEffect ? `drop-shadow(0 0 4px ${strokeColor})` : 'none',
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
        dynamicInfluence,
        attention: e.attention,
        sourceRisk,
      };
    });

    const topEdges = showAll ? formattedEdges : [...formattedEdges].sort((a, b) => b.attention - a.attention).slice(0, 25);
    const minAttn = topEdges.length > 0 ? Math.min(...topEdges.map(e => e.attention)) : 0;
    const maxAttn = topEdges.length > 0 ? Math.max(...topEdges.map(e => e.attention)) : 1;

    const visualEdges = topEdges.map(e => {
       const ratio = maxAttn > minAttn ? (e.attention - minAttn) / (maxAttn - minAttn) : 1;
       const isFuture = timeIdx > 0;
       
       const sNode = d3Nodes.find(n => n.id === e.source);
       const tNode = d3Nodes.find(n => n.id === e.target);
       const isHiddenEdge = sNode?.data.isHidden || tNode?.data.isHidden;
        
       let edgeOpacity = isHiddenEdge ? 0 : 0.25;
       if (!isHiddenEdge && (e.source === selectedId || e.target === selectedId)) edgeOpacity = 0.8;
       else if (!isHiddenEdge && sComm !== null) {
         if (sNode?.data.communityIdx !== sComm && tNode?.data.communityIdx !== sComm) {
           edgeOpacity = 0.05;
         } else {
           edgeOpacity = 0.45;
         }
       }
       
       if (isHiddenEdge) edgeOpacity = 0;

       return {
         ...e,
         style: {
           ...e.style,
           opacity: edgeOpacity,
           strokeWidth: (1 + ratio * 3) + (isFuture && e.dynamicInfluence > 15 ? 1.5 : 0)
         }
       };
    });

    d3Nodes.forEach(n => {
       const connectedEdges = formattedEdges.filter(e => e.source === n.id || e.target === n.id);
       n.data.degree = connectedEdges.length;
       const connectedIds = connectedEdges.map(e => e.source === n.id ? e.target : e.source);
       n.data.connectedNodes = Array.from(new Set(connectedIds)).map(id => {
          const target = d3Nodes.find(dn => dn.id === id);
          return target ? target.data.label : id;
       });
    });

    const rankedConnections = [...formattedEdges].sort((a, b) => b.dynamicInfluence - a.dynamicInfluence);
    setTopConnections(rankedConnections);

    const totalCommunities = Math.max(1, data?.communities?.length || 4);
    const radius = 400;
    const d3Links = formattedEdges.map((e: any) => ({ ...e }));
    const needsLayout = Object.keys(layoutPositions.current).length === 0;

    if (needsLayout) {
      const simulation = d3.forceSimulation(d3Nodes)
        .force("charge", d3.forceManyBody().strength(-250))
        .force("collide", d3.forceCollide(40).iterations(4))
        .force("x", d3.forceX((d: any) => Math.cos((d.data.communityIdx / totalCommunities) * Math.PI * 2) * radius).strength(0.3))
        .force("y", d3.forceY((d: any) => Math.sin((d.data.communityIdx / totalCommunities) * Math.PI * 2) * radius).strength(0.3))
        .force("link", d3.forceLink(d3Links).id((d: any) => d.id).distance(120).strength(0.2))
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
         const isConnected = formattedEdges.some((e:any) => (e.source === selectedId && e.target === n.id) || (e.target === selectedId && e.source === n.id));
         opacity = (isSelected || isConnected) ? 1 : 0.15;
         zIndex = isSelected ? 50 : isConnected ? 40 : 10;
      } else if (sComm !== null) {
         opacity = n.data.communityIdx === sComm ? 1 : 0.25;
         zIndex = n.data.communityIdx === sComm ? 20 : 10;
      }

      let pointerEvents = 'auto';
      if (n.data.isHidden) { opacity = 0; pointerEvents = 'none'; }

      return {
        id: n.id,
        type: "entityNode",
        position: pos,
        data: n.data,
        style: { opacity, zIndex, pointerEvents, transition: 'all 0.5s ease' },
      };
    });

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
    (data?.communities || []).forEach((_: any, i: number) => {
      const bounds = communityBounds[i];
      if (bounds) {
        if (!vTypes.basin) return;
        if (sComm !== null && i !== sComm) return;
        const padding = 70;
        communityBgNodes.push({
          id: `community-bg-${i}`,
          type: "clusterBackground",
          position: { x: bounds.minX - padding, y: bounds.minY - padding - 30 },
          data: { 
            width: (bounds.maxX - bounds.minX) + padding * 2 + 140, 
            height: (bounds.maxY - bounds.minY) + padding * 2 + 50, 
            color: COMMUNITY_COLORS[i % COMMUNITY_COLORS.length],
            clusterNum: i + 1
          },
          zIndex: -1
        });
      }
    });

    const cleanEdges = visualEdges.map((e: any) => ({
      ...e,
      source: typeof e.source === "object" ? e.source.id : String(e.source),
      target: typeof e.target === "object" ? e.target.id : String(e.target),
      style: { ...(e.style || {}), transition: 'all 0.5s ease' }
    }));

    setNodes([...communityBgNodes, ...finalNodes]);
    setEdges(cleanEdges);
  }, [setNodes, setEdges, data?.communities, zoomLevel]);

  useEffect(() => {
    if (data?.nodes && data?.edges && data?.communities && !isError) {
      updateGraphLayout(data.nodes, data.edges, timeIndex, selectedNode?.id, showAllEdges, attentionMode, visibleTypes, selectedCommunity, zoomLevel);
    }
  }, [data, timeIndex, updateGraphLayout, selectedNode?.id, showAllEdges, attentionMode, visibleTypes, selectedCommunity, zoomLevel]);

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
    if (node.type === "entityNode") {
      setSelectedNode(node.data);
    }
  }, []);



  useEffect(() => {
    if (isPlaying) {
      playInterval.current = setInterval(() => {
        setTimeIndex((prev) => {
          if (prev >= 6) {
            setIsPlaying(false);
            return 6;
          }
          return prev + 1;
        });
      }, 1500);
    } else {
      if (playInterval.current) clearInterval(playInterval.current);
    }
    return () => { if (playInterval.current) clearInterval(playInterval.current); };
  }, [isPlaying]);

  useEffect(() => {
    if (selectedCommunity !== null && rfInstance && data?.nodes) {
      const communityNodeIds = data?.nodes
        .filter((n: any) => data?.communities?.[selectedCommunity]?.includes(n.id))
        .map((n: any) => n.id) || [];
      const visibleNodes = rfInstance.getNodes().filter((n: any) => communityNodeIds.includes(n.id) || n.id === `community-bg-${selectedCommunity}`);
      if (visibleNodes.length > 0) rfInstance.fitView({ nodes: visibleNodes, duration: 800, padding: 0.2 });
    } else if (rfInstance) {
      rfInstance.fitView({ duration: 800, padding: 0.2 });
    }
  }, [selectedCommunity, rfInstance, data]);

  const activeNodes = useMemo(() => {
    if (!data?.nodes) return [];
    return data.nodes.filter((n: any) => {
      const typeStr = n.type === "river" || n.id?.startsWith("rv-") ? "river" :
                      n.type === "weather_station" || n.id?.startsWith("ws-") ? "weather_station" :
                      n.type === "reservoir" || n.id?.startsWith("rs-") || n.id?.startsWith("dam-") ? "reservoir" : "district";
      if (!visibleTypes[typeStr as keyof typeof visibleTypes]) return false;
      if (selectedCommunity !== null && ((data?.communities || []).findIndex((c: string[]) => c.includes(n.id)) !== selectedCommunity)) return false;
      return true;
    });
  }, [data, visibleTypes, selectedCommunity]);

  const activeEdges = useMemo(() => {
    if (!data?.edges) return [];
    const activeIds = new Set(activeNodes.map((n: any) => n.id));
    return data.edges.filter((e: any) => activeIds.has(e.source) && activeIds.has(e.target));
  }, [data, activeNodes]);

  const dynDensity = selectedCommunity !== null && activeNodes.length > 1 ? (activeEdges.length / (activeNodes.length * (activeNodes.length - 1))) : (data?.stats?.density || 0);
  const dynAvgDegree = selectedCommunity !== null && activeNodes.length > 0 ? (activeEdges.length / activeNodes.length) : (data?.stats?.avg_degree || 0);
  const dynClust = selectedCommunity !== null ? (data?.stats?.clustering_coefficient || 0) : (data?.stats?.clustering_coefficient || 0);
  const dynNodes = selectedCommunity !== null ? activeNodes.length : (data?.stats?.total_nodes || 0);
  const dynEdges = selectedCommunity !== null ? activeEdges.length : (data?.stats?.total_edges || 0);

  if (!data?.nodes?.length || isError) {
    if (showSkeleton && !isError) {
      // Skeleton while loading (max 3s)
      return (
        <div className="flex h-[80vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <Activity className="w-8 h-8 text-violet-500 animate-pulse mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-800">Loading Graph Engine...</h2>
            <p className="text-sm text-slate-500">Constructing the node topology from live data.</p>
          </div>
        </div>
      );
    }
    // Empty/error state after 3s or on explicit error
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <X className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-heading font-bold text-slate-800">
            {isError ? "Knowledge Graph Unavailable" : "No Graph Data"}
          </h2>
          <p className="text-sm text-slate-500">
            {isError ? "The graph engine could not load topology data." : "Graph data is not available yet. The backend may still be starting up."}
          </p>
          <button onClick={() => forceRetry()} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold shadow-md transition-all">
            <RefreshCw className="w-4 h-4 inline mr-2" /> Force Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 h-[calc(100vh-6rem)] pb-6 flex flex-col">
      {/* Top Header Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Network className="w-6 h-6 text-violet-600" /> Dynamic Knowledge Graph Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">How flood risk spreads between districts in Tamil Nadu.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs font-semibold shadow-sm">
            <div className={`w-2 h-2 rounded-full ${dashboardStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            Last Sync: {dashboardStatus === 'connected' ? relativeSyncTime : "Disconnected"}
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {["structural", "attention", "risk"].map(m => (
              <button key={m} onClick={() => setAttentionMode(m as any)} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${attentionMode === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{m.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={handleExportPNG} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 min-h-0 overflow-y-auto">
          <div className="glass-card p-5 space-y-4 shrink-0 shadow-md">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-3">Graph Structural Metrics</h2>
            <div className="flex flex-col gap-3">
              {[
                { label: "Graph Density", value: dynDensity, type: "float" },
                { label: "Avg Degree", value: dynAvgDegree, type: "float" },
                { label: "Clustering Coeff", value: dynClust, type: "float" },
                { label: "Total Nodes", value: dynNodes, type: "int" },
                { label: "Total Edges", value: dynEdges, type: "int" },
              ].map(({ label, value, type }) => (
                <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between"><p className="text-[10px] text-slate-500 font-bold uppercase">{label}</p><p className="text-sm font-bold text-slate-800">{type === "int" ? value : (value || 0).toFixed(3)}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 glass-card overflow-hidden relative flex flex-col border border-slate-200 shadow-lg rounded-2xl bg-white h-[640px]">
          <div className="flex-1 min-h-0 bg-slate-50 relative" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges.filter((e: any) => (e.style?.opacity ?? 1) > 0)}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onMove={handleMove}
              nodeTypes={nodeTypes}
              onInit={setRfInstance}
              fitView
              minZoom={0.05}
              maxZoom={2}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>

          <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-4 shrink-0">
            <button 
              onClick={() => {
                const nextState = !isPlaying;
                setIsPlaying(nextState);
                if (nextState && attentionMode !== "risk") setAttentionMode("risk");
              }} 
              className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors shadow-md"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <input type="range" min="0" max="6" value={timeIndex} onChange={(e) => setTimeIndex(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600" />
            <span className="text-xs font-bold text-slate-600 font-mono">{TIME_WINDOWS[timeIndex].label}</span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 min-h-0">
          <div className="glass-card p-5 flex-1 flex flex-col min-h-0 shadow-md">
            <h2 className="text-sm font-bold text-slate-800 pb-3">Basin Communities</h2>
            <div className="overflow-y-auto space-y-3 flex-1">
              {COMMUNITY_NAMES.map((name, i) => {
                const isActive = selectedCommunity === i;
                const color = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length];
                
                const communities = data?.communities ?? [];
                const nodesData = data?.nodes ?? [];
                const comm = communities[i] ?? [];

                const districts = comm
                  .filter((id: string) => id.startsWith("d-"))
                  .map((id: string) => {
                    const node = nodesData.find((n: any) => n.id === id);
                    return node?.label ?? "";
                  })
                  .filter(Boolean);

                if (districts.length === 0) return null;
                const containsSelectedNode = selectedNode && comm.includes(selectedNode.id);

                return (
                  <div key={i} className={`bg-white border p-3 rounded-xl hover:shadow-md transition-all relative overflow-hidden cursor-pointer group ${isActive || containsSelectedNode ? 'border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)] ring-2 ring-violet-300' : 'border-slate-200 opacity-80 hover:opacity-100'}`}
                       onClick={() => setSelectedCommunity(isActive ? null : i)}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2" style={{ backgroundColor: color }} />
                    <div className="flex justify-between items-center mb-2 pl-2">
                      <span className="text-xs font-bold text-slate-700">{name} Basin</span>
                      <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                        {districts.length} Dist.
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 font-heading">
                  <TrendingUp className="w-4 h-4 text-amber-500" /> Connections
                </h2>
                {selectedNode && <span className="text-[10px] text-violet-600 font-bold bg-violet-50 px-1.5 py-0.5 rounded truncate max-w-[100px]">{selectedNode.label}</span>}
              </div>
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
                  {topConnections
                    .filter((e: any) => {
                      if (selectedNode) return e.source === selectedNode.id || e.target === selectedNode.id;
                      if (selectedCommunity !== null && data?.nodes && data?.communities) {
                        const commIds = data.communities[selectedCommunity] || [];
                        return commIds.includes(e.source) || commIds.includes(e.target);
                      }
                      return true;
                    })
                    .sort((a: any, b: any) => (b.attention || 0) - (a.attention || 0))
                    .slice(0, 25)
                    .map((edge: any, i: number) => {
                    const sourceNode = (data?.nodes || []).find((n: any) => n.id === edge.source);
                    const targetNode = (data?.nodes || []).find((n: any) => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;

                    return (
                      <tr key={i} className="border-b border-slate-200 hover:bg-white transition-colors">
                        <td className="p-3 font-semibold break-words max-w-[90px] leading-tight">{normalizeEntityName(sourceNode.label, sourceNode.id)}</td>
                        <td className="p-3 font-semibold break-words max-w-[90px] leading-tight text-slate-500">{normalizeEntityName(targetNode.label, targetNode.id)}</td>
                        <td className="p-3 text-right font-mono text-slate-500">{(edge.attention || 0).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-amber-600 font-bold">{(Number(edge.dynamicInfluence) || 0).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>



    </div>
  );
}
