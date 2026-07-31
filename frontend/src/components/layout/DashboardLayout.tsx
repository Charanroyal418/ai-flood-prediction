"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Circle,
  ShieldAlert,
  CloudLightning,
  Menu,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";

const navSections = [
  {
    label: "Intelligence",
    items: [
      { name: "Command Center", href: "/dashboard", icon: LayoutDashboard },
      { name: "AI Prediction", href: "/dashboard/predictions", icon: Brain },
      { name: "Knowledge Graph", href: "/dashboard/kg", icon: Network },
    ],
  },
  {
    label: "Telemetry",
    items: [
      { name: "Weather Intel", href: "/dashboard/weather", icon: CloudRain },
      { name: "River Intel", href: "/dashboard/river", icon: Waves },
      { name: "District Analytics", href: "/dashboard/district", icon: MapPin },
    ],
  },
  {
    label: "Analysis",
    items: [
      { name: "Historical", href: "/dashboard/history", icon: History },
      { name: "Alert Center", href: "/dashboard/alerts", icon: Bell, badge: true },
      { name: "Storm Sim", href: "/dashboard/realtime", icon: CloudLightning },
      { name: "Performance", href: "/dashboard/performance", icon: Zap },
    ],
  },
  {
    label: "Admin",
    items: [
      { name: "Admin Panel", href: "/dashboard/admin", icon: ShieldAlert },
      { name: "System Health", href: "/dashboard/system", icon: Activity },
    ],
  },
];

import GlobalSimulationBanner from "@/components/layout/GlobalSimulationBanner";
import { useFloodData } from "@/context/FloodDataContext";

// ── Reusable Nav Item ─────────────────────────────────────────────────────────
function NavItem({
  item,
  isActive,
  collapsed,
  alertCount,
  onNavigate,
}: {
  item: (typeof navSections)[0]["items"][0];
  isActive: boolean;
  collapsed: boolean;
  alertCount: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.name : undefined}
      onClick={onNavigate}
      className={`sidebar-item ${isActive ? "active" : ""}`}
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      
      {!collapsed && (
        <span className="flex-1 truncate">{item.name}</span>
      )}

      {/* Alert badge */}
      {item.badge && alertCount > 0 && !collapsed && (
        <span className="flex-shrink-0 bg-risk-severe text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm mono-data">
          {alertCount}
        </span>
      )}
      {item.badge && alertCount > 0 && collapsed && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-risk-severe" />
      )}
    </Link>
  );
}

// ── Nav Sections Renderer ─────────────────────────────────────────────────────
function NavSections({
  collapsed,
  alertCount,
  onNavigate,
}: {
  collapsed: boolean;
  alertCount: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      {navSections.map((section) => (
        <div key={section.label} className="mb-6">
          {!collapsed && (
            <p className="px-3 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-widest">
              {section.label}
            </p>
          )}

          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavItem
                key={item.name}
                item={item}
                isActive={pathname === item.href}
                collapsed={collapsed}
                alertCount={alertCount}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { mode, stormSimulationActive, lastUpdated } = useFloodData();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
  const isStormActive = stormSimulationActive || mode === "SIMULATION";

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <div
      className="flex h-screen overflow-hidden bg-background"
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.2s ease" }}
    >
      {/* ── Desktop Sidebar (Dark Ink) ─────────────────────────────────────────────── */}
      <nav
        className={`hidden md:flex flex-col h-full bg-ink-950 text-text-primary border-r border-ink-900 z-20 relative overflow-hidden transition-all duration-200 ${
          collapsed ? "w-16" : "w-64"
        }`}
        style={{ flexShrink: 0 }}
      >
        {/* Logo Area */}
        <div className="h-12 flex items-center px-4 border-b border-ink-900 flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-signal-500 flex-shrink-0" />
          {!collapsed && (
            <div className="ml-3 truncate">
              <span className="text-sm font-heading font-bold text-white tracking-wide">
                FloodSense AI
              </span>
            </div>
          )}
        </div>

        {/* Live / Simulation status pill */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-ink-900">
             <div className={`px-2 py-1.5 rounded flex items-center gap-2 border font-mono text-xs ${
                isStormActive
                  ? "bg-[rgba(201,100,47,0.1)] border-[rgba(201,100,47,0.3)] text-risk-high"
                  : "bg-[rgba(63,125,92,0.1)] border-[rgba(63,125,92,0.3)] text-risk-low"
              }`}>
                <div className={`w-2 h-2 rounded-full ${isStormActive ? "bg-risk-high" : "bg-risk-low"}`} />
                <span className="font-semibold tracking-tight">
                  {isStormActive ? "SIMULATION" : "LIVE TELEMETRY"}
                </span>
             </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 py-4 px-2 overflow-y-auto custom-scroll relative z-10">
          <NavSections collapsed={collapsed} alertCount={alertCount} />
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-ink-700 border border-ink-900 shadow-sm flex items-center justify-center hover:bg-ink-900 transition-colors z-30"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-text-secondary" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-text-secondary" />
          )}
        </button>

        {/* User footer + Theme Toggle */}
        <div className="p-4 border-t border-ink-900 flex flex-col gap-3">
          {!collapsed && (
            <div className="flex items-center gap-2 mb-2">
              <Circle className="w-2 h-2 text-risk-low fill-risk-low" />
              <span className="text-[10px] font-mono text-text-secondary">
                SYNC: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '...'}
              </span>
            </div>
          )}
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-8 h-8 rounded bg-ink-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 font-mono border border-ink-900">
              TN
            </div>
            {!collapsed && (
              <div className="truncate">
                <p className="text-xs font-semibold text-white">TN SDMA</p>
                <p className="text-[10px] text-text-secondary">State EOC</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-ink-900">
              <span className="text-[10px] text-text-secondary font-medium">THEME</span>
              <ThemeSwitcher />
            </div>
          )}
          {collapsed && <ThemeSwitcher />}
        </div>
      </nav>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Slim Top Status Bar */}
        <header className="h-10 bg-paper-100 border-b border-line flex items-center px-4 gap-4 flex-shrink-0 z-10 text-sm">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden w-6 h-6 flex items-center justify-center text-text-secondary"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex-1 flex items-center gap-4 min-w-0 font-mono text-xs text-text-secondary">
            <div className="flex items-center gap-1.5">
              <Circle className={`w-2 h-2 fill-current ${isStormActive ? "text-risk-high" : "text-risk-low"}`} />
              <span>{isStormActive ? "SYSTEM: SIMULATED" : "SYSTEM: NOMINAL"}</span>
            </div>
            <div className="h-4 w-px bg-line hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5">
              <span>LAST SYNC:</span>
              <span className="text-text-primary">
                {!mounted ? "..." : lastUpdated
                  ? new Date(lastUpdated).toLocaleTimeString("en-IN", { hour12: false })
                  : new Date().toLocaleTimeString("en-IN", { hour12: false })}
              </span>
            </div>
          </div>
        </header>

        {/* EOC Global Banner across all pages */}
        <GlobalSimulationBanner />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto w-full">
          {children}
        </main>
      </div>

      {/* ── Mobile Navigation Overlay ───────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={closeMobileNav} />
          <nav className="relative w-64 max-w-[80vw] bg-ink-950 h-full flex flex-col">
            <div className="h-12 flex items-center justify-between px-4 border-b border-ink-900">
              <span className="text-sm font-heading font-bold text-white tracking-wide">FloodSense AI</span>
              <button onClick={closeMobileNav} className="text-text-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 py-4 px-2 overflow-y-auto">
               <NavSections collapsed={false} alertCount={alertCount} onNavigate={closeMobileNav} />
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
