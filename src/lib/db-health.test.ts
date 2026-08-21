import { describe, it, expect, vi } from "vitest";
import { isDatabaseUnavailableError, withDatabaseFallback } from "@/lib/db-health";

describe("isDatabaseUnavailableError", () => {
  it("recognises the Neon quota error that took production down", () => {
    // Verbatim from the August 2026 outage. It arrives as a query error, not a
    // connection error, so matching on Prisma's P100x codes alone misses it.
    const error = new Error(
      "\nInvalid `prisma.business.findMany()` invocation:\n\n\nError querying the database: ERROR: Your account or project has exceeded the compute time quota. Upgrade your plan to increase limits.",
    );
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it("recognises unreachable-server codes and messages", () => {
    expect(isDatabaseUnavailableError({ code: "P1001" })).toBe(true);
    expect(isDatabaseUnavailableError({ code: "P1017" })).toBe(true);
    expect(isDatabaseUnavailableError(new Error("Can't reach database server at ep-x.neon.tech"))).toBe(true);
    expect(isDatabaseUnavailableError(new Error("connect ECONNREFUSED 127.0.0.1:5432"))).toBe(true);
  });

  it("does NOT treat ordinary query failures as an outage", () => {
    // The critical negative case: hiding a real bug behind a maintenance page
    // would make it invisible, and the app would look down when it is fine.
    expect(isDatabaseUnavailableError({ code: "P2002", message: "Unique constraint failed" })).toBe(false);
    expect(isDatabaseUnavailableError({ code: "P2025", message: "Record to update not found" })).toBe(false);
    expect(isDatabaseUnavailableError(new Error("Argument `where` is missing"))).toBe(false);
  });

  it("does NOT treat pool exhaustion as an outage", () => {
    // P2024 means our own connections are all busy, not that Postgres is gone.
    expect(
      isDatabaseUnavailableError({ code: "P2024", message: "Timed out fetching a new connection from the pool" }),
    ).toBe(false);
  });

  it("handles junk without throwing", () => {
    expect(isDatabaseUnavailableError(null)).toBe(false);
    expect(isDatabaseUnavailableError(undefined)).toBe(false);
    expect(isDatabaseUnavailableError("a string")).toBe(false);
    expect(isDatabaseUnavailableError({})).toBe(false);
  });
});

describe("withDatabaseFallback", () => {
  it("returns the real value when the database answers", async () => {
    expect(await withDatabaseFallback(async () => ["live"], ["fallback"])).toEqual(["live"]);
  });

  it("falls back when the database is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const read = async () => {
      throw new Error("Error querying the database: ERROR: exceeded the compute time quota");
    };
    expect(await withDatabaseFallback(read, ["fallback"])).toEqual(["fallback"]);
  });

  it("rethrows genuine bugs so they still reach error tracking", async () => {
    const read = async () => {
      throw new Error("Cannot read properties of undefined (reading 'id')");
    };
    await expect(withDatabaseFallback(read, ["fallback"])).rejects.toThrow("Cannot read properties");
  });
});
