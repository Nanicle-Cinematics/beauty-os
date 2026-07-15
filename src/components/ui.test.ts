import { describe, it, expect } from "vitest";
import { toneForStatus, statMetaFor } from "@/components/ui";

describe("toneForStatus", () => {
  it("maps positive states to success", () => {
    expect(toneForStatus("Completed")).toBe("success");
    expect(toneForStatus("Active")).toBe("success");
    expect(toneForStatus("Confirmed")).toBe("success");
    expect(toneForStatus("Paid")).toBe("success");
  });
  it("maps failure/terminal states to danger", () => {
    expect(toneForStatus("Cancelled")).toBe("danger");
    expect(toneForStatus("No show")).toBe("danger");
    expect(toneForStatus("Refunded")).toBe("danger");
    expect(toneForStatus("Out of stock")).toBe("danger");
  });
  it("maps in-progress/attention states to warning", () => {
    expect(toneForStatus("Pending")).toBe("warning");
    expect(toneForStatus("Trial")).toBe("warning");
    expect(toneForStatus("Low")).toBe("warning");
    expect(toneForStatus("Draft")).toBe("warning");
  });
  it("falls back to info then plum", () => {
    expect(toneForStatus("In service")).toBe("info");
    expect(toneForStatus("Something else")).toBe("plum");
  });
});

describe("statMetaFor", () => {
  it("returns a tone + icon for known KPI labels", () => {
    expect(statMetaFor("Revenue (30d)").tone).toBe("success");
    expect(statMetaFor("Low stock").tone).toBe("warning");
    expect(statMetaFor("Outstanding").tone).toBe("warning");
    expect(statMetaFor("Refunds").tone).toBe("danger");
    expect(statMetaFor("Clients").tone).toBe("plum");
    expect(statMetaFor("Whatever").tone).toBe("plum");
  });
  it("always provides an icon component", () => {
    for (const label of ["Revenue", "Clients", "Low stock", "Bookings", "Mystery metric"]) {
      expect(statMetaFor(label).icon).toBeTruthy();
    }
  });
});
