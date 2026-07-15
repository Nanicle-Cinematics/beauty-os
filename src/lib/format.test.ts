import { describe, it, expect } from "vitest";
import { currencySymbol, money, titleCase, pct, deltaLabel } from "@/lib/format";

describe("currencySymbol", () => {
  it("maps GHS to the cedi glyph and passes others through", () => {
    expect(currencySymbol("GHS")).toBe("GH₵");
    expect(currencySymbol("USD")).toBe("USD");
  });
});

describe("money", () => {
  it("formats with the currency symbol and thousands separators", () => {
    expect(money(1850, "GHS")).toBe("GH₵ 1,850");
    expect(money(0, "GHS")).toBe("GH₵ 0");
    expect(money(1234567, "GHS")).toBe("GH₵ 1,234,567");
  });
  it("rounds to whole units", () => {
    expect(money(1234.6, "GHS")).toBe("GH₵ 1,235");
    expect(money(1234.4, "GHS")).toBe("GH₵ 1,234");
  });
});

describe("titleCase", () => {
  it("title-cases snake_case enum values", () => {
    expect(titleCase("FULL_PAYMENT")).toBe("Full Payment");
    expect(titleCase("no_show")).toBe("No Show");
    expect(titleCase("CASH")).toBe("Cash");
  });
});

describe("pct", () => {
  it("computes a clamped, rounded percentage", () => {
    expect(pct(50, 200)).toBe(25);
    expect(pct(1, 3)).toBe(33);
  });
  it("guards divide-by-zero and clamps to 0..100", () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(300, 100)).toBe(100);
    expect(pct(-5, 100)).toBe(0);
  });
});

describe("deltaLabel", () => {
  it("labels increases and decreases", () => {
    expect(deltaLabel(120, 100)).toBe("+20%");
    expect(deltaLabel(80, 100)).toBe("−20%");
    expect(deltaLabel(100, 100)).toBe("0%");
  });
  it("handles a zero/absent baseline", () => {
    expect(deltaLabel(5, 0)).toBe("New");
    expect(deltaLabel(0, 0)).toBe("—");
  });
});
