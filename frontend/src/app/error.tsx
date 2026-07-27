"use client";


export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-4 max-w-md p-6">
        <h2 className="text-xl font-bold font-heading">System Error Encountered</h2>
        <p className="text-xs text-slate-400">{error?.message || "An unexpected error occurred in the platform runtime."}</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-indigo-600 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
        >
          Re-initialize Module
        </button>
      </div>
    </div>
  );
}
