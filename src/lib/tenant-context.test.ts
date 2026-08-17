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

/**
 * Prisma's client returns a *lazy* promise: the query is not dispatched until
 * something calls .then/.catch/.finally on it. That interacts badly with
 * AsyncLocalStorage and has now caused two real bugs — a cron that silently saw
 * zero tenants, and a membership count that could never exceed one.
 *
 * `lazyContextReader` stands in for a PrismaPromise: it reads the tenant context
 * at dispatch time, not at construction time, which is exactly what the Prisma
 * extension does when it decides which GUCs to set.
 */
function lazyContextReader() {
  const run = () => Promise.resolve(getTenantContext());
  return {
    then: (res?: never, rej?: never) => run().then(res, rej),
    catch: (rej?: never) => run().catch(rej),
  } as unknown as PromiseLike<ReturnType<typeof getTenantContext>>;
}

describe("withBypass and lazily-dispatched queries", () => {
  it("LOSES the bypass when the callback only returns a lazy promise", async () => {
    await runWithTenantContext({ businessId: "biz_1" }, async () => {
      // The trap: storage.run returns before anything is dispatched, so the
      // query runs under the caller's scope — here, a tenant scope. Against a
      // real database that means RLS filtering, and zero rows with no error.
      const seen = await withBypass(() => lazyContextReader() as Promise<unknown>);
      expect(seen).toEqual({ businessId: "biz_1" });
      expect(seen).not.toEqual({ bypass: true });
    });
  });

  it("KEEPS the bypass when the callback awaits inside", async () => {
    await runWithTenantContext({ businessId: "biz_1" }, async () => {
      const seen = await withBypass(async () => {
        return await lazyContextReader();
      });
      expect(seen).toEqual({ bypass: true });
    });
  });

  it("loses it entirely with no surrounding scope — the cron case", async () => {
    const seen = await withBypass(() => lazyContextReader() as Promise<unknown>);
    // No context at all: the RLS extension sets no GUC and deny-by-default wins.
    expect(seen).toBeUndefined();

    const correct = await withBypass(async () => {
      return await lazyContextReader();
    });
    expect(correct).toEqual({ bypass: true });
  });
});
