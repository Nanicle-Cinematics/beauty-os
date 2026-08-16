import { describe, expect, it } from "vitest";
import { retryMessage } from "@/lib/rate-limit";

describe("retryMessage", () => {
  it("reports short waits in minutes", () => {
    expect(retryMessage("Too many requests.", 90)).toBe("Too many requests. Please try again in 2 minutes.");
  });

  it("singularises a one-minute wait", () => {
    expect(retryMessage("Slow down.", 45)).toBe("Slow down. Please try again in 1 minute.");
  });

  // The AI assistant's per-business cap uses a 24-hour window, which in minutes
  // would read "try again in 1200 minutes".
  it("switches to hours once the wait is long", () => {
    expect(retryMessage("Daily limit reached.", 20 * 60 * 60)).toBe("Daily limit reached. Please try again in 20 hours.");
  });

  // The switch is at 120 minutes, so the hourly-window limiters (signup,
  // verification resend) still phrase their waits in minutes.
  it("still uses minutes just below the threshold", () => {
    expect(retryMessage("Hold on.", 119 * 60)).toBe("Hold on. Please try again in 119 minutes.");
  });

  it("rounds the wait up rather than down, so nobody is told to retry too early", () => {
    expect(retryMessage("Daily limit reached.", (3 * 60 + 5) * 60)).toBe("Daily limit reached. Please try again in 4 hours.");
  });
});
