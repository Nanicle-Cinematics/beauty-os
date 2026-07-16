import "server-only";

import { headers } from "next/headers";

// Base URL for building absolute links (OAuth callbacks, invite emails, etc.).
// Order: explicit APP_URL override → Vercel's stable production domain (injected
// into every deployment, so callback/redirect URIs stay constant across deploys)
// → the incoming request host (local dev).
export async function getBaseUrl() {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  // e.g. "beauty-os-six.vercel.app" — the same value on every prod/preview build.
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    return `https://${vercelProd.replace(/\/+$/, "")}`;
  }
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function inviteUrl(baseUrl: string, token: string) {
  return `${baseUrl}/invite/${token}`;
}
