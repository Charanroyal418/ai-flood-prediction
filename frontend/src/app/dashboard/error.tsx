"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6 font-sans">
      <div className="flex flex-col items-center gap-6 max-w-md text-center bg-paper-100 p-8 rounded-3xl border border-line shadow-[0_8px_24px_rgba(99,102,241,0.06)]">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary mb-2">
            Dashboard View Recovery
          </h2>
          <p className="text-xs text-text-secondary leading-relaxed">
            {error?.message || "An unexpected error occurred while loading this view. The telemetry pipeline remains active."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => reset()}
            className="btn-primary flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-full"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
          <Link
            href="/dashboard"
            className="btn-secondary flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-full"
          >
            <Home className="w-3.5 h-3.5" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
