"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-red-100 rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-500">
            An unexpected error occurred while loading this module. Our team has been notified.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-left overflow-hidden">
          <p className="text-xs font-mono text-slate-600 truncate">
            {error.message || "Unknown Application Error"}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link 
            href="/dashboard"
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Dashboard
          </Link>
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-md shadow-violet-200"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    </div>
  );
}
