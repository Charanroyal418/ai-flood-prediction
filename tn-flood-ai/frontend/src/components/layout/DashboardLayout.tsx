"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  CloudRain,
  Settings,
  ShieldAlert,
  Network,
  History,
  Route,
  Server,
  ActivitySquare
} from "lucide-react";

const navigation = [
  { name: "Command Center", href: "/dashboard", icon: LayoutDashboard },
  { name: "Real-Time Monitoring", href: "/dashboard/realtime", icon: ActivitySquare },
  { name: "Knowledge Graph", href: "/dashboard/kg", icon: Network },
  { name: "AI Predictions", href: "/dashboard/predictions", icon: Activity },
  { name: "Weather & Rivers", href: "/dashboard/telemetry", icon: CloudRain },
  { name: "Active Alerts", href: "/dashboard/alerts", icon: AlertTriangle },
  { name: "Historical Floods", href: "/dashboard/history", icon: History },
  { name: "ETL & System Health", href: "/dashboard/system", icon: Server },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Premium Glass Sidebar */}
      <div className="hidden w-72 md:block flex-shrink-0 z-20">
        <div className="h-full glass border-r border-slate-200/60 flex flex-col relative overflow-hidden">
          {/* Subtle gradient orb for sidebar background */}
          <div className="absolute top-0 left-0 w-full h-64 bg-blue-100 rounded-full blur-3xl -translate-y-1/2 pointer-events-none"></div>
          
          <div className="flex h-20 flex-shrink-0 items-center px-6 border-b border-slate-200/60 relative z-10">
            <ShieldAlert className="h-8 w-8 text-blue-600 mr-3" />
            <span className="text-2xl font-heading font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-900 to-slate-700">
              FloodSense <span className="text-blue-600">AI</span>
            </span>
          </div>
          
          <nav className="mt-6 flex-1 space-y-2 px-4 relative z-10 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                      isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                    aria-hidden="true"
                  />
                  {item.name}
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-pulse"></div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* System Status in Sidebar Bottom */}
          <div className="p-4 border-t border-slate-200/60 relative z-10">
            <div className="glass-card rounded-xl p-4 flex items-center justify-between border border-slate-200/50 bg-white/60">
              <span className="text-sm text-slate-600 font-medium">System Status</span>
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-emerald-600">Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Main background aesthetic elements */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-50 rounded-full blur-[120px] pointer-events-none transform translate-x-1/4 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-emerald-50 rounded-full blur-[120px] pointer-events-none transform -translate-x-1/4 translate-y-1/4"></div>
        
        {/* Top Header - Glassmorphic */}
        <header className="flex h-20 flex-shrink-0 items-center justify-between glass border-b border-slate-200/60 px-8 z-10">
          <div className="flex-1 flex justify-between items-center">
            <div className="flex items-center">
               {/* Could place breadcrumbs or page title here */}
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 px-4 py-2 glass-card rounded-full border border-slate-200/50 bg-white/60">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  TN
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">State Admin</span>
                  <span className="text-[10px] text-slate-500 font-medium">Command Center</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
