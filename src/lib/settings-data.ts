import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export type Account = { name: string; phone: string; email: string; verified: boolean };

export async function getAccount(userId: string): Promise<Account | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, phone: true, email: true, emailVerifiedAt: true },
  });
  if (!user) {
    return null;
  }
  return { name: user.name, phone: user.phone ?? "", email: user.email, verified: user.emailVerifiedAt != null };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateProfile({ userId, name, phone }: { userId: string; name: string; phone: string }): Promise<ActionResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "Not available right now." };
  }
  const cleanName = name.trim();
  if (!cleanName) {
    return { ok: false, error: "Name can't be empty." };
  }
  await prisma.user.update({ where: { id: userId }, data: { name: cleanName, phone: phone.trim() || null } });
  return { ok: true };
}

export async function changePassword({
  userId,
  currentPassword,
  newPassword,
}: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "Not available right now." };
  }
  if (!currentPassword || !newPassword) {
    return { ok: false, error: "Both your current and new password are required." };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) {
    return { ok: false, error: "Account not found." };
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    return { ok: false, error: "New password must be different from your current one." };
  }

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  return { ok: true };
}
