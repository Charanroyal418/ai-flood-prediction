"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold">Something went wrong!</h2>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
