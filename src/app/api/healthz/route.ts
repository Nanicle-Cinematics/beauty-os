export const dynamic = "force-dynamic";

/**
 * Liveness for the uptime monitor: "is a function answering", nothing more.
 *
 * Deliberately touches no database and imports nothing that does. The monitor
 * calls this every minute, forever, and the August 2026 outage was exactly that
 * shape: an automated caller hitting a DB-backed `/` once a minute kept Neon
 * from ever suspending and burned the whole month's compute allowance. Real
 * users wake the database; a monitor must not. `route.test.ts` pins this.
 *
 * `force-dynamic` so the answer comes from a live function rather than a
 * build-time copy on the CDN, which would keep saying 200 while every real
 * route failed.
 */
export function GET() {
  return Response.json(
    {
      status: "ok",
      app: "beauty-os",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
