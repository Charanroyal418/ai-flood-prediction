"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
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
      { name: "Storm Simulation", href: "/dashboard/realtime", icon: CloudLightning, description: "Scenario testing" },
      { name: "Performance Monitor", href: "/dashboard/performance", icon: Zap, description: "Latency & metrics" },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Admin Panel", href: "/dashboard/admin", icon: ShieldAlert, description: "System control" },
      { name: "System Health", href: "/dashboard/system", icon: Activity, description: "Platform status" },
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
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-200 no-min-tap w-full ${
        isActive
          ? "bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/30 border border-violet-100 dark:border-violet-800/50"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent"
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="activeNavIndicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-gradient-to-b from-violet-500 to-indigo-600 rounded-r-full"
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
      )}

      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
          isActive
            ? "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md"
            : "bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
        }`}
      >
        <item.icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-w-0 overflow-hidden"
          >
            <p className={`text-[13px] font-semibold leading-tight whitespace-nowrap ${isActive ? "text-violet-700 dark:text-violet-400" : "text-slate-700 dark:text-slate-200"}`}>
              {item.name}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{item.description}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert badge */}
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
        <div key={section.label} className="mb-4">
          <AnimatePresence>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest"
              >
                {section.label}
              </motion.p>
            )}
          </AnimatePresence>

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
      ))}
    </>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // Fix hydration: start with skeleton visible, reveal after mount
  // Using opacity instead of returning null to avoid blank flash
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { mode, stormSimulationActive, lastUpdated } = useFloodData();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Close mobile nav on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  // Prevent body scroll when mobile nav is open
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavOpen]);

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
    // Use opacity transition instead of display:none to avoid hydration mismatch
    <div
      className="flex h-screen overflow-hidden bg-[#FAFBFF] dark:bg-[#0a0b14]"
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.2s ease" }}
    >
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <motion.nav
        animate={{ width: collapsed ? 72 : 272 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="hidden md:flex flex-col h-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-r border-purple-100/60 dark:border-slate-800/60 z-20 relative overflow-hidden"
        style={{ flexShrink: 0 }}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-50/30 via-transparent to-blue-50/20 dark:from-purple-950/20 dark:to-transparent pointer-events-none" />

        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-purple-50 dark:border-slate-800 relative z-10 shrink-0">
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
                <p className="text-sm font-heading font-bold text-slate-800 dark:text-slate-100 leading-tight whitespace-nowrap">FloodSense AI</p>
                <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Tamil Nadu · EOC Platform</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live / Simulation status pill */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`mx-4 mt-4 px-3 py-2 rounded-xl border flex items-center gap-2 relative z-10 transition-colors ${
                isStormActive
                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300"
                  : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${isStormActive ? "bg-amber-500" : "bg-emerald-500"}`} />
                <div className={`absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75 ${isStormActive ? "bg-amber-400" : "bg-emerald-400"}`} />
              </div>
              <span className="text-[11px] font-bold">
                {isStormActive ? "🟠 STORM SIMULATION" : "🟢 LIVE · All Systems"}
              </span>
              <Zap className={`w-3 h-3 ml-auto ${isStormActive ? "text-amber-500" : "text-emerald-500"}`} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto no-scrollbar relative z-10">
          <NavSections collapsed={collapsed} alertCount={alertCount} />
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="no-min-tap absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700 shadow-md flex items-center justify-center hover:bg-violet-50 dark:hover:bg-slate-700 transition-colors z-30"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-slate-500" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-slate-500" />
          )}
        </button>

        {/* User footer + Theme Toggle */}
        <div className={`p-3 border-t border-purple-50/80 dark:border-slate-800 relative z-10 ${collapsed ? "flex flex-col items-center gap-2" : ""}`}>
          {!collapsed && (
            <div className="flex items-center gap-1.5 px-2 mb-3">
              <Circle className="w-1.5 h-1.5 text-emerald-500 fill-emerald-500 animate-pulse" />
              <span className="text-[9px] font-mono text-slate-400">
                Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Syncing...'}
              </span>
            </div>
          )}
          <div className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer no-min-tap ${collapsed ? "justify-center" : ""}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              TN
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">Tamil Nadu SDMA</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">State EOC Command</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {!collapsed && (
            <div className="flex items-center justify-between px-2 mt-2">
              <span className="text-[10px] text-slate-400 font-medium">Theme</span>
              <ThemeSwitcher />
            </div>
          )}
          {collapsed && <ThemeSwitcher />}
        </div>
      </motion.nav>

      {/* ── Mobile Navigation Overlay ───────────────────────────────────── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mobile-nav-overlay md:hidden"
              onClick={closeMobileNav}
              aria-label="Close navigation"
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="mobile-nav-panel md:hidden"
            >
              {/* Mobile nav header */}
              <div className="h-16 flex items-center justify-between px-4 border-b border-purple-50 dark:border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-heading font-bold text-slate-800 dark:text-slate-100 leading-tight">FloodSense AI</p>
                    <p className="text-[10px] text-slate-400 font-medium">Tamil Nadu · EOC</p>
                  </div>
                </div>
                <button
                  onClick={closeMobileNav}
                  className="no-min-tap w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* Live status pill */}
              <div className={`mx-4 mt-3 px-3 py-2 rounded-xl border flex items-center gap-2 ${
                isStormActive
                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                  : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
              }`}>
                <div className="relative flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full ${isStormActive ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <div className={`absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75 ${isStormActive ? "bg-amber-400" : "bg-emerald-400"}`} />
                </div>
                <span className="text-[11px] font-bold">
                  {isStormActive ? "🟠 STORM SIMULATION ACTIVE" : "🟢 LIVE · All Systems Online"}
                </span>
              </div>

              {/* Nav sections */}
              <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                <NavSections collapsed={false} alertCount={alertCount} onNavigate={closeMobileNav} />
              </div>

              {/* Mobile footer */}
              <div className="p-3 border-t border-purple-50/80 dark:border-slate-800">
                <div className="flex items-center gap-1.5 px-2 mb-2">
                  <Circle className="w-1.5 h-1.5 text-emerald-500 fill-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-mono text-slate-400">
                    Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Syncing...'}
                  </span>
                </div>
                <div className="flex items-center gap-3 px-2 py-2 rounded-xl no-min-tap">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    TN
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Tamil Nadu SDMA</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">State EOC Command</p>
                  </div>
                  <div className="ml-auto">
                    <ThemeSwitcher />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-purple-50 dark:border-slate-800 flex items-center px-3 sm:px-6 gap-3 flex-shrink-0 z-10">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden no-min-tap w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
          >
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>

          <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
              <Circle className={`w-2 h-2 fill-current ${isStormActive ? "text-amber-500" : "text-emerald-500"}`} />
              <span className="font-medium">Backend Connected</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Updated:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {!mounted ? "" : lastUpdated
                  ? new Date(lastUpdated).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden lg:flex px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-800/50 text-xs font-semibold text-violet-700 dark:text-violet-400 items-center no-min-tap">
              {isStormActive ? "Simulated Inputs" : "Open-Meteo + WRIS"}
            </div>
            <div
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors no-min-tap ${
                isStormActive
                  ? "bg-amber-500 text-white border-amber-600 shadow-sm animate-pulse"
                  : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800"
              }`}
            >
              {isStormActive ? "🟠 STORM" : "🟢 LIVE"}
            </div>
          </div>
        </header>

        {/* EOC Global Banner across all pages */}
        <GlobalSimulationBanner />

        <main className="flex-1 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="p-3 sm:p-4 lg:p-6 max-w-[1800px] mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Mobile Bottom Nav (quick access to 5 main sections) ─────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-purple-50 dark:border-slate-800 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-2 h-16">
          {navSections.flatMap((s) => s.items).slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="no-min-tap flex flex-col items-center gap-1 py-1 px-2 flex-1"
                aria-label={item.name}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive ? "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md" : "bg-slate-100 dark:bg-slate-800"
                }`}>
                  <item.icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                </div>
                <span className={`text-[9px] font-semibold leading-none ${isActive ? "text-violet-600 dark:text-violet-400" : "text-slate-400 dark:text-slate-500"}`}>
                  {item.name.split(" ")[0]}
                </span>
              </Link>
            );
          })}
          {/* More button opens mobile nav */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="no-min-tap flex flex-col items-center gap-1 py-1 px-2 flex-1"
            aria-label="More navigation"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800">
              <Menu className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 leading-none">More</span>
          </button>
        </div>
      </div>
    </div>
  );
}
