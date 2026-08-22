import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import { MODULE_MIN_PLAN, type ModuleKey } from "@/lib/entitlements";

const TENANT_ROOT = join(process.cwd(), "src/app/[businessSlug]");

/**
 * Routes that must stay open on every plan, with the reason each one is exempt.
 * Adding to this list is a deliberate decision, which is the point of it.
 */
const UNGATED: Record<string, string> = {
  "page.tsx": "the dashboard is the workspace itself and is never sold separately",
  "layout.tsx": "the shell renders the nav that shows what is locked",
  "upgrade/page.tsx": "every lock points here, so gating it would be a dead end",
  "data-export/route.ts": "data portability survives billing state entirely",
};

function walk(dir: string, prefix = ""): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) return walk(full, rel);
    return entry === "page.tsx" || entry === "route.ts" ? [rel] : [];
  });
}

const routes = walk(TENANT_ROOT);

describe("tenant route gating", () => {
  it("finds the tenant routes at all", () => {
    // Guards the guard: if the walk silently returned nothing, every assertion
    // below would vacuously pass and the whole check would be worthless.
    expect(routes.length).toBeGreaterThan(20);
  });

  it("declares a module on every route that is not explicitly exempt", () => {
    const ungated: string[] = [];

    for (const rel of routes) {
      if (rel in UNGATED) continue;
      const src = readFileSync(join(TENANT_ROOT, rel), "utf8");
      if (!/requireTenantAccess\(\s*businessSlug\s*,\s*\{[^}]*module:/.test(src)) {
        ungated.push(rel);
      }
    }

    // A new module page that forgets `{ module }` is reachable on every plan,
    // including the ones that did not pay for it. That failure is invisible in
    // the UI — the nav lock is drawn from the same ladder and would look right.
    expect(ungated).toEqual([]);
  });

  it("only ever names a module that exists in the ladder", () => {
    const known = new Set(Object.keys(MODULE_MIN_PLAN) as ModuleKey[]);

    for (const rel of routes) {
      const src = readFileSync(join(TENANT_ROOT, rel), "utf8");
      for (const [, name] of src.matchAll(/module:\s*"([^"]+)"/g)) {
        expect(known, `${rel} gates on unknown module "${name}"`).toContain(name);
      }
    }
  });

  it("gates each route on the module its own path lives under", () => {
    // A copy-paste that leaves `module: "clients"` on a payments page would gate
    // the wrong tier and silently hand a module away.
    for (const rel of routes) {
      if (rel in UNGATED) continue;
      const segment = rel.split("/")[0];
      const src = readFileSync(join(TENANT_ROOT, rel), "utf8");
      const match = src.match(/requireTenantAccess\(\s*businessSlug\s*,\s*\{[^}]*module:\s*"([^"]+)"/);
      expect(match?.[1], `${rel} should gate on "${segment}"`).toBe(segment);
    }
  });
});
