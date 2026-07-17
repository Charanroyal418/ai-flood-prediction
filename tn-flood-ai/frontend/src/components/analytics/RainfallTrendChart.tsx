"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export function RainfallTrendChart() {
  const { data: trendData, isLoading } = useQuery({
    queryKey: ['rainfallTrend'],
    queryFn: async () => {
      // Fetching mock trend for MVP if real historical endpoint isn't fully populated
      try {
        const res = await axios.get('http://localhost:8000/api/v1/ml/trends');
        return res.data;
      } catch {
        return [
          { day: 'Mon', rainfall: 45 },
          { day: 'Tue', rainfall: 82 },
          { day: 'Wed', rainfall: 150 },
          { day: 'Thu', rainfall: 210 },
          { day: 'Fri', rainfall: 180 },
          { day: 'Sat', rainfall: 90 },
          { day: 'Sun', rainfall: 30 },
        ];
      }
    },
    refetchInterval: 300000 // 5 minutes
  });

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">7-Day Rainfall Trend (mm)</h3>
      </div>
      <div className="flex-1">
        <div className="h-[300px] w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-500">Loading trends...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', borderRadius: '8px' }}
                  itemStyle={{ color: '#3b82f6' }}
                />
                <Area type="monotone" dataKey="rainfall" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRain)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
