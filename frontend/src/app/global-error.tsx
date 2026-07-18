"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center p-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Something went wrong!</h2>
          <p className="text-sm text-slate-500 mb-6">A critical error occurred at the application root.</p>
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
