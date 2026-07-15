"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signIn, startSession, mfaChallengeCookieName } from "@/lib/auth";
import { signChallenge, verifyChallenge } from "@/lib/mfa";
import { verifyMfaCode } from "@/lib/mfa-data";

function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/app";
  }

  return value;
}

async function setChallengeCookie(userId: string) {
  const store = await cookies();
  store.set(mfaChallengeCookieName, signChallenge(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(formData.get("next"));
  const result = await signIn(email, password);

  if (result.status === "invalid") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}&error=invalid`);
  }

  if (result.status === "mfa") {
    await setChallengeCookie(result.userId);
    redirect(`/login/2fa?next=${encodeURIComponent(nextPath)}`);
  }

  redirect(nextPath);
}

export async function verifyMfaAction(formData: FormData) {
  const nextPath = safeNextPath(formData.get("next"));
  const code = String(formData.get("code") ?? "");

  const store = await cookies();
  const userId = verifyChallenge(store.get(mfaChallengeCookieName)?.value);
  if (!userId) {
    // Challenge missing or expired — restart from the password step.
    redirect("/login?error=expired");
  }

  if (!(await verifyMfaCode(userId, code))) {
    redirect(`/login/2fa?next=${encodeURIComponent(nextPath)}&error=1`);
  }

  await startSession(userId);
  store.delete(mfaChallengeCookieName);
  redirect(nextPath);
}
