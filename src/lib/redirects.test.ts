import { describe, expect, it } from "vitest";
import { normalizeInternalPath } from "@/lib/redirects";

describe("normalizeInternalPath", () => {
  it("allows internal absolute paths", () => {
    expect(normalizeInternalPath("/osu-glow-studio/invoices")).toBe("/osu-glow-studio/invoices");
  });

  it("rejects protocol-relative open redirects", () => {
    expect(normalizeInternalPath("//evil.example/login")).toBe("/app");
  });

  it("rejects external URLs and malformed values", () => {
    expect(normalizeInternalPath("https://evil.example/login")).toBe("/app");
    expect(normalizeInternalPath("")).toBe("/app");
    expect(normalizeInternalPath(null, "/")).toBe("/");
  });
});
