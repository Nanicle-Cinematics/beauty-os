import { notFound } from "next/navigation";
import Link from "next/link";
import { Brain, ArrowRight, CheckCircle2, TrendingUp, AlertTriangle, AlertOctagon, Sparkles, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { getAiInsightsData } from "@/lib/ai-insights-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AiInsightsPageProps = { params: Promise<{ businessSlug: string }> };

// Severity-driven styling: the icon chip + left accent bar make each card
// scannable at a glance before reading a word.
const toneStyle: Record<string, { icon: LucideIcon; chip: string; accent: string }> = {
  success: { icon: TrendingUp, chip: "bg-success-soft text-success", accent: "bg-success" },
  warning: { icon: AlertTriangle, chip: "bg-warning-soft text-warning", accent: "bg-warning" },
  danger: { icon: AlertOctagon, chip: "bg-danger-soft text-danger", accent: "bg-danger" },
  plum: { icon: Sparkles, chip: "bg-plum-soft text-plum", accent: "bg-plum" },
};

export default async function AiInsightsPage({ params }: AiInsightsPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getAiInsightsData(businessSlug);
  if (!data) notFound();

  const count = data.insights.length;

  return (
    <div className="grid gap-5">
      <PageHeader title="AI Insights" description="Contextual intelligence from your live operation — what to act on next." />

      <section className="brand-dark relative overflow-hidden rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-lift)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-rose"><Brain size={22} /></span>
            <div>
              <h2 className="font-serif text-2xl font-semibold tracking-tight">Here&apos;s what stands out</h2>
              <p className="mt-1 max-w-xl text-[13.5px] leading-6 text-white/70">{data.summary}</p>
            </div>
          </div>
          {count > 0 ? (
            <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white">
              {count} signal{count === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </section>

      {count === 0 ? (
        <EmptyState icon={CheckCircle2} title="All clear" body="No pressing signals right now — your revenue, stock, and clients look healthy." />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {data.insights.map((insight) => {
            const style = toneStyle[insight.tone as BadgeTone] ?? toneStyle.plum;
            const Icon = style.icon;
            return (
              <article
                key={insight.id}
                className="card relative flex flex-col overflow-hidden p-5 transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${style.accent}`} aria-hidden />
                <div className="flex items-start gap-3">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${style.chip}`}>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{insight.kind}</div>
                    <h3 className="mt-1 text-[15px] font-semibold leading-snug text-ink">{insight.title}</h3>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-[13px] leading-6 text-muted">{insight.body}</p>
                {insight.action ? (
                  <Link
                    href={`/${businessSlug}/${insight.action.path}`}
                    className="group mt-4 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-plum"
                  >
                    {insight.action.label} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
