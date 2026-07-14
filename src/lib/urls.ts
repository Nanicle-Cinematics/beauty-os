import "server-only";

import { headers } from "next/headers";

// Base URL for building absolute links (invite emails, etc.). Prefers the
// configured APP_URL; falls back to the incoming request host in dev.
export async function getBaseUrl() {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export function inviteUrl(baseUrl: string, token: string) {
  return `${baseUrl}/invite/${token}`;
}
