import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dynamic, GET } from "./route";

describe("/api/healthz", () => {
  it("answers 200 ok, uncached", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ status: "ok", app: "beauty-os" });
  });

  it("runs as a live function, not a build-time copy", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  // The monitor polls this every minute; any import is a way back to Prisma.
  it("imports nothing, so it can never wake the database", () => {
    const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
