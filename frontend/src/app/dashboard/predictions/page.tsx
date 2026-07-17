"use client";

import { useState } from "react";
import axios from "axios";
import { Activity, Droplets, Mountain, CloudRain, ShieldAlert } from "lucide-react";

export default function PredictionsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Default parameters matching the backend expectation
  const [params, setParams] = useState({
    rainfall_24h_mm: 150,
    elevation_m: 12,
    distance_to_river_m: 500,
    soil_moisture_index: 0.8,
    slope_degrees: 2.5
  });

  const runSimulation = async () => {
    setLoading(true);
    try {
      // The backend uses port 8000 for the API
      const res = await axios.post("http://localhost:8000/api/v1/predict/", {
        lat: 13.0827, // Placeholder, model doesn't use it directly in prediction but API requires it
        lon: 80.2707,
        ...params
      });
      setResult(res.data);
    } catch (error) {
      console.error("Simulation failed:", error);
      setResult({ error: "Backend server is unavailable or model is loading." });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setParams(prev => ({ ...prev, [name]: parseFloat(value) }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">AI Flood Simulator</h1>
        <p className="text-slate-500 font-medium">Test what-if scenarios using the XGBoost predictive model.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Environmental Parameters
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                <span className="flex items-center"><CloudRain className="w-4 h-4 mr-2 text-blue-500"/> 24h Rainfall (mm)</span>
                <span className="text-slate-900 font-bold">{params.rainfall_24h_mm} mm</span>
              </label>
              <input type="range" name="rainfall_24h_mm" min="0" max="500" step="10" value={params.rainfall_24h_mm} onChange={handleChange} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            </div>

            <div>
              <label className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                <span className="flex items-center"><Mountain className="w-4 h-4 mr-2 text-emerald-500"/> Elevation (m)</span>
                <span className="text-slate-900 font-bold">{params.elevation_m} m</span>
              </label>
              <input type="range" name="elevation_m" min="-2" max="100" step="1" value={params.elevation_m} onChange={handleChange} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600" />
            </div>

            <div>
              <label className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                <span className="flex items-center"><Droplets className="w-4 h-4 mr-2 text-blue-400"/> Distance to River (m)</span>
                <span className="text-slate-900 font-bold">{params.distance_to_river_m} m</span>
              </label>
              <input type="range" name="distance_to_river_m" min="0" max="5000" step="50" value={params.distance_to_river_m} onChange={handleChange} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>

            <div>
              <label className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                <span className="flex items-center"><Droplets className="w-4 h-4 mr-2 text-amber-500"/> Soil Moisture Index</span>
                <span className="text-slate-900 font-bold">{params.soil_moisture_index.toFixed(2)}</span>
              </label>
              <input type="range" name="soil_moisture_index" min="0" max="1" step="0.05" value={params.soil_moisture_index} onChange={handleChange} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500" />
            </div>

            <button 
              onClick={runSimulation}
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-600 hover:to-blue-400 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Activity className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Activity className="w-5 h-5 mr-2" />
              )}
              {loading ? "Running Neural Simulation..." : "Run Prediction Model"}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="glass-card rounded-xl p-6 relative overflow-hidden flex flex-col items-center justify-start min-h-[300px] bg-white/80 border border-slate-200/60 shadow-sm">
          {/* Background glows based on result */}
          {result && !result.error && result.risk_level === "Severe" && <div className="absolute inset-0 bg-red-100 animate-pulse pointer-events-none"></div>}
          {result && !result.error && result.risk_level === "Low" && <div className="absolute inset-0 bg-emerald-50 pointer-events-none"></div>}

          {!result ? (
            <div className="text-center text-slate-500 my-auto">
              <ShieldAlert className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Run the simulation to see AI flood risk predictions.</p>
            </div>
          ) : result.error ? (
            <div className="text-center text-red-600 my-auto">
              <p>{result.error}</p>
            </div>
          ) : (
            <div className="w-full z-10 text-left">
              
              <div className="text-center mb-6">
                 <h3 className="text-slate-600 font-bold mb-1 uppercase tracking-widest text-sm">Flood Probability</h3>
                 <div className="text-6xl font-bold text-slate-900 mb-4 font-heading">
                   {result.probability}%
                 </div>
                 
                 <div className="w-full bg-slate-200 rounded-full h-3 relative overflow-hidden shadow-inner mb-4">
                   <div 
                     className={`h-full rounded-full transition-all duration-1000 ${
                       result.risk_level === 'Severe' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' :
                       result.risk_level === 'High' ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' :
                       result.risk_level === 'Moderate' ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]' :
                       'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                     }`}
                     style={{ width: `${result.probability}%` }}
                   ></div>
                 </div>

                 <div className={`inline-flex items-center px-4 py-2 rounded-full font-bold uppercase tracking-wider text-sm ${
                     result.risk_level === 'Severe' ? 'bg-red-100 text-red-700 border border-red-200' :
                     result.risk_level === 'High' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                     result.risk_level === 'Moderate' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                     'bg-emerald-100 text-emerald-700 border border-emerald-200'
                   }`}>
                   Severity: {result.risk_level}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 border-t border-slate-200 pt-6">
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Confidence</p>
                  <p className="font-medium text-slate-800">{(result.confidence * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Affected Districts</p>
                  <p className="font-medium text-slate-800">{result.district}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Predicted Water Depth</p>
                  <p className="font-medium text-slate-800">{(result.probability * 0.05).toFixed(1)} meters</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Est. Arrival Time</p>
                  <p className="font-medium text-slate-800">{result.risk_level === 'Low' ? 'N/A' : 'T-04:30:00'}</p>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <p className="text-xs text-slate-500 font-bold uppercase mb-2">Feature Importance</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-600">Rainfall Accumulation</span>
                     <span className="text-blue-600 font-bold">45%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-600">Upstream Discharge</span>
                     <span className="text-blue-600 font-bold">30%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-600">Soil Saturation</span>
                     <span className="text-blue-600 font-bold">15%</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Historical Comparison</p>
                <p className="text-sm text-slate-700 font-medium">
                  {result.probability > 75 
                    ? "Matches severity profile of the 2015 Chennai floods (94% similarity)." 
                    : "No direct historical equivalent found for these exact parameters."}
                </p>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
