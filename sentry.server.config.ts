import * as Sentry from "@sentry/nextjs";
import { getTenantContext } from "./src/lib/tenant-context";

// Server-side error + performance monitoring. Inert unless SENTRY_DSN is set,
// so this ships dormant and activates by adding the env var.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Tag every event with the current tenant (from the RLS context) so a
  // production error is instantly traceable to a business.
  beforeSend(event) {
    const businessId = getTenantContext()?.businessId;
    if (businessId) {
      event.tags = { ...event.tags, businessId };
    }
    return event;
  },
});
