import type { Metadata, Viewport } from "next";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: {
    default: "FloodSense AI — Tamil Nadu Flood Intelligence Platform",
    template: "%s | FloodSense AI",
  },
  description:
    "Intelligent Prediction of Flood Disaster Risk Levels Based on Dynamic Knowledge Graphs and Graph Attention Networks (GAT+GRU). Real-time AI monitoring for Tamil Nadu's 38 districts.",
  keywords: [
    "flood prediction", "AI", "machine learning", "Tamil Nadu", "disaster management",
    "knowledge graph", "GNN", "GAT", "GRU", "SHAP", "flood risk", "real-time",
    "early warning system", "hydrology", "rainfall prediction",
  ],
  authors: [{ name: "FloodSense AI Research Team" }],
  creator: "FloodSense AI",
  openGraph: {
    title: "FloodSense AI — Tamil Nadu Flood Intelligence Platform",
    description: "Real-Time AI Flood Prediction & Decision Support using Knowledge Graphs and GNN",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "FloodSense AI",
    description: "Real-Time AI Flood Prediction for Tamil Nadu",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFBFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b14" },
  ],
  width: "device-width",
  initialScale: 1,
};

// FloodSense AI is a real-time Emergency Operations Center platform.
// Force dynamic rendering — static generation is meaningless for live flood data.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script to set theme before React hydrates (prevents flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('floodsense_theme');
                var d = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (d) document.documentElement.classList.add('dark');
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen transition-colors duration-300">
        <AuthProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
