"use server";

import { redirect } from "next/navigation";
import { requireUser, signOut } from "@/lib/auth";
import { deleteOwnedWorkspace, deleteAccount } from "@/lib/account-data";

export async function deleteWorkspaceAction(formData: FormData) {
  const user = await requireUser("/settings");
  const businessId = String(formData.get("businessId") ?? "");
  const result = await deleteOwnedWorkspace(user.id, businessId);

  if (!result.ok) {
    redirect(`/settings?error=${encodeURIComponent(result.error ?? "Could not delete the workspace.")}`);
  }
  // If this was the user's only workspace, deleteBusiness also removed their
  // (now orphaned) account and their sessions — /app then bounces to /login.
  redirect("/app?deleted=workspace");
}

export async function deleteAccountAction() {
  const user = await requireUser("/settings");
  const result = await deleteAccount(user.id);

  if (!result.ok) {
    redirect(`/settings?error=${encodeURIComponent(result.error ?? "Could not delete your account.")}`);
  }
  await signOut(); // clear the session cookie (the DB session is already gone)
  redirect("/login?deleted=account");
}
