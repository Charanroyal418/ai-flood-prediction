"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useFloodData } from "@/context/FloodDataContext";

export const navSections = [
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

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { mode, stormSimulationActive, lastUpdated } = useFloodData();

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Listen for mobile toggle events from header
  useEffect(() => {
    const handleToggle = () => setMobileNavOpen((prev) => !prev);
    window.addEventListener("toggle-mobile-nav", handleToggle);
    return () => window.removeEventListener("toggle-mobile-nav", handleToggle);
  }, []);

  const { data: liveData } = useQuery({
    queryKey: ["dashboardLive"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/v1/dashboard/live");
        return res?.data ?? null;
      } catch (err: any) {
        if (err?.response?.status === 401) return null;
        return null;
      }
    },
    refetchInterval: 10000,
    staleTime: 5000,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) return false;
      return failureCount < 2;
    },
    throwOnError: false,
  });

  const alertCount = liveData?.metrics?.active_alerts_count ?? 0;
  const isStormActive = stormSimulationActive || mode === "SIMULATION";

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────────────────── */}
      <nav
        className={`hidden md:flex flex-col h-full bg-paper-100 text-text-primary border-r border-line z-50 relative overflow-visible transition-all duration-200 ${
          collapsed ? "w-16" : "w-64"
        }`}
        style={{ flexShrink: 0 }}
      >
        {/* Logo Area */}
        <div className="h-12 flex items-center px-4 border-b border-line flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-signal-500 flex-shrink-0" />
          {!collapsed && (
            <div className="ml-3 truncate">
              <span className="text-sm font-heading font-bold text-text-primary tracking-wide">
                FloodSense AI
              </span>
            </div>
          )}
        </div>

        {/* Live / Simulation status pill */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-line">
            <div
              className={`px-2 py-1.5 rounded flex items-center gap-2 border font-mono text-xs ${
                isStormActive
                  ? "bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.3)] text-risk-severe"
                  : "bg-[rgba(52,211,153,0.1)] border-[rgba(52,211,153,0.3)] text-risk-low"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isStormActive ? "bg-risk-severe" : "bg-risk-low"
                }`}
              />
              <span className="font-semibold tracking-tight">
                {isStormActive ? "SIMULATION" : "LIVE TELEMETRY"}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <div className="flex-1 py-4 px-2 overflow-y-auto no-scrollbar relative z-10">
          {navSections.map((section) => (
            <div key={section.label} className="mb-6">
              {!collapsed && (
                <p className="px-3 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-widest">
                  {section.label}
                </p>
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      title={collapsed ? item.name : undefined}
                      onClick={(e) => {
                        if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                          e.preventDefault();
                          router.push(item.href);
                        }
                      }}
                      className={`sidebar-item ${active ? "active" : ""}`}
                    >
                      <item.icon strokeWidth={1.5} className="w-[18px] h-[18px] flex-shrink-0" />

                      {!collapsed && (
                        <span className="flex-1 truncate">{item.name}</span>
                      )}

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
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-paper-50 border border-line shadow-sm flex items-center justify-center hover:bg-line transition-colors z-30"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-text-secondary" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-text-secondary" />
          )}
        </button>

        {/* User footer */}
        <div className="p-4 border-t border-line flex flex-col gap-3">
          {!collapsed && (
            <div className="flex items-center gap-2 mb-2">
              <Circle className="w-2 h-2 text-risk-low fill-risk-low" />
              <span className="text-[10px] font-mono text-text-secondary">
                SYNC: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "..."}
              </span>
            </div>
          )}
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-8 h-8 rounded bg-signal-100 flex items-center justify-center text-signal-600 text-xs font-bold flex-shrink-0 font-mono border border-signal-500">
              TN
            </div>
            {!collapsed && (
              <div className="truncate">
                <p className="text-xs font-semibold text-text-primary">TN SDMA</p>
                <p className="text-[10px] text-text-secondary">State EOC</p>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Mobile Navigation Drawer ────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <nav className="relative w-64 max-w-[80vw] bg-paper-100 h-full flex flex-col z-10 shadow-2xl">
            <div className="h-12 flex items-center justify-between px-4 border-b border-line">
              <span className="text-sm font-heading font-bold text-text-primary tracking-wide">
                FloodSense AI
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="text-text-secondary p-1"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 py-4 px-2 overflow-y-auto">
              {navSections.map((section) => (
                <div key={section.label} className="mb-6">
                  <p className="px-3 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-widest">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={false}
                          onClick={(e) => {
                            setMobileNavOpen(false);
                            if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                              e.preventDefault();
                              router.push(item.href);
                            }
                          }}
                          className={`sidebar-item ${active ? "active" : ""}`}
                        >
                          <item.icon strokeWidth={1.5} className="w-[18px] h-[18px] flex-shrink-0" />
                          <span className="flex-1 truncate">{item.name}</span>
                          {item.badge && alertCount > 0 && (
                            <span className="flex-shrink-0 bg-risk-severe text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm mono-data">
                              {alertCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
