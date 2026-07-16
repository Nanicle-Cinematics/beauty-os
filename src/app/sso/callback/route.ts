import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { isSocialLoginConfigured, getSocialProfile } from "@/lib/sso";
import { startSession, mfaChallengeCookieName } from "@/lib/auth";
import { signChallenge } from "@/lib/mfa";

export const dynamic = "force-dynamic";

const stateCookie = "beauty_os_sso_state";

function safeNext(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

function timingEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function GET(request: NextRequest) {
  if (!isSocialLoginConfigured()) redirect("/login");

  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state") ?? "";

  const store = await cookies();
  const raw = store.get(stateCookie)?.value ?? "";
  store.delete(stateCookie);
  const [cookieState, encodedNext] = raw.split(".");
  const nextPath = safeNext(encodedNext ? decodeURIComponent(encodedNext) : "/app");

  if (!code || !cookieState || !timingEqual(returnedState, cookieState)) {
    redirect("/login?error=sso");
  }

  let email = "";
  try {
    const profile = await getSocialProfile(code);
    email = String(profile.email ?? "").trim().toLowerCase();
  } catch {
    email = "";
  }
  if (!email) redirect("/login?error=sso");

  // Broker pattern: only sign in an EXISTING account (owners who signed up,
  // staff who accepted an invite). Unknown emails are turned away.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, mfaEnabled: true, emailVerifiedAt: true },
  });
  if (!user) {
    redirect("/login?error=nosso");
  }

  // The IdP verified this email, so mark it verified locally.
  if (!user.emailVerifiedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }

  // Honour app-level 2FA even when arriving via SSO.
  if (user.mfaEnabled) {
    store.set(mfaChallengeCookieName, signChallenge(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
    redirect(`/login/2fa?next=${encodeURIComponent(nextPath)}`);
  }

  await startSession(user.id);
  redirect(nextPath);
}
