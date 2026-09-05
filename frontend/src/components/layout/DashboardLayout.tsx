"use client";

import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import DashboardTopBar from "./DashboardTopBar";
import GlobalSimulationBanner from "./GlobalSimulationBanner";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="relative z-50 flex-shrink-0 h-full">
        <Sidebar />
      </aside>
      <div className="relative z-10 flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        <DashboardTopBar />
        <GlobalSimulationBanner />
        <main className="relative z-10 flex-1 overflow-auto p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
