"use client";

import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Brain,
  Network,
  CloudRain,
  Waves,
  MapPin,
  History,
  Bell,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Circle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

const navSections = [
  {
    label: "Intelligence",
    items: [
      { name: "Command Center", href: "/dashboard", icon: LayoutDashboard, description: "Live overview" },
      { name: "AI Prediction Engine", href: "/dashboard/predictions", icon: Brain, description: "GDNN inference" },
      { name: "Knowledge Graph", href: "/dashboard/kg", icon: Network, description: "Graph intelligence" },
    ],
  },
  {
    label: "Telemetry",
    items: [
      { name: "Weather Intelligence", href: "/dashboard/weather", icon: CloudRain, description: "Live weather" },
      { name: "River Intelligence", href: "/dashboard/river", icon: Waves, description: "River levels" },
      { name: "District Analytics", href: "/dashboard/district", icon: MapPin, description: "Per district" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { name: "Historical Intelligence", href: "/dashboard/history", icon: History, description: "Trend analysis" },
      { name: "Alert Center", href: "/dashboard/alerts", icon: Bell, description: "Active alerts", badge: true },
      { name: "System Health", href: "/dashboard/system", icon: Activity, description: "Platform status" },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: liveData } = useQuery({
    queryKey: ["dashboardLive"],
    queryFn: async () => {
      const res = await api.get("/dashboard/live");
      return res.data;
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const alertCount = liveData?.metrics?.active_alerts_count ?? 0;

  if (!mounted) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFBFF]">
      {/* Sidebar */}
      <motion.nav
        animate={{ width: collapsed ? 72 : 272 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="hidden md:flex flex-col h-full bg-white/90 backdrop-blur-xl border-r border-purple-100/60 z-20 relative overflow-hidden"
        style={{ flexShrink: 0 }}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-50/30 via-transparent to-blue-50/20 pointer-events-none" />
        
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-purple-50 relative z-10 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="ml-3 overflow-hidden"
              >
                <p className="text-sm font-heading font-bold text-slate-800 leading-tight whitespace-nowrap">FloodSense AI</p>
                <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Tamil Nadu · GDNN v2</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live status pill */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-4 mt-4 px-3 py-2 rounded-xl bg-green-50 border border-green-100 flex items-center gap-2 relative z-10"
            >
              <div className="relative flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-75" />
              </div>
              <span className="text-[11px] font-semibold text-green-700">Live · All Systems Online</span>
              <Zap className="w-3 h-3 text-green-500 ml-auto" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto no-scrollbar relative z-10">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <AnimatePresence>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >
                    {section.label}
                  </motion.p>
                )}
              </AnimatePresence>

              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={collapsed ? item.name : undefined}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNavIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-gradient-to-b from-violet-500 to-indigo-600 rounded-r-full"
                        transition={{ type: "spring", stiffness: 400, damping: 35 }}
                      />
                    )}

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                      isActive 
                        ? "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md" 
                        : "bg-slate-100 group-hover:bg-slate-200"
                    }`}>
                      <item.icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                    </div>

                    <AnimatePresence>
                      {!collapsed && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex-1 min-w-0 overflow-hidden"
                        >
                          <p className={`text-[13px] font-semibold leading-tight whitespace-nowrap ${isActive ? "text-violet-700" : "text-slate-700"}`}>
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-400 whitespace-nowrap">{item.description}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Badge for alerts */}
                    {item.badge && alertCount > 0 && !collapsed && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
                      >
                        {alertCount > 9 ? "9+" : alertCount}
                      </motion.div>
                    )}
                    {item.badge && alertCount > 0 && collapsed && (
                      <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-purple-100 shadow-md flex items-center justify-center hover:bg-violet-50 transition-colors z-30"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-slate-500" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-slate-500" />
          )}
        </button>

        {/* User footer */}
        <div className={`p-3 border-t border-purple-50/80 relative z-10 ${collapsed ? "flex justify-center" : ""}`}>
          <div className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer ${collapsed ? "justify-center" : ""}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              TN
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <p className="text-xs font-semibold text-slate-700 whitespace-nowrap">Tamil Nadu SDMA</p>
                  <p className="text-[10px] text-slate-400 whitespace-nowrap">State Command</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white/80 backdrop-blur-xl border-b border-purple-50 flex items-center px-6 gap-4 flex-shrink-0 z-10">
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Circle className="w-2 h-2 fill-green-500 text-green-500" />
              <span className="font-medium">Backend Connected</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Last update:</span>
              <span className="font-semibold text-slate-700">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-100 text-xs font-semibold text-violet-700">
              GDNN v2 · Active
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 text-xs font-semibold text-green-700">
              Tamil Nadu · Live
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="p-6 max-w-[1800px] mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-xl border-t border-purple-50 z-50 flex items-center justify-around px-4">
        {navSections.flatMap(s => s.items).slice(0, 5).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.name} href={item.href} className="p-2 flex flex-col items-center gap-1">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? "bg-gradient-to-br from-violet-500 to-indigo-600" : "bg-slate-100"}`}>
                <item.icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
