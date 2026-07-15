import "server-only";

export function currencySymbol(currency: string) {
  return currency === "GHS" ? "GH₵" : currency;
}

export function money(amount: number, currency: string) {
  return `${currencySymbol(currency)} ${Math.round(amount).toLocaleString("en-US")}`;
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** Signed percentage change, e.g. "+12%" / "−8%" / "—" when no prior base. */
export function deltaLabel(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "New" : "—";
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return "0%";
  return `${change > 0 ? "+" : "−"}${Math.abs(change)}%`;
}
