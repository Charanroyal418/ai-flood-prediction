import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Settings</h1>
        <p className="text-slate-500 font-medium">System configuration and user preferences</p>
      </div>
      <div className="glass-card rounded-xl p-6 min-h-[500px] flex items-center justify-center bg-white/80 border border-slate-200/60 shadow-sm">
        <div className="text-center">
          <Settings className="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50" />
          <p className="text-slate-500 text-lg">Settings Panel Coming Soon</p>
        </div>
      </div>
    </div>
  );
}
