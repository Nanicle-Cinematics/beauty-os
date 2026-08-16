import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const SOURCE_FILES = [
  "next.config.ts",
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
  "src/instrumentation.ts",
  "src/instrumentation-client.ts",
  "src/app/[businessSlug]/ai-insights/assistant/route.ts",
  "src/app/sso/callback/route.ts",
  "src/app/sso/start/route.ts",
  "src/components/service-worker-register.tsx",
  "src/lib/auth.ts",
  "src/lib/auth-actions.ts",
  "src/lib/email.ts",
  "src/lib/messaging.ts",
  "src/lib/mfa.ts",
  "src/lib/prisma.ts",
  "src/lib/settings-actions.ts",
  "src/lib/sso.ts",
  "src/lib/urls.ts",
];

const PLATFORM_OR_TEST_ENV = new Set([
  "CI",
  "NODE_ENV",
  "NEXT_RUNTIME",
  "NEXT_PUBLIC_VERCEL_ENV",
  "VERCEL_ENV",
  "VERCEL_PROJECT_PRODUCTION_URL",
]);

function envExampleKeys() {
  const text = readFileSync(".env.example", "utf8");
  return new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
      .filter((key): key is string => Boolean(key)),
  );
}

function sourceEnvKeys() {
  const keys = new Set<string>();
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      const key = match[1];
      if (!PLATFORM_OR_TEST_ENV.has(key)) {
        keys.add(key);
      }
    }
  }
  return keys;
}

describe("deployment env surface", () => {
  it("documents every app-owned environment variable in .env.example", () => {
    const documented = envExampleKeys();
    const used = sourceEnvKeys();
    const missing = [...used].filter((key) => !documented.has(key)).sort();

    expect(missing, `Missing .env.example entries for ${missing.join(", ")} from ${relative(process.cwd(), ".")}`).toEqual([]);
  });
});
