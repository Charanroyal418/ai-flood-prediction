"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Page Not Found</h2>
          <p className="text-sm text-slate-500">
            The module or page you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link 
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-md shadow-violet-200"
          >
            <RefreshCw className="w-4 h-4" /> Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
