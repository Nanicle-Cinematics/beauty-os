"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/client-data";
import { requireTenantAccess } from "@/lib/auth";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createClientAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  await createClient({
    businessSlug,
    firstName: getString(formData, "firstName"),
    lastName: getString(formData, "lastName"),
    phone: getString(formData, "phone"),
    email: getString(formData, "email"),
    city: getString(formData, "city"),
    birthdate: parseDate(getString(formData, "birthdate")),
    tags: parseTags(getString(formData, "tags")),
    skinNotes: getString(formData, "skinNotes"),
    allergies: getString(formData, "allergies"),
  });

  revalidatePath(`/${businessSlug}/clients`);
  redirect(`/${businessSlug}/clients`);
}
