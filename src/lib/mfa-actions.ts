"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { startMfaSetup, confirmMfaSetup, disableMfa, regenerateRecoveryCodes } from "@/lib/mfa-data";

export type MfaActionState = { ok?: boolean; error?: string; recoveryCodes?: string[] };

export async function startMfaAction(): Promise<void> {
  const user = await requireUser("/settings");
  await startMfaSetup(user.id, user.email);
  revalidatePath("/settings");
}

export async function confirmMfaAction(_prev: MfaActionState, formData: FormData): Promise<MfaActionState> {
  const user = await requireUser("/settings");
  const result = await confirmMfaSetup(user.id, String(formData.get("code") ?? ""));
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/settings");
  return { ok: true, recoveryCodes: result.recoveryCodes };
}

export async function disableMfaAction(_prev: MfaActionState, formData: FormData): Promise<MfaActionState> {
  const user = await requireUser("/settings");
  const result = await disableMfa(user.id, String(formData.get("code") ?? ""));
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/settings");
  return { ok: true };
}

export async function regenerateRecoveryAction(_prev: MfaActionState, formData: FormData): Promise<MfaActionState> {
  const user = await requireUser("/settings");
  const result = await regenerateRecoveryCodes(user.id, String(formData.get("code") ?? ""));
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/settings");
  return { ok: true, recoveryCodes: result.recoveryCodes };
}
