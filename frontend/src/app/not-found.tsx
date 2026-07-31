/**
 * App Router 404 not-found page.
 * This is a server component (no "use client" directive) so it can be
 * statically prerendered during next build without any React hooks issues.
 */
export default function NotFound() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">404 — Page Not Found</h2>
        <p className="text-sm text-slate-400">
          The requested Emergency Operations Center module was not found.
        </p>
        <a
          href="/dashboard"
          className="inline-block px-4 py-2 bg-indigo-600 rounded-xl text-xs font-semibold hover:bg-indigo-700"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
}
