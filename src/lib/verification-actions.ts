"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { issueVerificationToken } from "@/lib/verification-data";
import { sendVerificationEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/urls";
import { checkRateLimit, retryMessage } from "@/lib/rate-limit";

export async function resendVerificationAction() {
  const user = await requireSession("/verify-email");

  if (user.verified) {
    redirect("/app");
  }

  // Throttle resends per user so it can't be used to email-bomb an inbox or
  // burn the email quota. 4 per hour.
  const rate = await checkRateLimit(`verify-resend:${user.id}`, 4, 60 * 60 * 1000);
  if (!rate.allowed) {
    redirect(`/verify-email?error=${encodeURIComponent(retryMessage("Too many requests.", rate.retryAfterSec))}`);
  }

  const token = await issueVerificationToken(user.id);
  if (token) {
    const url = `${await getBaseUrl()}/verify/${token}`;
    await sendVerificationEmail({ to: user.email, name: user.name, url });
  }

  redirect("/verify-email?verify=sent");
}
