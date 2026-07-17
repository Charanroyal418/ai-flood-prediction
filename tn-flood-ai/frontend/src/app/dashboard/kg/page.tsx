"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Network, ServerOff } from "lucide-react";
import { useMemo, useState } from "react";

export default function KnowledgeGraphPage() {
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["knowledgeGraph"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/kg/graph");
      return res.data;
    },
  });

  // Calculate static layout positions to avoid physics simulation overhead
  const { nodes, links } = useMemo(() => {
    if (!data || !data.nodes) return { nodes: [], links: [] };
    
    const width = 800;
    const height = 600;
    const cx = width / 2;
    const cy = height / 2;
    
    const rivers = data.nodes.filter((n: any) => n.type === "River");
    const districts = data.nodes.filter((n: any) => n.type === "District");
    
    const positionedNodes = data.nodes.map((node: any) => {
      let angle = 0;
      let r = 0;
      
      if (node.type === "River") {
        const idx = rivers.findIndex((n: any) => n.id === node.id);
        angle = (idx / Math.max(1, rivers.length)) * 2 * Math.PI;
        r = 120; // Inner circle
      } else {
        const idx = districts.findIndex((n: any) => n.id === node.id);
        angle = (idx / Math.max(1, districts.length)) * 2 * Math.PI;
        r = 280; // Outer circle
      }
      
      return {
        ...node,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      };
    });

    const positionedLinks = data.links.map((link: any) => {
      const sourceNode = positionedNodes.find((n: any) => n.id === link.source);
      const targetNode = positionedNodes.find((n: any) => n.id === link.target);
      return {
        ...link,
        sourceNode,
        targetNode
      };
    }).filter((l: any) => l.sourceNode && l.targetNode);

    return { nodes: positionedNodes, links: positionedLinks };
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Knowledge Graph Viewer</h1>
        <p className="text-slate-500 font-medium">Explore topological relationships between rivers, dams, and districts.</p>
      </div>

      <div className="glass-card rounded-xl bg-white/80 border border-slate-200/60 shadow-sm relative overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10">
            <Network className="w-16 h-16 text-blue-500 mb-4 animate-pulse opacity-50" />
            <p className="text-slate-500 text-lg font-bold animate-pulse">Connecting to Graph Database...</p>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10">
            <ServerOff className="w-16 h-16 text-rose-500 mb-4 opacity-50" />
            <p className="text-rose-600 text-lg font-bold">Failed to connect to Knowledge Graph</p>
          </div>
        )}

        {/* SVG Graph Area */}
        <div className="flex-1 relative overflow-auto bg-slate-50">
          <svg width={800} height={600} className="mx-auto" style={{ minWidth: 800, minHeight: 600 }}>
            {/* Draw Links */}
            {links.map((link: any, i: number) => (
              <g key={`link-${i}`}>
                <line 
                  x1={link.sourceNode.x} 
                  y1={link.sourceNode.y} 
                  x2={link.targetNode.x} 
                  y2={link.targetNode.y} 
                  stroke={selectedNode && (selectedNode.id === link.source || selectedNode.id === link.target) ? "#3b82f6" : "#cbd5e1"} 
                  strokeWidth={selectedNode && (selectedNode.id === link.source || selectedNode.id === link.target) ? 3 : 1}
                  className="transition-all duration-300"
                />
              </g>
            ))}

            {/* Draw Nodes */}
            {nodes.map((node: any) => (
              <g 
                key={node.id} 
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNode(node)}
                className="cursor-pointer transition-transform duration-300 hover:scale-110"
              >
                <circle 
                  r={node.type === "River" ? 25 : 35} 
                  fill={node.type === "River" ? "#eff6ff" : "#f0fdf4"} 
                  stroke={node.type === "River" ? "#3b82f6" : "#22c55e"} 
                  strokeWidth={selectedNode?.id === node.id ? 4 : 2}
                  className="transition-all duration-300 shadow-xl"
                />
                <text 
                  textAnchor="middle" 
                  dy={node.type === "River" ? 40 : 55}
                  className="text-xs font-bold fill-slate-700 select-none"
                >
                  {node.name}
                </text>
                <text 
                  textAnchor="middle" 
                  dy={4}
                  className="text-[10px] font-bold fill-slate-500 select-none"
                >
                  {node.type}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Info Panel */}
        <div className="w-full md:w-80 bg-white border-l border-slate-200 p-6 flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Network className="w-5 h-5 mr-2 text-blue-500" />
            Node Inspector
          </h2>
          
          {selectedNode ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase">Entity Name</p>
                <p className="text-xl font-bold text-slate-800">{selectedNode.name}</p>
                <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-bold ${selectedNode.type === 'River' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {selectedNode.type}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-700 border-b pb-2">Properties</h3>
                {Object.entries(selectedNode).map(([key, value]) => {
                  if (['id', 'name', 'type', 'x', 'y', 'val', 'group'].includes(key)) return null;
                  return (
                    <div key={key} className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 capitalize">{key.replace('_', ' ')}</span>
                      <span className="font-bold text-slate-800">{typeof value === 'number' ? value.toLocaleString(undefined, {maximumFractionDigits: 2}) : String(value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center">
              <Network className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Click on a node in the graph to view its telemetry and topological properties.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
