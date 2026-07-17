"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ShieldAlert, Activity, CheckCircle, Crosshair } from "lucide-react";

export default function PerformancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["modelPerformance"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/dashboard/performance");
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Model Performance</h1>
        <p className="text-slate-500 font-medium">Evaluation metrics for the Graph Dynamic Neural Network (GDNN).</p>
      </div>

      {isLoading ? (
        <div className="glass-card rounded-xl p-6 min-h-[400px] flex items-center justify-center border border-slate-200/60 bg-white/80">
          <Activity className="w-12 h-12 text-blue-500 animate-spin" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Test Accuracy" value={(data.accuracy * 100).toFixed(1) + "%"} icon={<CheckCircle className="w-5 h-5 text-emerald-500" />} />
          <MetricCard title="Precision" value={(data.precision * 100).toFixed(1) + "%"} icon={<Crosshair className="w-5 h-5 text-blue-500" />} />
          <MetricCard title="Recall" value={(data.recall * 100).toFixed(1) + "%"} icon={<Activity className="w-5 h-5 text-indigo-500" />} />
          <MetricCard title="ROC AUC" value={(data.roc_auc).toFixed(3)} icon={<ShieldAlert className="w-5 h-5 text-amber-500" />} />
          
          <div className="md:col-span-2 lg:col-span-4 glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 mt-4">
             <h3 className="text-lg font-bold text-slate-800 mb-4">Confusion Matrix</h3>
             <div className="grid grid-cols-2 gap-4 max-w-sm">
                {data.confusion_matrix?.map((row: number[], i: number) => (
                    row.map((val, j) => (
                       <div key={`${i}-${j}`} className={`p-4 text-center rounded-lg font-bold text-xl ${i===j ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                           {val}
                       </div>
                    ))
                ))}
             </div>
          </div>
        </div>
      ) : (
         <div className="glass-card rounded-xl p-6 text-center text-slate-500 bg-white/80 border border-slate-200/60">
            No metrics available yet. Train the model first.
         </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-slate-500 uppercase">{title}</p>
        <p className="text-3xl font-heading font-bold text-slate-900 mt-1">{value}</p>
      </div>
      <div className="p-3 bg-slate-50 rounded-full border border-slate-100">
        {icon}
      </div>
    </div>
  );
}
