"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  NodeTypes, Handle, Position, MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { Network, MapPin, Waves, Shield, CloudRain, RefreshCw, Activity, ArrowRight } from "lucide-react";

const TYPE_STYLES: Record<string, { bg: string; border: string; text: string; icon: any; emoji: string }> = {
  district:        { bg: "#f5f3ff", border: "#a78bfa", text: "#6d28d9", icon: MapPin,   emoji: "🏙" },
  river:           { bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", icon: Waves,    emoji: "🌊" },
  reservoir:       { bg: "#e0f2fe", border: "#38bdf8", text: "#0369a1", icon: Shield,   emoji: "💧" },
  weather_station: { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", icon: CloudRain, emoji: "🌤" },
};

const RISK_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Moderate: "#f59e0b",
  Safe: "#3b82f6",
};

// Custom Node for ReactFlow
function KGNode({ data }: { data: any }) {
  const style = TYPE_STYLES[data.type] || TYPE_STYLES.district;
  const riskColor = data.risk_score > 70 ? RISK_COLORS.Critical : data.risk_score > 50 ? RISK_COLORS.High : data.risk_score > 30 ? RISK_COLORS.Moderate : RISK_COLORS.Safe;
  const isPulsing = data.isPropagating || data.risk_score > 60;

  return (
    <div className="group flex flex-col items-center" style={{ minWidth: 90 }}>
      <Handle type="target" position={Position.Top} className="opacity-0 transition-opacity" />
      <motion.div
        animate={isPulsing ? { scale: [1, 1.05, 1], boxShadow: `0 0 15px ${riskColor}80` } : {}}
        transition={isPulsing ? { duration: 1.5, repeat: Infinity } : {}}
        className="rounded-2xl border-2 px-3 py-2 cursor-pointer transition-colors duration-1000 bg-white"
        style={{
          borderColor: riskColor,
          backgroundColor: data.risk_score > 50 ? `${riskColor}10` : '#ffffff',
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-base">{style.emoji}</span>
          {data.risk_score > 0 && (
            <div className="w-2 h-2 rounded-full transition-colors duration-1000" style={{ background: riskColor }} />
          )}
        </div>
        <p className="text-[11px] font-bold leading-tight" style={{ color: style.text }}>
          {data.label}
        </p>
        <p className="text-[9px] capitalize mt-0.5 font-mono" style={{ color: style.text, opacity: 0.7 }}>
          {data.type.replace("_", " ")}
        </p>
        {data.risk_score > 0 && (
          <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1 overflow-hidden">
            <motion.div
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${data.risk_score}%`, backgroundColor: riskColor }}
              transition={{ duration: 1 }}
            />
          </div>
        )}
      </motion.div>
      <Handle type="source" position={Position.Bottom} className="opacity-0 transition-opacity" />
    </div>
  );
}

const nodeTypes: NodeTypes = { kgNode: KGNode };

export default function KnowledgeGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["kg", "graph"],
    queryFn: async () => (await api.get("/kg/graph")).data,
  });

  useEffect(() => {
    if (data) {
      // Build Layout
      const typePositions: Record<string, { x: number; y: number }> = {
        weather_station: { x: 0, y: 0 },
        reservoir: { x: 600, y: 0 },
        river: { x: 300, y: 250 },
        district: { x: 150, y: 520 },
      };

      const typeCount: Record<string, number> = {};
      const newNodes = data.nodes.map((n: any) => {
        const typePos = typePositions[n.type] || { x: 200, y: 400 };
        const count = typeCount[n.type] || 0;
        typeCount[n.type] = count + 1;

        return {
          id: n.id,
          type: "kgNode",
          position: {
            x: typePos.x + (count * 150) - (n.type === "district" ? 300 : 0),
            y: typePos.y + (count % 2 === 0 ? 0 : 40),
          },
          data: { ...n, isPropagating: false },
        };
      });

      const newEdges = data.edges.map((e: any) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        animated: e.animated || true,
        label: e.type,
        labelStyle: { fill: "#64748b", fontWeight: 700, fontSize: 10 },
        labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.8 },
        style: { stroke: "#cbd5e1", strokeWidth: 2, transition: 'stroke 1s, stroke-width 1s' },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#cbd5e1" },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [data, setNodes, setEdges]);

  // Simulation Logic: Rainfall spike propagates through the graph
  const triggerPropagation = () => {
    if (isSimulating) return;
    setIsSimulating(true);

    // Step 1: Weather Stations spike
    setTimeout(() => {
      setNodes((nds) => nds.map((n) => n.data.type === "weather_station" ? { ...n, data: { ...n.data, risk_score: 85, isPropagating: true } } : n));
      setEdges((eds) => eds.map((e) => e.source.startsWith("w_") ? { ...e, style: { stroke: RISK_COLORS.Critical, strokeWidth: 4 } } : e));
    }, 1000);

    // Step 2: Rivers swell
    setTimeout(() => {
      setNodes((nds) => nds.map((n) => n.data.type === "river" ? { ...n, data: { ...n.data, risk_score: 75, isPropagating: true } } : n));
      setEdges((eds) => eds.map((e) => e.source.startsWith("r_") ? { ...e, style: { stroke: RISK_COLORS.High, strokeWidth: 4 } } : e));
    }, 2500);

    // Step 3: Districts flood
    setTimeout(() => {
      setNodes((nds) => nds.map((n) => n.data.type === "district" ? { ...n, data: { ...n.data, risk_score: 82, isPropagating: true } } : n));
    }, 4000);

    // Reset
    setTimeout(() => {
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, risk_score: Math.max(10, n.data.risk_score - 40), isPropagating: false } })));
      setEdges((eds) => eds.map((e) => ({ ...e, style: { stroke: "#cbd5e1", strokeWidth: 2 } })));
      setIsSimulating(false);
    }, 8000);
  };

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  if (isLoading || !nodes.length) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] pb-6 flex flex-col">
      <div className="flex justify-between items-end flex-shrink-0">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-800">Dynamic Knowledge Graph</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time semantic topology and risk propagation</p>
        </div>
        <button
          onClick={triggerPropagation}
          disabled={isSimulating}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-violet-600 transition-colors disabled:opacity-50"
        >
          {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          {isSimulating ? "Propagating Risk..." : "Simulate Rainfall Spike"}
        </button>
      </div>

      <div className="flex-1 glass-card overflow-hidden relative border border-slate-200 shadow-xl rounded-2xl flex">
        {/* ReactFlow Canvas */}
        <div className="flex-1 h-full bg-[#f8fafc]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.5}
            maxZoom={2}
          >
            <Background color="#cbd5e1" gap={20} size={2} />
            <Controls className="bg-white border-slate-200 shadow-md" />
            <MiniMap className="border border-slate-200 rounded-xl" />
          </ReactFlow>
        </div>

        {/* Selected Node Details Sidebar */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-80 bg-white/95 backdrop-blur-md border-l border-slate-200 p-6 flex flex-col h-full shadow-2xl z-10"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                    {selectedNode.type.replace("_", " ")} NODE
                  </span>
                  <h3 className="text-xl font-heading font-bold text-slate-800 mt-1">{selectedNode.label}</h3>
                </div>
                <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-slate-100 rounded-full">
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1 font-semibold">Inferred Risk Score</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold font-mono text-slate-800">{selectedNode.risk_score.toFixed(0)}</span>
                    <span className="text-xs text-slate-400 mb-1.5">/ 100</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Node Influence</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    This node acts as a primary feature vector in the GDNN model. 
                    Changes in its state dynamically propagate attention weights to connected {selectedNode.type === 'river' ? 'districts' : 'downstream entities'}.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
