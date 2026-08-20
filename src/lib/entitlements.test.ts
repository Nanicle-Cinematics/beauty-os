import { describe, it, expect } from "vitest";
import {
  PLAN_ORDER,
  PLAN_RANK,
  MODULE_MIN_PLAN,
  TOP_PLAN,
  hasModule,
  modulesFor,
  lockedModulesFor,
  nextPlanUp,
  planFeatureList,
  planRequiredFor,
  resolvePlan,
  seatLimit,
  seatsExhausted,
  type ModuleKey,
  type PlanKey,
} from "@/lib/entitlements";

const ALL_MODULES = Object.keys(MODULE_MIN_PLAN) as ModuleKey[];

describe("the ladder itself", () => {
  it("is cumulative — a dearer plan never loses a module the cheaper one had", () => {
    // The bug this encodes: Growth Suite once listed Marketing while the dearer
    // Studio Pro did not, so upgrading appeared to cost you a feature.
    for (let i = 1; i < PLAN_ORDER.length; i += 1) {
      const cheaper = modulesFor(PLAN_ORDER[i - 1]);
      const dearer = modulesFor(PLAN_ORDER[i]);
      for (const moduleKey of cheaper) {
        expect(dearer).toContain(moduleKey);
      }
    }
  });

  it("gives the top plan every module, so nothing is unreachable at any price", () => {
    expect(modulesFor(TOP_PLAN).sort()).toEqual([...ALL_MODULES].sort());
    expect(lockedModulesFor(TOP_PLAN)).toEqual([]);
  });

  it("never locks the dashboard or settings — you can always see and fix your own workspace", () => {
    for (const plan of PLAN_ORDER) {
      expect(hasModule(plan, "dashboard")).toBe(true);
      expect(hasModule(plan, "settings")).toBe(true);
    }
  });

  it("puts the modules that cost us money to run behind Studio Pro", () => {
    for (const moduleKey of ["payments", "invoices", "inventory", "galleries", "finance", "reports", "ai-insights"] as const) {
      expect(planRequiredFor(moduleKey)).toBe("STUDIO");
      expect(hasModule("PROFESSIONAL", moduleKey)).toBe(false);
      expect(hasModule("STUDIO", moduleKey)).toBe(true);
    }
  });

  it("gives Growth Suite the book it advertises", () => {
    for (const moduleKey of ["calendar", "appointments", "waitlist", "clients", "services", "staff", "marketing"] as const) {
      expect(hasModule("PROFESSIONAL", moduleKey)).toBe(true);
    }
  });
});

describe("resolvePlan", () => {
  it("serves a trial the top tier — a trial that hides the features cannot sell them", () => {
    expect(resolvePlan({ planKey: "STARTER", onTrial: true })).toBe(TOP_PLAN);
    expect(resolvePlan({ planKey: null, onTrial: true })).toBe(TOP_PLAN);
  });

  it("serves a workspace with no plan the top tier, so missing billing data never costs access", () => {
    // pierre-jean-paul is live with no subscription row. Defaulting the other
    // way would silently strip seven modules from a real salon.
    expect(resolvePlan({ planKey: null })).toBe(TOP_PLAN);
    expect(resolvePlan({ planKey: undefined })).toBe(TOP_PLAN);
    expect(resolvePlan({ planKey: "NOT_A_PLAN" })).toBe(TOP_PLAN);
  });

  it("honours an explicitly assigned plan once the trial is over", () => {
    expect(resolvePlan({ planKey: "PROFESSIONAL" })).toBe("PROFESSIONAL");
    expect(resolvePlan({ planKey: "STUDIO", onTrial: false })).toBe("STUDIO");
  });
});

describe("nextPlanUp", () => {
  it("points at the cheapest tier that actually unlocks something", () => {
    expect(nextPlanUp("STARTER")).toBe("PROFESSIONAL");
    expect(nextPlanUp("PROFESSIONAL")).toBe("STUDIO");
  });

  it("returns null at the top rather than inventing an upsell", () => {
    expect(nextPlanUp(TOP_PLAN)).toBeNull();
    // STUDIO already covers every module today, so there is nothing to sell
    // above it even though ENTERPRISE outranks it.
    expect(nextPlanUp("STUDIO")).toBeNull();
  });
});

describe("seats", () => {
  it("matches the limits the plans have always published", () => {
    expect(seatLimit("PROFESSIONAL")).toBe(4);
    expect(seatLimit("STUDIO")).toBe(8);
  });

  it("blocks the seat that would exceed the plan, not the one that fills it", () => {
    expect(seatsExhausted("PROFESSIONAL", 3)).toBe(false);
    expect(seatsExhausted("PROFESSIONAL", 4)).toBe(true);
    expect(seatsExhausted("PROFESSIONAL", 9)).toBe(true);
  });

  it("treats the top tier as unlimited", () => {
    expect(seatLimit(TOP_PLAN)).toBeNull();
    expect(seatsExhausted(TOP_PLAN, 5000)).toBe(false);
  });
});

describe("planFeatureList", () => {
  it("describes each tier as a strict addition to the one below", () => {
    const growth = planFeatureList("PROFESSIONAL", "Starter");
    const studio = planFeatureList("STUDIO", "Growth Suite");

    expect(growth).toContain("Marketing & loyalty");
    expect(studio[0]).toBe("Everything in Growth Suite");
    expect(studio).toContain("Payments & invoicing");
    expect(studio).toContain("Client galleries");
  });

  it("never promises a group whose modules the plan cannot open", () => {
    // Every bullet must be backed by real access, at every tier.
    const groupModules: Record<string, ModuleKey[]> = {
      "Bookings & calendar": ["calendar", "appointments"],
      "Client CRM": ["clients"],
      "Staff & services": ["staff", "services"],
      "Waitlists & holds": ["waitlist"],
      "Marketing & loyalty": ["marketing"],
      "Payments & invoicing": ["payments", "invoices"],
      "Inventory & stock control": ["inventory"],
      "Client galleries": ["galleries"],
      "Finance, reports & AI insights": ["finance", "reports", "ai-insights"],
    };

    for (const plan of PLAN_ORDER) {
      for (const bullet of planFeatureList(plan)) {
        for (const moduleKey of groupModules[bullet] ?? []) {
          expect(hasModule(plan, moduleKey)).toBe(true);
        }
      }
    }
  });

  it("lists the full set when there is no cheaper plan to refer back to", () => {
    const studio = planFeatureList("STUDIO", null);
    expect(studio).toContain("Bookings & calendar");
    expect(studio).toContain("Payments & invoicing");
    expect(studio.some((f) => f.startsWith("Everything in"))).toBe(false);
  });
});

describe("plan ranks", () => {
  it("orders every plan key exactly once", () => {
    const ranks = PLAN_ORDER.map((p: PlanKey) => PLAN_RANK[p]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(PLAN_ORDER.length);
  });
});
