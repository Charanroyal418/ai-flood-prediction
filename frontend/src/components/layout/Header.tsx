"use client";

import { useState, useEffect } from "react";
import { Bell, Search, User, ShieldCheck } from "lucide-react";

export default function Header() {
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    setMounted(true);
    setCurrentDate(
      new Intl.DateTimeFormat("en-US", { 
        weekday: "long", 
        month: "long", 
        day: "numeric", 
        year: "numeric" 
      }).format(new Date())
    );
  }, []);

  return (
    <header className="h-20 border-b border-slate-200 bg-white/70 backdrop-blur-xl flex items-center justify-between px-8 z-30 sticky top-0">
      <div className="flex flex-col">
        <h2 className="text-xl font-heading font-bold text-slate-800 tracking-tight">
          {mounted ? (() => {
            const hour = new Date().getHours();
            if (hour < 12) return "Good morning, Admin";
            if (hour < 18) return "Good afternoon, Admin";
            return "Good evening, Admin";
          })() : "Welcome back, Admin"}
        </h2>
        <div className="flex items-center text-sm text-slate-500 font-medium mt-0.5">
          <span className="text-primary font-bold mr-2">Tamil Nadu Flood Intelligence</span>
          • {mounted ? currentDate : ""}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden lg:flex items-center gap-2 bg-slate-100/80 px-4 py-2 rounded-full border border-slate-200/50">
          <ShieldCheck className="w-4 h-4 text-success" />
          <span className="text-sm font-bold text-slate-600">AI Status: Optimal</span>
        </div>
        
        <div className="hidden lg:flex items-center gap-2 px-4 py-2 text-sm text-slate-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Last Prediction: 2 mins ago
        </div>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold ml-2 border border-slate-200 hover:bg-slate-200 transition-colors">
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
