import "server-only";

import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  isMfaConfigured,
  encryptSecret,
  decryptSecret,
  generateSecret,
  buildEnrollment,
  verifyTotp,
  generateRecoveryCodes,
  normalizeRecoveryCode,
} from "@/lib/mfa";

export type MfaStatus = { configured: boolean; enabled: boolean; pending: boolean; recoveryRemaining: number };

export async function getMfaStatus(userId: string): Promise<MfaStatus> {
  if (!isDatabaseConfigured()) return { configured: false, enabled: false, pending: false, recoveryRemaining: 0 };
  const [u, recoveryRemaining] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { mfaEnabled: true, mfaSecret: true } }),
    prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } }),
  ]);
  return {
    configured: isMfaConfigured(),
    enabled: Boolean(u?.mfaEnabled),
    pending: Boolean(u?.mfaSecret && !u?.mfaEnabled),
    recoveryRemaining,
  };
}

// Rebuild the QR + secret for an in-progress (pending) enrollment, so the
// setup card survives a page refresh without minting a new secret each time.
export async function getPendingEnrollment(userId: string, email: string): Promise<{ qr: string; secret: string } | null> {
  if (!isMfaConfigured() || !isDatabaseConfigured()) return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { mfaSecret: true, mfaEnabled: true } });
  if (!u?.mfaSecret || u.mfaEnabled) return null;
  const secret = decryptSecret(u.mfaSecret);
  const { qr } = await buildEnrollment(email, secret);
  return { qr, secret };
}

export async function startMfaSetup(userId: string, email: string): Promise<{ qr: string; secret: string } | null> {
  if (!isMfaConfigured() || !isDatabaseConfigured()) return null;
  const secret = generateSecret();
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: encryptSecret(secret), mfaEnabled: false } });
  const { qr } = await buildEnrollment(email, secret);
  return { qr, secret };
}

export async function confirmMfaSetup(userId: string, code: string): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  if (!isMfaConfigured()) return { ok: false, error: "Two-factor is not available right now." };
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { mfaSecret: true, mfaEnabled: true } });
  if (!u?.mfaSecret) return { ok: false, error: "Start the setup again to get a fresh code." };
  if (u.mfaEnabled) return { ok: false, error: "Two-factor is already on." };
  if (!verifyTotp(code, decryptSecret(u.mfaSecret))) return { ok: false, error: "That code didn't match. Check your app and try again." };

  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((c) => hashPassword(normalizeRecoveryCode(c))));
  await tenantTransaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) });
  });
  return { ok: true, recoveryCodes: codes };
}

// Accepts a 6-digit TOTP or an unused recovery code. Used at login and to gate
// sensitive changes (disable / regenerate).
export async function verifyMfaCode(userId: string, code: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { mfaSecret: true, mfaEnabled: true } });
  if (!u?.mfaEnabled || !u.mfaSecret) return false;

  const clean = code.replace(/\s/g, "");
  if (/^\d{6}$/.test(clean) && verifyTotp(clean, decryptSecret(u.mfaSecret))) return true;

  const norm = normalizeRecoveryCode(code);
  if (!norm.includes("-")) return false;
  const unused = await prisma.mfaRecoveryCode.findMany({ where: { userId, usedAt: null }, select: { id: true, codeHash: true } });
  for (const rc of unused) {
    if (await verifyPassword(norm, rc.codeHash)) {
      await prisma.mfaRecoveryCode.update({ where: { id: rc.id }, data: { usedAt: new Date() } });
      return true;
    }
  }
  return false;
}

export async function disableMfa(userId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyMfaCode(userId, code))) return { ok: false, error: "Enter a valid code to turn off two-factor." };
  await tenantTransaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
  });
  return { ok: true };
}

export async function regenerateRecoveryCodes(userId: string, code: string): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  if (!(await verifyMfaCode(userId, code))) return { ok: false, error: "Enter a valid code first." };
  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((c) => hashPassword(normalizeRecoveryCode(c))));
  await tenantTransaction(async (tx) => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) });
  });
  return { ok: true, recoveryCodes: codes };
}
