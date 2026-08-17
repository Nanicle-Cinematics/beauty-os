import { type NextRequest, NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth";
import { getBusinessExport } from "@/lib/compliance-data";

export const dynamic = "force-dynamic";

// Serialize Prisma Decimal + bigint safely (raw Decimals become {} otherwise).
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object" && (value as { constructor?: { name?: string } }).constructor?.name === "Decimal") {
    return value.toString();
  }
  return value;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  // The one tenant route that stays open to a locked workspace. Everything else
  // redirects to /trial-expired, which was also swallowing the owner's route to
  // their own records — the moment they are most likely to want them, and a
  // right that does not lapse with a trial. Membership is still required.
  await requireTenantAccess(businessSlug, { allowTrialLocked: true });

  const data = await getBusinessExport(businessSlug);
  if (!data) return new NextResponse("Not found", { status: 404 });

  const json = JSON.stringify(data, replacer, 2);
  const filename = `${businessSlug}-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
