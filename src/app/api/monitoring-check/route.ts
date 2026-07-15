import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Verify the Sentry server pipeline: GET /api/monitoring-check?verify=1 throws
// a deliberate error that should surface in Sentry. Without the param it's a
// harmless health response, so crawlers can't spam errors.
export function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("verify") === "1") {
    throw new Error("Sentry verification error — intentional (monitoring-check)");
  }
  return NextResponse.json({ ok: true, hint: "append ?verify=1 to trigger a test error" });
}
