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

  it("lets a manager run the rota but not grant roles", () => {
    // A manager who could edit roles would simply make themselves an owner —
    // so role granting is owner-only, unlike the rest of staff management.
    expect(roleCan("MANAGER", "staff:edit")).toBe(true);
    expect(roleCan("MANAGER", "staff:status")).toBe(true);
    expect(roleCan("MANAGER", "staff:role")).toBe(false);
    expect(roleCan("OWNER", "staff:role")).toBe(true);
  });

  it("keeps all staff management away from non-managers", () => {
    for (const capability of ["staff:edit", "staff:status", "staff:role"] as const) {
      expect(roleCan("RECEPTIONIST", capability)).toBe(false);
      expect(roleCan("ARTIST", capability)).toBe(false);
    }
  });

  it("lets the inventory officer run stock but not delete products", () => {
    // The role exists for exactly this: editing product details and adjusting
    // tracked stock. Deleting a record others report on stays with managers.
    expect(roleCan("INVENTORY_OFFICER", "inventory:edit")).toBe(true);
    expect(roleCan("INVENTORY_OFFICER", "inventory:adjust")).toBe(true);
    expect(roleCan("INVENTORY_OFFICER", "inventory:delete")).toBe(false);
  });

  it("does not let front desk or artists touch inventory", () => {
    for (const capability of ["inventory:edit", "inventory:adjust", "inventory:delete"] as const) {
      expect(roleCan("RECEPTIONIST", capability)).toBe(false);
      expect(roleCan("ARTIST", capability)).toBe(false);
    }
  });

  it("lets front desk manage the book but not delete bookings", () => {
    // Rescheduling, reassigning and cancelling are front-desk work; deleting the
    // record outright (only ever with no payments) stays with managers.
    expect(roleCan("RECEPTIONIST", "appointments:edit")).toBe(true);
    expect(roleCan("RECEPTIONIST", "appointments:delete")).toBe(false);
    expect(roleCan("MANAGER", "appointments:delete")).toBe(true);
    expect(roleCan("OWNER", "appointments:delete")).toBe(true);
  });

  it("does not let artists or cashiers edit bookings", () => {
    expect(roleCan("ARTIST", "appointments:edit")).toBe(false);
    expect(roleCan("CASHIER", "appointments:edit")).toBe(false);
  });

  it("keeps marketing to owners and managers", () => {
    // Campaigns cost money to send and coupons affect margin — not front-desk.
    for (const capability of ["marketing:edit", "marketing:delete"] as const) {
      expect(roleCan("OWNER", capability)).toBe(true);
      expect(roleCan("MANAGER", capability)).toBe(true);
      expect(roleCan("RECEPTIONIST", capability)).toBe(false);
      expect(roleCan("ARTIST", capability)).toBe(false);
    }
  });
});
