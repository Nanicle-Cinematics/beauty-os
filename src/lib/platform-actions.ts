"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { setBusinessStatus, changeBusinessPlan } from "@/lib/platform-data";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

// Demo users carry a sentinel id ("demo_*") that is not a real User row, so it
// cannot satisfy the AuditLog.actorUserId foreign key — record those as system.
function actorId(id: string) {
  return id && !id.startsWith("demo_") ? id : null;
}

export async function setBusinessStatusAction(formData: FormData) {
  const admin = await requirePlatformAdmin();

  await setBusinessStatus({
    businessId: getString(formData, "businessId"),
    status: getString(formData, "status"),
    actorUserId: actorId(admin.id),
  });

  revalidatePath("/platform");
}

export async function changeBusinessPlanAction(formData: FormData) {
  const admin = await requirePlatformAdmin();

  await changeBusinessPlan({
    businessId: getString(formData, "businessId"),
    planId: getString(formData, "planId"),
    actorUserId: actorId(admin.id),
  });

  revalidatePath("/platform");
}
