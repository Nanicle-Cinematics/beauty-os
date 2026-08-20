import { type NextRequest, NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth";
import { getExpensesForExport } from "@/lib/finance-data";

// RFC 4180 cell: quote when it contains a comma, quote, or newline.
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug, { module: "finance" });

  const sp = request.nextUrl.searchParams;
  const data = await getExpensesForExport(businessSlug, {
    category: sp.get("category") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    q: sp.get("q") ?? undefined,
  });
  if (!data) return new NextResponse("Not found", { status: 404 });

  const header = ["Date", "Category", "Description", `Amount (${data.currency})`];
  const lines = [header.map(csvCell).join(",")];
  for (const r of data.rows) {
    lines.push([r.date, r.category, r.description, r.amount.toFixed(2)].map(csvCell).join(","));
  }
  // UTF-8 BOM so Excel renders ₵ and accented text correctly.
  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";

  const filename = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
