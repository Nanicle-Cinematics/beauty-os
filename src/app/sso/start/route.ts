import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isSocialLoginConfigured, toProviderId, getAuthorizationUrl } from "@/lib/sso";
import { getBaseUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

const stateCookie = "beauty_os_sso_state";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  if (!isSocialLoginConfigured()) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const providerId = toProviderId(url.searchParams.get("provider") ?? "");
  if (!providerId) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const nextPath = safeNext(url.searchParams.get("next"));
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${await getBaseUrl()}/sso/callback`;
  const authUrl = getAuthorizationUrl(providerId, redirectUri, state);

  const res = NextResponse.redirect(authUrl);
  // CSRF state + the post-login destination, verified on callback.
  res.cookies.set(stateCookie, `${state}.${encodeURIComponent(nextPath)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}
