/**
 * Telling "the database is unreachable" apart from "this code has a bug".
 *
 * Written during the August 2026 outage, when Neon's free-tier compute quota ran
 * out mid-month and every page that touched Postgres returned a raw HTTP 500.
 * A salon owner cannot tell a stack trace from an abandoned product, so the app
 * needs to say "we are down, back shortly" instead.
 *
 * The matching here is deliberately NARROWER than the retry classifier in
 * prisma.ts. That one decides whether to try again, and a false positive costs
 * one wasted round trip. This one decides whether to hide the entire
 * application behind a maintenance page, and a false positive would mask a real
 * bug as an outage — so it only matches errors that mean the server is not
 * answering at all, never errors about the shape of a query or its data.
 *
 * Pure and dependency-free so it can be unit tested without a database.
 */

/** Prisma initialisation/connectivity codes: unreachable, TLS failure, timeout. */
const UNREACHABLE_CODES = new Set(["P1000", "P1001", "P1002", "P1003", "P1010", "P1017"]);

const UNREACHABLE_MESSAGES = [
  // Neon stops the compute outright once the plan's compute-time is spent. This
  // is the one that took production down, and it arrives as a query error
  // rather than a connection error, so the codes above never catch it.
  "exceeded the compute time quota",
  "compute time quota",
  "Can't reach database server",
  "Connection reset",
  "kind: Closed",
  "Server has closed the connection",
  "Connection terminated",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
];

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!error) return false;

  const code = (error as { code?: string })?.code;
  if (typeof code === "string" && UNREACHABLE_CODES.has(code)) {
    return true;
  }

  const message = String((error as { message?: string })?.message ?? "");
  if (!message) return false;

  return UNREACHABLE_MESSAGES.some((needle) => message.includes(needle));
}

/**
 * Runs a read and falls back instead of throwing when the database is down.
 *
 * For content that has something sensible to show without Postgres — the public
 * pricing page has a hard-coded plan list already. A page that degrades is
 * better than a page that 500s, but only where the fallback is honest; anything
 * tenant-specific must go to the maintenance page rather than invent data.
 *
 * A non-connectivity error is rethrown untouched, so genuine bugs still surface
 * as errors and reach Sentry rather than hiding behind stale-looking content.
 */
export async function withDatabaseFallback<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.error("[db-health] serving fallback content, database unavailable:", error);
      return fallback;
    }
    throw error;
  }
}
