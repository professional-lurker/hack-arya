"use client";

/**
 * Global error boundary — rendered OUTSIDE the root layout.
 * Must NOT import any component that uses React context (e.g. Toaster,
 * @base-ui/react primitives) because no providers are mounted here.
 * Next.js prerendering this page with any context-dependent component
 * causes: TypeError: Cannot read properties of null (reading 'useContext').
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong</title>
        <style>{`
          body {
            margin: 0;
            font-family: system-ui, -apple-system, sans-serif;
            background: #09090b;
            color: #fafafa;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .card {
            max-width: 400px;
            padding: 2rem;
            border: 1px solid #27272a;
            border-radius: 12px;
            background: #18181b;
            text-align: center;
          }
          h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
          p  { font-size: 0.875rem; color: #a1a1aa; margin: 0 0 1.5rem; }
          button {
            padding: 0.5rem 1.25rem;
            background: #6366f1;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
          }
          button:hover { background: #4f46e5; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <h1>Something went wrong</h1>
          <p>
            {error?.digest
              ? `A server error occurred (ref: ${error.digest}). Please try again.`
              : "An unexpected error occurred. Please try again."}
          </p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  );
}
