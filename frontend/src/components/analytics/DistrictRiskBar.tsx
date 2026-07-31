"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function DistrictRiskBar() {
  const { data: riskData, isLoading } = useQuery({
    queryKey: ['districtRisks'],
    queryFn: async () => {
      try {
        const res = await api.get('/predict/active-risks');
        return res.data;
      } catch {
        return [
          { district: 'Chennai', score: 92 },
          { district: 'Cuddalore', score: 85 },
          { district: 'Thoothukudi', score: 78 },
          { district: 'Kancheepuram', score: 65 },
          { district: 'Tiruvallur', score: 45 },
        ];
      }
    },
    refetchInterval: 120000 // 2 minutes
  });

  const getColor = (score: number) => {
    if (score >= 90) return '#ef4444'; // Red
    if (score >= 75) return '#f97316'; // Orange
    if (score >= 50) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">AI Vulnerability Index</h3>
      </div>
      <div className="flex-1">
        <div className="h-[300px] w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-500">Loading AI predictions...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={riskData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" stroke="#64748b" domain={[0, 100]} />
                <YAxis dataKey="district" type="category" stroke="#64748b" width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', borderRadius: '8px' }}
                  cursor={{fill: '#f1f5f9'}}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {riskData?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={getColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
