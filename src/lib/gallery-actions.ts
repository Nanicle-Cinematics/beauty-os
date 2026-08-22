"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createGallery,
  sendGallery,
  unlockGallery,
  completeGallery,
  revokeGallery,
  deleteGallery,
  favoriteGalleryMedia,
  recordGalleryMediaView,
  commentOnGallery,
} from "@/lib/gallery-data";
import { requireTenantAccess } from "@/lib/auth";
import { authorizeCapability, CAPABILITY_MODULE, type Capability } from "@/lib/permissions";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function combinedMediaUrls(formData: FormData) {
  return [getString(formData, "mediaUrls"), getString(formData, "mediaUploadDataUrls")]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

async function authorize(businessSlug: string, capability: Capability) {
  const user = await requireTenantAccess(businessSlug);
  const { allowed, blockedByPlan } = await authorizeCapability(user, businessSlug, capability);
  // Blocked by the plan rather than the role: send them to the upgrade page.
  // Telling a manager they lack permission to do their own job would read as a
  // broken account, when the real answer is that the workspace never bought it.
  if (blockedByPlan) {
    redirect(`/${businessSlug}/upgrade?module=${CAPABILITY_MODULE[capability]}`);
  }
  return allowed;
}

function safeReturnTo(value: string, businessSlug: string) {
  return value.startsWith(`/${businessSlug}/`) ? value : `/${businessSlug}/galleries`;
}

async function publicSessionId() {
  const jar = await cookies();
  const existing = jar.get("beauty_gallery_session")?.value;
  if (existing) return existing;
  const value = crypto.randomUUID();
  jar.set("beauty_gallery_session", value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/gallery",
    maxAge: 60 * 60 * 24 * 45,
  });
  return value;
}

export async function createGalleryAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  if (!(await authorize(businessSlug, "galleries:edit"))) {
    redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent("You don't have permission to create galleries.")}`);
  }

  const rawCustom = getString(formData, "customExpiry");
  const customExpiry = rawCustom ? new Date(`${rawCustom}T23:59:59.000Z`) : null;
  const result = await createGallery({
    businessSlug,
    appointmentId: getString(formData, "appointmentId"),
    invoiceId: getString(formData, "invoiceId"),
    title: getString(formData, "title"),
    expiry: getString(formData, "expiry"),
    customExpiry: customExpiry && !Number.isNaN(customExpiry.getTime()) ? customExpiry : null,
    mediaUrls: combinedMediaUrls(formData),
  });

  revalidatePath(`/${businessSlug}/galleries`);
  if (!result.ok) redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent(result.error)}`);
  redirect(`/${businessSlug}/galleries?toast=${encodeURIComponent("Secure gallery created")}`);
}

export async function sendGalleryAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  if (!(await authorize(businessSlug, "galleries:edit"))) {
    redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent("You don't have permission to send galleries.")}`);
  }
  const result = await sendGallery(businessSlug, getString(formData, "galleryId"));
  revalidatePath(`/${businessSlug}/galleries`);
  if (!result.ok) redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent(result.error)}`);
  redirect(`/${businessSlug}/galleries?toast=${encodeURIComponent("Gallery marked as sent. Use Email, WhatsApp, SMS, or copy the secure link to share it.")}`);
}

export async function unlockGalleryAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  if (!(await authorize(businessSlug, "galleries:unlock"))) {
    redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent("Only owners and managers can unlock galleries.")}`);
  }
  const returnTo = safeReturnTo(getString(formData, "returnTo"), businessSlug);
  const result = await unlockGallery(businessSlug, getString(formData, "galleryId"));
  revalidatePath(`/${businessSlug}/galleries`);
  revalidatePath(returnTo);
  if (!result.ok) redirect(`${returnTo}?toastError=${encodeURIComponent(result.error)}`);
  redirect(`${returnTo}?toast=${encodeURIComponent("Payment confirmed. Client gallery remains preview-only.")}`);
}

export async function completeGalleryAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  if (!(await authorize(businessSlug, "galleries:complete"))) {
    redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent("Only owners and managers can complete galleries.")}`);
  }
  const result = await completeGallery(businessSlug, getString(formData, "galleryId"));
  revalidatePath(`/${businessSlug}/galleries`);
  if (!result.ok) redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent(result.error)}`);
  redirect(`/${businessSlug}/galleries?toast=${encodeURIComponent("Gallery completed. Send a thank-you or review request next.")}`);
}

export async function revokeGalleryAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  if (!(await authorize(businessSlug, "galleries:unlock"))) {
    redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent("Only owners and managers can revoke galleries.")}`);
  }
  const result = await revokeGallery(businessSlug, getString(formData, "galleryId"));
  revalidatePath(`/${businessSlug}/galleries`);
  if (!result.ok) redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent(result.error)}`);
  redirect(`/${businessSlug}/galleries?toast=${encodeURIComponent("Gallery access revoked")}`);
}

export async function deleteGalleryAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  if (!(await authorize(businessSlug, "galleries:delete"))) {
    redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent("Only owners and managers can delete galleries.")}`);
  }
  const result = await deleteGallery(businessSlug, getString(formData, "galleryId"));
  revalidatePath(`/${businessSlug}/galleries`);
  if (!result.ok) redirect(`/${businessSlug}/galleries?toastError=${encodeURIComponent(result.error)}`);
  redirect(`/${businessSlug}/galleries?toast=${encodeURIComponent("Gallery deleted permanently")}`);
}

export async function favoriteGalleryMediaAction(formData: FormData) {
  const token = getString(formData, "token");
  const sessionId = await publicSessionId();
  await favoriteGalleryMedia(token, getString(formData, "mediaId"), sessionId);
  revalidatePath(`/gallery/${token}`);
}

export async function recordGalleryMediaViewAction(token: string, mediaId: string) {
  const sessionId = await publicSessionId();
  await recordGalleryMediaView(token, mediaId, sessionId);
}

export async function commentOnGalleryAction(formData: FormData) {
  const token = getString(formData, "token");
  const sessionId = await publicSessionId();
  const result = await commentOnGallery(token, getString(formData, "mediaId") || null, getString(formData, "body"), getString(formData, "author"), sessionId);
  revalidatePath(`/gallery/${token}`);
  if (!result.ok) redirect(`/gallery/${token}?toastError=${encodeURIComponent(result.error)}`);
  redirect(`/gallery/${token}?toast=${encodeURIComponent("Comment added")}`);
}
