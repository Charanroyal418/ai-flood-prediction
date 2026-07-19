"use client";

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
        <h2 className="text-3xl font-bold text-slate-800 mb-4">404</h2>
        <p className="text-sm text-slate-500 mb-6">This page could not be found.</p>
        <Link 
          href="/dashboard"
          className="px-6 py-2.5 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors inline-block"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
