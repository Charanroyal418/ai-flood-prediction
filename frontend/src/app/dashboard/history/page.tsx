import { History } from "lucide-react";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Historical Floods</h1>
        <p className="text-slate-500 font-medium">Analyze past flood events and patterns across districts.</p>
      </div>
      <div className="glass-card rounded-xl p-6 min-h-[500px] flex flex-col items-center justify-center bg-white/80 border border-slate-200/60 shadow-sm">
        <History className="w-16 h-16 text-blue-500 mb-4 opacity-50" />
        <p className="text-slate-500 text-lg">Loading Historical Data...</p>
      </div>
    </div>
  );
}
