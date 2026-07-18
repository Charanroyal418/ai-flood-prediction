import DashboardLayout from '@/components/layout/DashboardLayout';
import QueryProvider from "@/components/QueryProvider";

export const dynamic = "force-dynamic";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </QueryProvider>
  );
}
