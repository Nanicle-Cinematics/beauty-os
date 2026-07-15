import { describe, it, expect, beforeAll } from "vitest";
import { generateSync } from "otplib";
import {
  encryptSecret,
  decryptSecret,
  generateSecret,
  verifyTotp,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  signChallenge,
  verifyChallenge,
} from "@/lib/mfa";

// mfa.ts reads MFA_SECRET_KEY at call time, so setting it here is enough.
beforeAll(() => {
  process.env.MFA_SECRET_KEY = "0".repeat(64); // 32 bytes hex
});

describe("secret encryption (AES-256-GCM)", () => {
  it("round-trips and is non-deterministic (random IV)", () => {
    const secret = generateSecret();
    const a = encryptSecret(secret);
    const b = encryptSecret(secret);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(secret);
    expect(decryptSecret(b)).toBe(secret);
  });
  it("rejects a tampered ciphertext", () => {
    const enc = encryptSecret("hello");
    const tampered = enc.slice(0, -4) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-3);
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe("verifyTotp", () => {
  it("accepts a live token for the secret and rejects wrong/garbage", () => {
    const secret = generateSecret();
    const token = generateSync({ secret, strategy: "totp" });
    expect(verifyTotp(token, secret)).toBe(true);
    expect(verifyTotp("000000", secret)).toBe(false);
    expect(verifyTotp("notacode", secret)).toBe(false);
    expect(verifyTotp(token, generateSecret())).toBe(false);
  });
});

describe("recovery codes", () => {
  it("generates 10 unique xxxxx-xxxxx codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[2-9a-hjkmnp-z]{5}-[2-9a-hjkmnp-z]{5}$/);
  });
  it("normalizes user input", () => {
    expect(normalizeRecoveryCode("  ABCDE-FGHJK ")).toBe("abcde-fghjk");
  });
});

describe("login challenge token", () => {
  it("round-trips the userId and rejects tampering/expiry", () => {
    const token = signChallenge("user_123");
    expect(verifyChallenge(token)).toBe("user_123");
    expect(verifyChallenge(undefined)).toBeNull();
    expect(verifyChallenge("garbage")).toBeNull();
    expect(verifyChallenge(token.slice(0, -2) + "zz")).toBeNull();
    // expired
    const expired = "user_123.1.deadbeef";
    expect(verifyChallenge(expired)).toBeNull();
  });
});
