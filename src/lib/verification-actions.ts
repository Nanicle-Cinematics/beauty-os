"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { issueVerificationToken } from "@/lib/verification-data";
import { sendVerificationEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/urls";

export async function resendVerificationAction() {
  const user = await requireUser("/app");

  if (user.verified) {
    redirect("/app?verify=already");
  }

  const token = await issueVerificationToken(user.id);
  if (token) {
    const url = `${await getBaseUrl()}/verify/${token}`;
    await sendVerificationEmail({ to: user.email, name: user.name, url });
  }

  redirect("/app?verify=sent");
}
