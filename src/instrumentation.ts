import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Captures errors thrown in Server Components, route handlers, and server
// actions (enriched with the tenant tag via beforeSend). No-op without a DSN.
export const onRequestError = Sentry.captureRequestError;
