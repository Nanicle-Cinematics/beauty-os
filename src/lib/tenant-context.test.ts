import { describe, it, expect } from "vitest";
import { getTenantContext, runWithTenantContext, withBypass } from "@/lib/tenant-context";

describe("tenant context (RLS scoping)", () => {
  it("exposes the context inside runWithTenantContext", async () => {
    await runWithTenantContext({ businessId: "biz_1" }, async () => {
      expect(getTenantContext()).toEqual({ businessId: "biz_1" });
    });
  });

  it("has no ambient context outside a run", () => {
    // A fresh async context (this test) never entered a scope.
    expect(getTenantContext()).toBeUndefined();
  });

  it("withBypass lifts to bypass and restores the surrounding tenant scope", async () => {
    await runWithTenantContext({ businessId: "biz_1" }, async () => {
      const inside = await withBypass(async () => getTenantContext());
      expect(inside).toEqual({ bypass: true });
      // back to the tenant scope after the bypass block
      expect(getTenantContext()).toEqual({ businessId: "biz_1" });
    });
  });

  it("keeps concurrent scopes isolated", async () => {
    const a = runWithTenantContext({ businessId: "A" }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getTenantContext()?.businessId;
    });
    const b = runWithTenantContext({ businessId: "B" }, async () => getTenantContext()?.businessId);
    expect(await Promise.all([a, b])).toEqual(["A", "B"]);
  });
});
