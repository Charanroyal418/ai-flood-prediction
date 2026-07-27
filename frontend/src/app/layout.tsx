import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FloodSense AI — Tamil Nadu Flood Intelligence Platform",
  description: "Intelligent Prediction of Flood Disaster Risk Levels Based on Knowledge Graph and Graph Dynamic Neural Networks. Real-time AI monitoring for Tamil Nadu.",
  keywords: ["flood prediction", "AI", "machine learning", "Tamil Nadu", "disaster management", "knowledge graph", "GNN"],
};

// FloodSense AI is a real-time Emergency Operations Center platform.
// Static generation (SSG) is meaningless for live flood monitoring data.
// Force the entire application to render dynamically on every request.
// This also prevents build-time prerender failures from React context hooks
// that require a browser runtime (WebSocket, useContext, etc.).
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
