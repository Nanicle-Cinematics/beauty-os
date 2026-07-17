import { describe, it, expect } from "vitest";
import { roleCan, CAPABILITIES, type BusinessRole } from "@/lib/permissions";

const ALL_ROLES: BusinessRole[] = [
  "OWNER",
  "MANAGER",
  "RECEPTIONIST",
  "SENIOR_ARTIST",
  "ARTIST",
  "CASHIER",
  "INVENTORY_OFFICER",
];

describe("roleCan", () => {
  it("lets front desk correct client details — that is the job", () => {
    expect(roleCan("RECEPTIONIST", "clients:edit")).toBe(true);
    expect(roleCan("OWNER", "clients:edit")).toBe(true);
    expect(roleCan("MANAGER", "clients:edit")).toBe(true);
  });

  it("does not let artists or cashiers edit client records", () => {
    expect(roleCan("ARTIST", "clients:edit")).toBe(false);
    expect(roleCan("CASHIER", "clients:edit")).toBe(false);
    expect(roleCan("INVENTORY_OFFICER", "clients:edit")).toBe(false);
  });

  it("reserves destructive actions for owners and managers", () => {
    for (const capability of ["clients:archive", "clients:delete"] as const) {
      expect(roleCan("OWNER", capability)).toBe(true);
      expect(roleCan("MANAGER", capability)).toBe(true);
      // A receptionist may fix a typo but not remove the record.
      expect(roleCan("RECEPTIONIST", capability)).toBe(false);
    }
  });

  it("denies a caller with no membership in this business", () => {
    expect(roleCan(null, "clients:edit")).toBe(false);
    expect(roleCan(undefined, "clients:delete")).toBe(false);
  });

  it("denies every role not explicitly granted", () => {
    for (const capability of Object.keys(CAPABILITIES) as (keyof typeof CAPABILITIES)[]) {
      const granted = CAPABILITIES[capability] as readonly string[];
      for (const role of ALL_ROLES) {
        expect(roleCan(role, capability)).toBe(granted.includes(role));
      }
    }
  });

  it("keeps business settings to owners and managers", () => {
    expect(roleCan("MANAGER", "business:settings")).toBe(true);
    expect(roleCan("RECEPTIONIST", "business:settings")).toBe(false);
  });

  it("does not let front desk reprice the menu", () => {
    // The deliberate split from clients: a receptionist fixes a client's phone
    // number, but pricing is a commercial decision.
    expect(roleCan("RECEPTIONIST", "clients:edit")).toBe(true);
    expect(roleCan("RECEPTIONIST", "services:edit")).toBe(false);
    expect(roleCan("RECEPTIONIST", "services:retire")).toBe(false);
    expect(roleCan("RECEPTIONIST", "services:delete")).toBe(false);
  });

  it("lets owners and managers run the service menu", () => {
    for (const capability of ["services:edit", "services:retire", "services:delete"] as const) {
      expect(roleCan("OWNER", capability)).toBe(true);
      expect(roleCan("MANAGER", capability)).toBe(true);
      expect(roleCan("ARTIST", capability)).toBe(false);
    }
  });
});
