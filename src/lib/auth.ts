import "server-only";

import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const sessionCookieName = "beauty_os_session";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
};

const demoUsers: Record<string, AppUser & { password: string; workspaces: string[] }> = {
  "admin@beautyos.dev": {
    id: "demo_platform_admin",
    email: "admin@beautyos.dev",
    name: "Platform Admin",
    isPlatformAdmin: true,
    password: "password123",
    workspaces: ["osu-glow-studio", "luxe-lash-lab"],
  },
  "owner@osuglow.example": {
    id: "demo_osu_owner",
    email: "owner@osuglow.example",
    name: "Nadia Mensah",
    isPlatformAdmin: false,
    password: "password123",
    workspaces: ["osu-glow-studio"],
  },
  "owner@luxelash.example": {
    id: "demo_luxe_owner",
    email: "owner@luxelash.example",
    name: "Mina Owusu",
    isPlatformAdmin: false,
    password: "password123",
    workspaces: ["luxe-lash-lab"],
  },
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  if (!isDatabaseConfigured()) {
    const email = token.startsWith("demo:") ? token.slice(5) : "";
    const demoUser = demoUsers[email];

    if (!demoUser) {
      return null;
    }

    return {
      id: demoUser.id,
      email: demoUser.email,
      name: demoUser.name,
      isPlatformAdmin: demoUser.isPlatformAdmin,
    };
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isPlatformAdmin: session.user.isPlatformAdmin,
  };
}

export async function signIn(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isDatabaseConfigured()) {
    const demoUser = demoUsers[normalizedEmail];

    if (!demoUser || demoUser.password !== password) {
      return null;
    }

    const cookieStore = await cookies();
    cookieStore.set(sessionCookieName, `demo:${normalizedEmail}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return demoUser;
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }

  await startSession(user.id);
  return user;
}

/// Create a server session for a user and set the session cookie. Used by
/// signIn and by flows that authenticate a user directly (e.g. accepting an
/// invite right after setting a password). DB mode only.
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await prisma.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token && isDatabaseConfigured()) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  cookieStore.delete(sessionCookieName);
}

export async function requireUser(nextPath = "/"): Promise<AppUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  }

  return user;
}

export async function requirePlatformAdmin(): Promise<AppUser> {
  const user = await requireUser("/platform");

  if (!user.isPlatformAdmin) {
    redirect("/");
  }

  return user;
}

export async function canAccessWorkspace(user: AppUser, businessSlug: string) {
  if (user.isPlatformAdmin) {
    return true;
  }

  if (!isDatabaseConfigured()) {
    const demoUser = demoUsers[user.email];
    return Boolean(demoUser?.workspaces.includes(businessSlug));
  }

  const membership = await prisma.staffMember.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      business: { slug: businessSlug },
    },
    select: { id: true },
  });

  return Boolean(membership);
}

export async function requireTenantAccess(businessSlug: string) {
  const user = await requireUser(`/${businessSlug}`);
  const allowed = await canAccessWorkspace(user, businessSlug);

  if (!allowed) {
    redirect("/");
  }

  return user;
}

export function getDemoAccounts() {
  return Object.values(demoUsers).map((user) => ({
    email: user.email,
    name: user.name,
    role: user.isPlatformAdmin ? "Platform admin" : "Business owner",
  }));
}
