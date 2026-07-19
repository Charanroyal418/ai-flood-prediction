import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FloodSense AI — Tamil Nadu Flood Intelligence Platform",
  description: "Intelligent Prediction of Flood Disaster Risk Levels Based on Knowledge Graph and Graph Dynamic Neural Networks. Real-time AI monitoring for Tamil Nadu.",
  keywords: "flood prediction, AI, machine learning, Tamil Nadu, disaster management, knowledge graph, GNN",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
