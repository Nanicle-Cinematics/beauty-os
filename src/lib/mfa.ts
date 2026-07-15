import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { generateSecret as otpGenerateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Beauty OS";
// Tolerate ±30s of clock skew between server and authenticator app.
const EPOCH_TOLERANCE = 30;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export function isMfaConfigured() {
  return Boolean(process.env.MFA_SECRET_KEY);
}

function key(): Buffer {
  const hex = process.env.MFA_SECRET_KEY;
  if (!hex) throw new Error("MFA_SECRET_KEY is not set");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("MFA_SECRET_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

// AES-256-GCM. TOTP secrets must be reversible (needed to verify codes), so they
// are ENCRYPTED at rest, not hashed. Stored as base64(iv | authTag | ciphertext).
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** New base32 TOTP secret. */
export function generateSecret(): string {
  return otpGenerateSecret();
}

/** otpauth:// URI + a QR data-URL for the authenticator app. */
export async function buildEnrollment(email: string, secret: string) {
  const otpauth = generateURI({ issuer: ISSUER, label: email, secret, strategy: "totp" });
  const qr = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
  return { otpauth, qr };
}

/** Verify a 6-digit TOTP token against a (decrypted) secret. */
export function verifyTotp(token: string, secret: string): boolean {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  try {
    return verifySync({ token: clean, secret, strategy: "totp", epochTolerance: EPOCH_TOLERANCE }).valid;
  } catch {
    return false;
  }
}

/** Ten human-friendly one-time recovery codes ("xxxxx-xxxxx"). */
export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz"; // no ambiguous chars
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = Array.from(randomBytes(10))
      .map((b) => alphabet[b % alphabet.length])
      .join("");
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(input: string): string {
  return input.trim().toLowerCase().replace(/\s/g, "");
}

// ---- Short-lived login challenge (between password step and 2FA step) -------
// Stateless, HMAC-signed cookie value so no DB row is needed for the interstitial.

export function signChallenge(userId: string): string {
  const exp = Date.now() + CHALLENGE_TTL_MS;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", process.env.MFA_SECRET_KEY ?? "").update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyChallenge(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const expected = createHmac("sha256", process.env.MFA_SECRET_KEY ?? "").update(`${userId}.${expStr}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!Number(expStr) || Number(expStr) < Date.now()) return null;
  return userId;
}
