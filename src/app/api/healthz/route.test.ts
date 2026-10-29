import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dynamic, GET } from "./route";

describe("/api/healthz", () => {
  it("answers 200 ok, uncached", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ status: "ok", app: "beauty-os" });
  });

  describe("which build is live", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("reports the commit and deployment id from a git deploy", async () => {
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "bc7fa8c0123456789abcdef0123456789abcdef0");
      vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_2ePNneZizUeDVzw9kmp4WnidjMe2");
      expect(await GET().json()).toMatchObject({ commit: "bc7fa8c", deployment: "dpl_2ePNneZizUeDVzw9kmp4WnidjMe2" });
    });

    // A CLI deploy sets the SHA to "" — report null rather than an empty string.
    it("still identifies a CLI deploy, which has no commit", async () => {
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
      vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_2ePNneZizUeDVzw9kmp4WnidjMe2");
      expect(await GET().json()).toMatchObject({ commit: null, deployment: "dpl_2ePNneZizUeDVzw9kmp4WnidjMe2" });
    });
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
