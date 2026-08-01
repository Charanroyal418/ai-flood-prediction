import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";
import { AuthProvider } from "@/context/AuthContext";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FloodSense AI — Tamil Nadu Flood Intelligence Platform",
    template: "%s | FloodSense AI",
  },
  description:
    "Intelligent Prediction of Flood Disaster Risk Levels. Real-time AI monitoring for Tamil Nadu's 38 districts.",
  keywords: [
    "flood prediction", "AI", "machine learning", "Tamil Nadu", "disaster management",
  ],
  authors: [{ name: "FloodSense AI Research Team" }],
  creator: "FloodSense AI",
  openGraph: {
    title: "FloodSense AI — Tamil Nadu Flood Intelligence Platform",
    description: "Real-Time AI Flood Prediction & Decision Support",
    type: "website",
    locale: "en_IN",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1420" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable}`}>
      <head>
      </head>
      <body className="antialiased min-h-screen transition-colors duration-300 font-sans">
        <AuthProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
