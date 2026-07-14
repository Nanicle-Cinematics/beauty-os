import "server-only";

import { createHash, randomBytes } from "crypto";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Issue a fresh verification token for a user, invalidating any prior unused
// ones so only the latest link works. Returns the raw token for the email link.
export async function issueVerificationToken(userId: string): Promise<string | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }
  const token = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
    }),
  ]);
  return token;
}

export type VerifyResult = "verified" | "already" | "invalid";

export async function verifyEmail(token: string): Promise<VerifyResult> {
  if (!isDatabaseConfigured() || !token) {
    return "invalid";
  }
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, emailVerifiedAt: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return "invalid";
  }

  const alreadyVerified = record.user.emailVerifiedAt != null;
  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ...(alreadyVerified
      ? []
      : [prisma.user.update({ where: { id: record.user.id }, data: { emailVerifiedAt: new Date() } })]),
  ]);

  return alreadyVerified ? "already" : "verified";
}
