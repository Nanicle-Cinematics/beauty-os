import {
  Wallet,
  Coins,
  Users,
  Repeat,
  Sparkles,
  CalendarCheck,
  Tag,
  UserCog,
  Mail,
  Gauge,
  Package,
  TriangleAlert,
  PackageX,
  RotateCcw,
  Clock,
  LayoutGrid,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

/* ---- Badge -------------------------------------------------------------- */

export type BadgeTone = "plum" | "success" | "warning" | "danger" | "neutral" | "info";

const badgeTone: Record<BadgeTone, string> = {
  plum: "bg-plum-soft text-plum",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-line-2 text-muted",
  info: "bg-[#eef1f6] text-[#4a5b7a]",
};

// Maps a raw status string to a semantic tone. Shared across modules so a
// "Completed"/"Active"/"Success" always reads green, cancellations red, etc.
export function toneForStatus(status: string): BadgeTone {
  const s = status.toLowerCase();
  // Holds are provisional — never green (not won) and never red (not lost).
  // Word-boundaried so "household"/"stakeholder" can't trip it, and checked
  // first so no later regex can claim a hold via a substring.
  if (/(\bhold|\bpencil)/.test(s)) return "info";
  if (/(complete|active|success|paid|ok|confirmed)/.test(s)) return "success";
  if (/(cancel|no.?show|fail|refund|removed|expired|\bout\b|suspend|past.?due|revoked)/.test(s)) return "danger";
  if (/(pending|trial|invited|low|expiring|await|draft)/.test(s)) return "warning";
  if (/(service|checked|closed)/.test(s)) return "info";
  return "plum";
}

export function Badge({
  children,
  tone = "plum",
  className = "",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeTone[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* ---- StatTile ----------------------------------------------------------- */

const tileTone: Record<BadgeTone, string> = {
  plum: "bg-plum-soft text-plum",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-line-2 text-muted",
  info: "bg-[#eef1f6] text-[#4a5b7a]",
};

export function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = "plum",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: LucideIcon;
  tone?: BadgeTone;
}) {
  return (
    <article className="card p-5 transition hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        {Icon ? (
          <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${tileTone[tone]}`}>
            <Icon size={16} />
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-[26px] font-semibold tracking-tight text-ink">{value}</div>
      {detail ? <div className="mt-1 text-[12.5px] font-medium text-muted">{detail}</div> : null}
    </article>
  );
}

// Keyword → icon + tone for KPI tiles, so any stat reads with the right glyph.
export function statMetaFor(label: string): { icon: LucideIcon; tone: BadgeTone } {
  const s = label.toLowerCase();
  if (/(refund)/.test(s)) return { icon: RotateCcw, tone: "danger" };
  if (/(out of stock|\bout\b)/.test(s)) return { icon: PackageX, tone: "danger" };
  if (/(low|alert|reorder|expir)/.test(s)) return { icon: TriangleAlert, tone: "warning" };
  if (/(outstanding|owed|balance|due|deposit)/.test(s)) return { icon: Coins, tone: "warning" };
  if (/(invit|pending)/.test(s)) return { icon: Mail, tone: "warning" };
  if (/(revenue|today|money|sales|paid|takings|collected)/.test(s)) return { icon: Wallet, tone: "success" };
  if (/(repeat|retention|return|loyal)/.test(s)) return { icon: Repeat, tone: "success" };
  if (/(util|capacity|occupanc)/.test(s)) return { icon: Gauge, tone: "success" };
  if (/(book|appointment|schedul)/.test(s)) return { icon: CalendarCheck, tone: "plum" };
  if (/(client|customer|guest)/.test(s)) return { icon: Users, tone: "plum" };
  if (/(staff|team|member|artist)/.test(s)) return { icon: UserCog, tone: "plum" };
  if (/(product|item|sku|stock)/.test(s)) return { icon: Package, tone: "plum" };
  if (/(categor)/.test(s)) return { icon: LayoutGrid, tone: "info" };
  if (/(price|value|avg|average)/.test(s)) return { icon: Tag, tone: "plum" };
  if (/(duration|time|mins?)/.test(s)) return { icon: Clock, tone: "info" };
  if (/(service|menu|vip|new)/.test(s)) return { icon: Sparkles, tone: "plum" };
  return { icon: BarChart3, tone: "plum" };
}

/* ---- EmptyState --------------------------------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-plum-softer px-4 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-plum-soft text-plum">
        <Icon size={20} />
      </span>
      <div className="mt-3 text-[13.5px] font-semibold text-ink">{title}</div>
      {body ? <p className="mt-1 max-w-xs text-[12.5px] text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ---- Avatar ------------------------------------------------------------- */

export function Avatar({
  name,
  colorHex,
  size = 36,
}: {
  name: string;
  colorHex?: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: colorHex ?? "var(--plum-soft)",
        color: colorHex ? "#fff" : "var(--plum)",
      }}
    >
      {initials || "—"}
    </span>
  );
}
