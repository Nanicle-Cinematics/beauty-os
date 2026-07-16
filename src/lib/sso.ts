import "server-only";

import { WorkOS } from "@workos-inc/node";

// SSO is inert unless both WorkOS keys are present, so it ships dormant and
// activates by setting env vars (same pattern as Sentry).
export function isSsoConfigured() {
  return Boolean(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID);
}

function client() {
  if (!process.env.WORKOS_API_KEY) throw new Error("WORKOS_API_KEY is not set");
  return new WorkOS(process.env.WORKOS_API_KEY);
}

export type SsoProvider = "google" | "microsoft";

const PROVIDER_IDS: Record<SsoProvider, "GoogleOAuth" | "MicrosoftOAuth"> = {
  google: "GoogleOAuth",
  microsoft: "MicrosoftOAuth",
};

export function toProviderId(value: string): "GoogleOAuth" | "MicrosoftOAuth" | null {
  return value in PROVIDER_IDS ? PROVIDER_IDS[value as SsoProvider] : null;
}

export function getAuthorizationUrl(providerId: "GoogleOAuth" | "MicrosoftOAuth", redirectUri: string, state: string) {
  return client().sso.getAuthorizationUrl({
    clientId: process.env.WORKOS_CLIENT_ID as string,
    redirectUri,
    provider: providerId,
    state,
  });
}

// Exchange the callback code for the IdP-verified profile (email, name, ...).
export async function getSsoProfile(code: string) {
  const { profile } = await client().sso.getProfileAndToken({
    code,
    clientId: process.env.WORKOS_CLIENT_ID as string,
  });
  return profile;
}
