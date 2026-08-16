import { describe, it, expect } from "vitest";
import { composeFrom, reactivationCopy, safeReplyTo } from "@/lib/email";

describe("composeFrom — per-tenant sender name over a shared address", () => {
  it("puts the salon name in front of a 'Name <addr>' base", () => {
    expect(composeFrom("Beauty OS <hello@shared.com>", "Osu Glow Studio")).toBe('"Osu Glow Studio" <hello@shared.com>');
  });

  it("puts the salon name in front of a bare address", () => {
    expect(composeFrom("hello@shared.com", "Osu Glow Studio")).toBe('"Osu Glow Studio" <hello@shared.com>');
  });

  it("leaves the base untouched when no salon name is given", () => {
    expect(composeFrom("Beauty OS <hello@shared.com>", null)).toBe("Beauty OS <hello@shared.com>");
    expect(composeFrom("Beauty OS <hello@shared.com>", "   ")).toBe("Beauty OS <hello@shared.com>");
  });

  it("strips CRLF and quotes so a business name can't inject headers", () => {
    // A salon owner controls their name; it must never break out of the header.
    const evil = 'Evil"\r\nBcc: victim@example.com';
    const out = composeFrom("hello@shared.com", evil);
    expect(out).not.toContain("\r");
    expect(out).not.toContain("\n");
    expect(out).toBe('"Evil Bcc: victim@example.com" <hello@shared.com>');
  });
});

describe("reactivationCopy", () => {
  it("says 'unlocked' when the workspace had actually lapsed", () => {
    const copy = reactivationCopy("Osu Glow Studio", true);
    expect(copy.subject).toBe("Osu Glow Studio is unlocked on Beauty OS");
    expect(copy.heading).toBe("Your workspace is unlocked");
    expect(copy.lead).toContain("Nothing was deleted");
  });

  // Activating a business still inside its trial is an upgrade, not a rescue —
  // telling that owner their workspace was "unlocked" would be a lie.
  it("says 'now active' when the workspace was never locked", () => {
    const copy = reactivationCopy("Luxe Lash Lab", false);
    expect(copy.subject).toBe("Luxe Lash Lab is now on a full Beauty OS plan");
    expect(copy.heading).toBe("Your workspace is now active");
    expect(copy.lead).toContain("no trial countdown");
    expect(copy.lead).not.toContain("locked");
  });

  it("strips CRLF from the business name before it reaches the subject header", () => {
    const copy = reactivationCopy("Evil\r\nBcc: victim@example.com", true);
    expect(copy.subject).not.toContain("\r");
    expect(copy.subject).not.toContain("\n");
  });
});

describe("safeReplyTo", () => {
  it("passes a plausible address through", () => {
    expect(safeReplyTo("salon@example.com")).toBe("salon@example.com");
  });
  it("drops anything that isn't an address", () => {
    expect(safeReplyTo("")).toBeUndefined();
    expect(safeReplyTo(null)).toBeUndefined();
    expect(safeReplyTo("not-an-email")).toBeUndefined();
  });
});
