"use server";

import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth";
import { signUpBusiness } from "@/lib/signup-data";

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

  // Log the new owner straight in and drop them into their fresh workspace.
  await startSession(result.userId);
  redirect(`/${result.slug}`);
}
