"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { issueVerificationToken } from "@/lib/verification-data";
import { sendVerificationEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/urls";

export async function resendVerificationAction() {
  const user = await requireSession("/verify-email");

  if (user.verified) {
    redirect("/app");
  }

  const token = await issueVerificationToken(user.id);
  if (token) {
    const url = `${await getBaseUrl()}/verify/${token}`;
    await sendVerificationEmail({ to: user.email, name: user.name, url });
  }

  redirect("/verify-email?verify=sent");
}
