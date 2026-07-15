import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing (scrypt)", () => {
  it("produces a scrypt$salt$key hash and verifies the right password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("s3cret-pass");
    expect(await verifyPassword("s3cret-Pass", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts each hash (same password -> different hashes)", async () => {
    const a = await hashPassword("samePass123");
    const b = await hashPassword("samePass123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("samePass123", a)).toBe(true);
    expect(await verifyPassword("samePass123", b)).toBe(true);
  });

  it("returns false (never throws) on a malformed stored hash", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc$def")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});
