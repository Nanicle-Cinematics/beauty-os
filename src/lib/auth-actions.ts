"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(formData.get("next"));
  const user = await signIn(email, password);

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}&error=invalid`);
  }

  redirect(nextPath);
}
