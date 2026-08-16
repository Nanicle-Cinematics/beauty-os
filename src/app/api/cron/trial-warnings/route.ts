import { NextResponse } from "next/server";
import { sendExpiringTrialWarnings } from "@/lib/trial-warning-data";

export const dynamic = "force-dynamic";
// Cron work must not be cut short mid-send; a partial run would leave some
// owners warned and others not, with no record of where it stopped.
export const maxDuration = 60;

/**
 * Daily trial-expiry warnings, invoked by the Vercel cron in vercel.json.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when that variable is set.
 * This endpoint emails real customers, so it FAILS CLOSED: with no CRON_SECRET
 * configured it refuses to run rather than sitting on the public internet as an
 * anonymous "email every expiring tenant" button.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("trial-warnings cron refused: CRON_SECRET is not set");
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const summary = await sendExpiringTrialWarnings();
  console.log("trial-warnings cron", JSON.stringify(summary));

  return NextResponse.json({ ok: true, ...summary });
}
