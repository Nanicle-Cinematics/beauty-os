import "server-only";

import { WorkOS } from "@workos-inc/node";

// Google / Microsoft SOCIAL login via WorkOS AuthKit (User Management API).
//
// These are FREE OAuth providers (part of AuthKit, free to 1M MAU). They are
// deliberately NOT enterprise SSO/SAML "connections", which WorkOS bills per
// connection. Enterprise SSO / SAML / SCIM (Directory Sync) is reserved for a
// future paid Enterprise Beauty OS plan and is intentionally not wired here, so
// onboarding ordinary customers never incurs a WorkOS per-connection charge.
//
// Ships dormant: inert unless both WorkOS keys are present (activates via env).
export function isSocialLoginConfigured() {
  return Boolean(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID);
}

function client() {
  if (!process.env.WORKOS_API_KEY) throw new Error("WORKOS_API_KEY is not set");
  return new WorkOS(process.env.WORKOS_API_KEY);
}

export type SocialProvider = "google" | "microsoft";

const PROVIDER_IDS: Record<SocialProvider, "GoogleOAuth" | "MicrosoftOAuth"> = {
  google: "GoogleOAuth",
  microsoft: "MicrosoftOAuth",
};

export function toProviderId(value: string): "GoogleOAuth" | "MicrosoftOAuth" | null {
  return value in PROVIDER_IDS ? PROVIDER_IDS[value as SocialProvider] : null;
}

// AuthKit social-login authorization URL (free OAuth provider path).
export function getAuthorizationUrl(providerId: "GoogleOAuth" | "MicrosoftOAuth", redirectUri: string, state: string) {
  return client().userManagement.getAuthorizationUrl({
    clientId: process.env.WORKOS_CLIENT_ID as string,
    redirectUri,
    provider: providerId,
    state,
  });
}

// Exchange the callback code for the OAuth-verified user (email, name).
export async function getSocialProfile(code: string) {
  const { user } = await client().userManagement.authenticateWithCode({
    clientId: process.env.WORKOS_CLIENT_ID as string,
    code,
  });
  return { email: user.email, firstName: user.firstName, lastName: user.lastName };
}
