/**
 * Custom Pages Router error page (_error).
 * Overrides Next.js's default internal error page which fails during App Router
 * static generation due to the <Html> import constraint.
 * This simple component does NOT import <Html> or anything from next/document.
 */
export default function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#f8fafc',
        fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
        {statusCode ?? 'Error'}
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
        {statusCode === 404
          ? 'Page not found'
          : statusCode === 500
          ? 'Internal server error'
          : 'An unexpected error occurred'}
      </p>
      <a
        href="/dashboard"
        style={{
          padding: '0.5rem 1.25rem',
          background: '#6366f1',
          borderRadius: '0.75rem',
          color: '#fff',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        Return to Dashboard
      </a>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: any) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};
