"use client";

import Sidebar from "@/components/layout/Sidebar";
import DashboardTopBar from "@/components/layout/DashboardTopBar";
import GlobalSimulationBanner from "@/components/layout/GlobalSimulationBanner";
import { FloodDataProvider } from "@/context/FloodDataContext";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FloodDataProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
          <DashboardTopBar />
          <GlobalSimulationBanner />
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </FloodDataProvider>
  );
}
