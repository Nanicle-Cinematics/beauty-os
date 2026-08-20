import "server-only";

import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { setTenantContext } from "@/lib/tenant-context";
import { workspaceHasModule } from "@/lib/entitlement-data";
import type { ModuleKey } from "@/lib/entitlements";
import { normalizeTheme, type ThemePreference } from "@/lib/theme";
import { isTrialExpired } from "@/lib/trial";
import { normalizeInternalPath } from "@/lib/redirects";

export const sessionCookieName = "beauty_os_session";
export const mfaChallengeCookieName = "beauty_os_mfa";

export type SignInResult =
  | { status: "ok" }
  | { status: "mfa"; userId: string }
  | { status: "invalid" };

export type AppUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  themePreference: ThemePreference;
  isPlatformAdmin: boolean;
  verified: boolean;
};

const demoUsers: Record<string, Omit<AppUser, "verified"> & { password: string; workspaces: string[] }> = {
  "admin@beautyos.dev": {
    id: "demo_platform_admin",
    email: "admin@beautyos.dev",
    name: "Platform Admin",
    avatarUrl: null,
    themePreference: "liquid",
    isPlatformAdmin: true,
    password: "password123",
    workspaces: ["osu-glow-studio", "luxe-lash-lab"],
  },
  "owner@osuglow.example": {
    id: "demo_osu_owner",
    email: "owner@osuglow.example",
    name: "Nadia Mensah",
    avatarUrl: null,
    themePreference: "blush",
    isPlatformAdmin: false,
    password: "password123",
    workspaces: ["osu-glow-studio"],
  },
  "owner@luxelash.example": {
    id: "demo_luxe_owner",
    email: "owner@luxelash.example",
    name: "Mina Owusu",
    avatarUrl: null,
    themePreference: "ocean",
    isPlatformAdmin: false,
    password: "password123",
    workspaces: ["luxe-lash-lab"],
  },
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
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
      avatarUrl: demoUser.avatarUrl,
      themePreference: demoUser.themePreference,
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
    avatarUrl: session.user.avatarUrl,
    themePreference: normalizeTheme(session.user.themePreference),
    isPlatformAdmin: session.user.isPlatformAdmin,
    verified: session.user.emailVerifiedAt != null,
  };
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isDatabaseConfigured()) {
    const demoUser = demoUsers[normalizedEmail];

    if (!demoUser || demoUser.password !== password) {
      return { status: "invalid" };
    }

    const cookieStore = await cookies();
    cookieStore.set(sessionCookieName, `demo:${normalizedEmail}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    cookieStore.set("beauty_os_theme", demoUser.themePreference, {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return { status: "ok" };
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { status: "invalid" };
  }

  // Password is correct. If 2FA is on, don't start a session yet — the caller
  // issues a short-lived challenge and requires a code first.
  if (user.mfaEnabled) {
    return { status: "mfa", userId: user.id };
  }

  await startSession(user.id);
  return { status: "ok" };
}

/// Create a server session for a user and set the session cookie. Used by
/// signIn and by flows that authenticate a user directly (e.g. accepting an
/// invite right after setting a password). DB mode only.
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { themePreference: true },
  });

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
  cookieStore.set("beauty_os_theme", normalizeTheme(user?.themePreference), {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
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
  cookieStore.delete("beauty_os_theme");
}

// Require a logged-in user but NOT a verified email. Used only by the
// /verify-email gate page itself, so unverified users can reach it.
export async function requireSession(nextPath = "/"): Promise<AppUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(normalizeInternalPath(nextPath, "/"))}`);
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

/**
 * Whether the user belongs to this workspace at all — membership only, with no
 * view on whether the trial has run out.
 *
 * Kept separate from canAccessWorkspace because a lapsed trial is a billing
 * state, not an authorization one. Data export has to remain reachable while a
 * workspace is locked: refusing to hand people their own records at the exact
 * moment they are most likely to want them is the wrong answer, and a data
 * subject's right to their data does not lapse with a trial.
 */
export async function hasWorkspaceMembership(user: AppUser, businessSlug: string) {
  if (user.isPlatformAdmin) {
    return true;
  }

  if (!isDatabaseConfigured()) {
    const demoUser = demoUsers[user.email];
    return Boolean(demoUser?.workspaces.includes(businessSlug));
  }

  const membership = await prisma.staffMember.findFirst({
    where: { userId: user.id, status: "ACTIVE", business: { slug: businessSlug } },
    select: { id: true },
  });

  return Boolean(membership);
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
    select: {
      id: true,
      business: {
        select: {
          status: true,
          createdAt: true,
          subscription: { select: { status: true, trialEndsAt: true } },
        },
      },
    },
  });

  if (!membership) {
    return false;
  }

  return !isTrialExpired({
    businessStatus: membership.business.status,
    businessCreatedAt: membership.business.createdAt,
    subscriptionStatus: membership.business.subscription?.status,
    subscriptionTrialEndsAt: membership.business.subscription?.trialEndsAt,
  });
}

export async function isWorkspaceTrialLocked(user: AppUser, businessSlug: string) {
  if (user.isPlatformAdmin || !isDatabaseConfigured()) {
    return false;
  }

  const membership = await prisma.staffMember.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      business: { slug: businessSlug },
    },
    select: {
      business: {
        select: {
          status: true,
          createdAt: true,
          subscription: { select: { status: true, trialEndsAt: true } },
        },
      },
    },
  });

  if (!membership) {
    return false;
  }

  return isTrialExpired({
    businessStatus: membership.business.status,
    businessCreatedAt: membership.business.createdAt,
    subscriptionStatus: membership.business.subscription?.status,
    subscriptionTrialEndsAt: membership.business.subscription?.trialEndsAt,
  });
}

/**
 * Guard for every tenant-scoped surface: signed in, verified, a member of this
 * workspace, and not locked out by a lapsed trial. Also pins the tenant context
 * so RLS enforces the boundary for the rest of the request.
 *
 * `allowTrialLocked` lets a locked workspace through. It exists for data export
 * and nothing else — see hasWorkspaceMembership. Membership is still required;
 * this relaxes billing state, never authorization.
 */
export async function requireTenantAccess(
  businessSlug: string,
  {
    allowTrialLocked = false,
    module,
  }: { allowTrialLocked?: boolean; module?: ModuleKey } = {},
) {
  const user = await requireUser(`/${businessSlug}`);

  if (!allowTrialLocked) {
    const trialLocked = await isWorkspaceTrialLocked(user, businessSlug);
    if (trialLocked) {
      redirect(`/trial-expired?workspace=${encodeURIComponent(businessSlug)}`);
    }
  }

  // canAccessWorkspace folds the trial check into its answer, so a locked
  // workspace would be rejected here too — membership alone is the right
  // question once the caller has opted into serving locked tenants.
  const allowed = allowTrialLocked
    ? await hasWorkspaceMembership(user, businessSlug)
    : await canAccessWorkspace(user, businessSlug);

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

  // Plan gating comes last, once the tenant is resolved and scoped. It is a
  // billing state, not an authorization one: the caller is a legitimate member
  // of a workspace whose plan does not include this module, so they are sent to
  // the upgrade page rather than bounced out of the workspace. Platform admins
  // are the vendor and see everything.
  if (module && !user.isPlatformAdmin) {
    if (!(await workspaceHasModule(businessSlug, module))) {
      redirect(`/${businessSlug}/upgrade?module=${encodeURIComponent(module)}`);
    }
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
