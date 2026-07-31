import DashboardLayout from '@/components/layout/DashboardLayout';
import QueryProvider from "@/components/QueryProvider";
import { FloodDataProvider } from "@/context/FloodDataContext";

// All dashboard pages use React context hooks (useFloodData) which require
// a browser runtime. Force dynamic rendering for the entire /dashboard tree
// to prevent build-time static generation failures.
export const dynamic = 'force-dynamic';

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
