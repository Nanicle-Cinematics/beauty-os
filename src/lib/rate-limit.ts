import "server-only";

import { headers } from "next/headers";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";

// Best-effort client IP from the proxy headers Vercel sets. The first entry in
// x-forwarded-for is the originating client.
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    return fwd.split(",")[0]?.trim() || "unknown";
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

// Fixed-window rate limit backed by the RateLimit table (works across
// serverless instances). Counts this hit; returns allowed=false once the
// window's count reaches `limit`. Fails open if the DB isn't configured.
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!isDatabaseConfigured()) {
    return { allowed: true, retryAfterSec: 0 };
  }

  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.windowEnd < now) {
    const windowEnd = new Date(now.getTime() + windowMs);
    await prisma.rateLimit.upsert({
      where: { key },
      update: { count: 1, windowEnd },
      create: { key, count: 1, windowEnd },
    });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((existing.windowEnd.getTime() - now.getTime()) / 1000)) };
  }

  await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return { allowed: true, retryAfterSec: 0 };
}

export function retryMessage(prefix: string, retryAfterSec: number): string {
  const mins = Math.ceil(retryAfterSec / 60);
  return `${prefix} Please try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}
