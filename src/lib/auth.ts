import "server-only";

import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { setTenantContext } from "@/lib/tenant-context";

export const sessionCookieName = "beauty_os_session";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  verified: boolean;
};

const demoUsers: Record<string, Omit<AppUser, "verified"> & { password: string; workspaces: string[] }> = {
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
  // Auth + workspace resolution is cross-tenant by nature (session/user lookups,
  // membership checks). Default the request to RLS-bypass; requireTenantAccess
  // narrows it to a single business for tenant data access.
  setTenantContext({ bypass: true });

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
      verified: true,
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
    verified: session.user.emailVerifiedAt != null,
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

// Require a logged-in user but NOT a verified email. Used only by the
// /verify-email gate page itself, so unverified users can reach it.
export async function requireSession(nextPath = "/"): Promise<AppUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  }

  return user;
}

// Require a logged-in AND email-verified user. Unverified users are sent to the
// /verify-email gate. Every authenticated surface flows through here (directly,
// or via requireTenantAccess / requirePlatformAdmin), so this is the hard gate.
export async function requireUser(nextPath = "/"): Promise<AppUser> {
  const user = await requireSession(nextPath);

  if (!user.verified) {
    redirect("/verify-email");
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

  // Scope the rest of this request to the resolved tenant so RLS enforces it.
  // Resolution above ran under bypass; this narrows to the one business.
  if (isDatabaseConfigured()) {
    const business = await prisma.business.findUnique({
      where: { slug: businessSlug },
      select: { id: true },
    });
    if (!business) {
      redirect("/");
    }
    setTenantContext({ businessId: business.id });
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
