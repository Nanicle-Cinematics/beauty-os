"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { updateProfile, changePassword } from "@/lib/settings-data";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser("/settings");

  const result = await updateProfile({
    userId: user.id,
    name: getString(formData, "name"),
    phone: getString(formData, "phone"),
  });

  redirect(result.ok ? "/settings?updated=profile" : `/settings?error=${encodeURIComponent(result.error)}`);
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser("/settings");

  const newPassword = getString(formData, "newPassword");
  const confirmPassword = getString(formData, "confirmPassword");
  if (newPassword !== confirmPassword) {
    redirect(`/settings?error=${encodeURIComponent("New password and confirmation don't match.")}`);
  }

  const result = await changePassword({
    userId: user.id,
    currentPassword: getString(formData, "currentPassword"),
    newPassword,
  });

  redirect(result.ok ? "/settings?updated=password" : `/settings?error=${encodeURIComponent(result.error)}`);
}
