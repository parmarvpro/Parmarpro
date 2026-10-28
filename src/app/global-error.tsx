"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#ffffff", color: "#12151b" }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.03em", color: "#1f5bff" }}>Something went wrong</h1>
          <p style={{ color: "#5e6575" }}>Please try again. If the problem continues, contact support{error.digest ? ` with reference ${error.digest}` : ""}.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999, border: 0, background: "#1f5bff", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
