"use client";

import dynamic from 'next/dynamic';

const FloodMap = dynamic(() => import('@/components/map/FloodMap'), { 
  ssr: false,
  loading: () => <div className="h-[700px] w-full rounded-xl glass-card animate-pulse border border-slate-200 flex items-center justify-center text-slate-500 font-medium">Loading Map...</div>
});

export default function MapPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Live Interactive Map</h1>
        <p className="text-slate-500 font-medium">Real-time geographical telemetry and flood risk visualization</p>
      </div>
      <div className="glass-card rounded-xl p-1 relative overflow-hidden h-[700px]">
        <FloodMap />
      </div>
    </div>
  );
}
