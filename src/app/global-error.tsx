"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Catches errors thrown while rendering the root layout / any uncaught client
// render error, reports them to Sentry, and shows a calm fallback.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#fbf7f4",
          color: "#231c22",
          fontFamily: "system-ui, -apple-system, Segoe UI, Arial, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              margin: "0 auto 1rem",
              display: "grid",
              placeItems: "center",
              borderRadius: 16,
              background: "linear-gradient(135deg,#6d315f,#54213f)",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 .5rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ fontSize: ".9rem", lineHeight: 1.5, color: "#796e77", margin: "0 0 1.25rem" }}>
            We hit an unexpected error and the team has been notified. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              border: "none",
              borderRadius: 12,
              padding: ".7rem 1.25rem",
              fontSize: ".9rem",
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
              background: "linear-gradient(90deg,#6d315f,#54213f)",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
