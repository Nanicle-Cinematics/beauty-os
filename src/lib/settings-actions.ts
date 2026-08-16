"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { updateProfile, changePassword } from "@/lib/settings-data";
import { normalizeTheme } from "@/lib/theme";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

async function avatarFromForm(formData: FormData) {
  const remove = getString(formData, "removeAvatar") === "true";
  if (remove) return null;

  const file = formData.get("avatarFile");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      return { error: "Profile picture upload must be an image file." };
    }
    if (file.size > 750_000) {
      return { error: "Profile picture must be 750KB or smaller." };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    return `data:${file.type};base64,${bytes.toString("base64")}`;
  }

  const url = getString(formData, "avatarUrl").trim();
  if (url) return url;
  return getString(formData, "currentAvatarUrl");
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser("/settings");
  const avatar = await avatarFromForm(formData);
  if (typeof avatar === "object" && avatar && "error" in avatar) {
    redirect(`/settings?error=${encodeURIComponent(avatar.error)}`);
  }

  const themePreference = normalizeTheme(getString(formData, "themePreference"));

  const result = await updateProfile({
    userId: user.id,
    name: getString(formData, "name"),
    phone: getString(formData, "phone"),
    avatarUrl: avatar,
    themePreference,
  });

  if (result.ok) {
    const cookieStore = await cookies();
    cookieStore.set("beauty_os_theme", themePreference, {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

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
