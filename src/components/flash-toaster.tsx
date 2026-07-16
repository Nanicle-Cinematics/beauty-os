"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/toast";

// Server actions signal success/failure by redirecting with ?toast=… or
// ?toastError=…. This reads those on arrival, shows a toast, then strips the
// params from the URL so a refresh doesn't re-fire them.
export function FlashToaster() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const ok = params.get("toast");
  const err = params.get("toastError");

  useEffect(() => {
    if (!ok && !err) return;
    if (ok) toast(ok, "success");
    if (err) toast(err, "error");

    const next = new URLSearchParams(params);
    next.delete("toast");
    next.delete("toastError");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [ok, err, params, pathname, router]);

  return null;
}
