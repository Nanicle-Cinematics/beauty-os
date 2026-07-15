import { type NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";

// A GET link to /logout gets prefetched by Next.js `<Link>` and by browser
// speculative prefetch — which would silently run signOut() and log the user
// out at random. Never mutate on a prefetch: only a real, user-initiated
// navigation (no prefetch headers) actually signs out.
function isPrefetch(request: NextRequest) {
  return (
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    (request.headers.get("sec-purpose") ?? "").includes("prefetch")
  );
}

export async function GET(request: NextRequest) {
  if (isPrefetch(request)) {
    // No-op for prefetches — keep the session intact.
    return new NextResponse(null, { status: 204 });
  }

  await signOut();
  redirect("/login");
}
