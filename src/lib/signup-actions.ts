"use server";

import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth";
import { signUpBusiness } from "@/lib/signup-data";
import { issueVerificationToken } from "@/lib/verification-data";
import { sendVerificationEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/urls";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function signUpAction(formData: FormData) {
  const result = await signUpBusiness({
    businessName: getString(formData, "businessName"),
    categoryId: getString(formData, "categoryId"),
    ownerName: getString(formData, "ownerName"),
    ownerEmail: getString(formData, "ownerEmail"),
    ownerPassword: getString(formData, "ownerPassword"),
  });

  if (!result.ok) {
    redirect(`/signup?error=${encodeURIComponent(result.error)}`);
  }

  // Send an email-verification link (best-effort — signup still succeeds if it
  // can't send). The account works right away; the app nudges until verified.
  const token = await issueVerificationToken(result.userId);
  if (token) {
    const url = `${await getBaseUrl()}/verify/${token}`;
    await sendVerificationEmail({
      to: result.ownerEmail,
      name: result.ownerName,
      url,
      businessId: result.businessId,
    });
  }

  // Log the new owner in, but they land on the /verify-email gate until they
  // confirm their address (hard email gating).
  await startSession(result.userId);
  redirect("/verify-email");
}
