import { Route } from "lucide-react";

export default function RoutingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Safe Route & Shelters</h1>
        <p className="text-slate-500 font-medium">Identify unflooded paths and nearest disaster relief shelters.</p>
      </div>
      <div className="glass-card rounded-xl p-6 min-h-[500px] flex flex-col items-center justify-center bg-white/80 border border-slate-200/60 shadow-sm">
        <Route className="w-16 h-16 text-blue-500 mb-4 opacity-50" />
        <p className="text-slate-500 text-lg">Calculating Safe Routes...</p>
      </div>
    </div>
  );
}
