"use client";

import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import DashboardTopBar from "./DashboardTopBar";
import GlobalSimulationBanner from "./GlobalSimulationBanner";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div
        className="flex-1 flex flex-col min-w-0 bg-background"
        style={{ overflow: "hidden", minHeight: 0 }}
      >
        <DashboardTopBar />
        <GlobalSimulationBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
