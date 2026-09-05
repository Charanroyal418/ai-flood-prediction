import Sidebar from "@/components/layout/Sidebar";
import DashboardTopBar from "@/components/layout/DashboardTopBar";
import GlobalSimulationBanner from "@/components/layout/GlobalSimulationBanner";
import { FloodDataProvider } from "@/context/FloodDataContext";

// Force dynamic rendering for the dashboard tree to prevent static generation issues with hooks
export const dynamic = "force-dynamic";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FloodDataProvider>
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
    </FloodDataProvider>
  );
}
