"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Route, MapPin, Search } from "lucide-react";
import { useState } from "react";

export default function DistrictIntelligencePage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Since we don't have a specific API endpoint for districts yet, we'll fetch from the unified live endpoint
  const { data, isLoading } = useQuery({
    queryKey: ["districtIntelligence"],
    queryFn: async () => {
      // Assuming a generic district endpoint or we can mock it here based on what's available
      return [
        { id: 1, name: "Chennai", population: 7000000, area_sqkm: 426, risk_status: "High", last_flood: "2023-12-05" },
        { id: 2, name: "Cuddalore", population: 2600000, area_sqkm: 3703, risk_status: "Moderate", last_flood: "2015-11-15" },
        { id: 3, name: "Kancheepuram", population: 3900000, area_sqkm: 4432, risk_status: "Low", last_flood: "2015-12-01" },
        { id: 4, name: "Tiruvallur", population: 3700000, area_sqkm: 3422, risk_status: "Moderate", last_flood: "2023-12-05" },
        { id: 5, name: "Thoothukudi", population: 1700000, area_sqkm: 4700, risk_status: "Severe", last_flood: "2023-12-18" },
      ];
    },
  });

  const filteredDistricts = data?.filter((d: any) => d.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">District Intelligence</h1>
          <p className="text-slate-500 font-medium">Hyper-local vulnerability profiles and demographic exposure.</p>
        </div>
        <div className="relative">
           <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
           <input 
             type="text" 
             placeholder="Search districts..." 
             className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card rounded-xl p-6 min-h-[400px] flex items-center justify-center border border-slate-200/60 bg-white/80">
          <Route className="w-12 h-12 text-blue-500 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {filteredDistricts?.map((district: any) => (
               <div key={district.id} className="glass-card p-6 rounded-xl bg-white/80 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mr-3">
                           <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                           <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{district.name}</h3>
                           <p className="text-xs text-slate-500 uppercase tracking-wider">{district.area_sqkm} sq km</p>
                        </div>
                     </div>
                     <span className={`px-2 py-1 rounded text-xs font-bold ${
                         district.risk_status === 'Severe' ? 'bg-red-100 text-red-700' : 
                         district.risk_status === 'High' ? 'bg-orange-100 text-orange-700' : 
                         district.risk_status === 'Moderate' ? 'bg-yellow-100 text-yellow-700' : 
                         'bg-emerald-100 text-emerald-700'
                     }`}>
                        {district.risk_status} RISK
                     </span>
                  </div>
                  
                  <div className="space-y-3 border-t border-slate-100 pt-4 mt-4">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Population Exposure</span>
                        <span className="font-bold text-slate-800">{(district.population / 1000000).toFixed(1)}M</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Last Major Event</span>
                        <span className="font-bold text-slate-800">{district.last_flood}</span>
                     </div>
                  </div>
               </div>
           ))}
           
           {filteredDistricts?.length === 0 && (
               <div className="col-span-full py-12 text-center text-slate-500">
                  No districts found matching "{searchTerm}"
               </div>
           )}
        </div>
      )}
    </div>
  );
}
