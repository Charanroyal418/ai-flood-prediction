import DashboardLayout from '@/components/layout/DashboardLayout';
import QueryProvider from "@/components/QueryProvider";
import { FloodDataProvider } from "@/context/FloodDataContext";

export const dynamic = "force-dynamic";


export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <FloodDataProvider>
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </FloodDataProvider>
    </QueryProvider>
  );
}
