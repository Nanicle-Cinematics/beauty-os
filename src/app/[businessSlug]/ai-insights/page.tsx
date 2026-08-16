import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Brain,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  CircleDollarSign,
  ListChecks,
  MessageSquareText,
  Target,
  Compass,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";
import { AiDecisionAssistant } from "@/components/ai-decision-assistant";
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

const priorityStyle: Record<string, string> = {
  critical: "bg-danger text-white",
  high: "bg-warning text-white",
  medium: "bg-plum-soft text-plum",
  low: "bg-success-soft text-success",
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
        <div className="absolute right-8 top-8 hidden size-32 rounded-[42px] border border-white/10 bg-white/10 backdrop-blur-xl md:block" aria-hidden />
        <div className="absolute bottom-8 right-24 hidden size-20 rounded-[30px] border border-white/10 bg-aqua/15 backdrop-blur-xl md:block" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="icon-chip grid size-12 shrink-0 place-items-center rounded-[22px] bg-white/12 text-rose"><Brain size={22} /></span>
            <div>
              <h2 className="font-serif text-2xl font-semibold tracking-tight">Decision assistant</h2>
              <p className="mt-1 max-w-xl text-[13.5px] leading-6 text-white/70">{data.summary}</p>
              <div className="mt-4 rounded-[22px] border border-white/12 bg-white/10 p-3 backdrop-blur-xl">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/45">Start here</div>
                <div className="mt-1 text-[14px] font-semibold leading-5 text-white">{data.focus}</div>
              </div>
            </div>
          </div>
          <div className="grid min-w-[280px] grid-cols-3 gap-2">
            <div className="rounded-[22px] border border-white/12 bg-white/10 p-3 text-center backdrop-blur-xl">
              <div className="text-[24px] font-semibold">{data.assistantScore}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Signal score</div>
            </div>
            <div className="rounded-[22px] border border-white/12 bg-white/10 p-3 text-center backdrop-blur-xl">
              <div className="text-[24px] font-semibold">{count}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Signals</div>
            </div>
            <div className="rounded-[22px] border border-white/12 bg-white/10 p-3 text-center backdrop-blur-xl">
              <div className="truncate text-[19px] font-semibold">{data.moneyAtRisk}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">At risk</div>
            </div>
          </div>
        </div>
      </section>

      <AiDecisionAssistant businessSlug={businessSlug} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        {data.guide.show ? (
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <Compass size={17} className="text-plum" /> {data.guide.title}
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">{data.guide.summary}</p>
            <div className="mt-4 grid gap-2.5">
              {data.guide.steps.map((step, index) => (
                <div key={step.title} className="grid gap-3 rounded-[22px] border border-white/55 bg-white/40 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex min-w-0 gap-3">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${step.done ? "bg-success-soft text-success" : "bg-plum-soft text-plum"}`}>
                      {step.done ? <CheckCircle2 size={14} /> : index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-ink">{step.title}</div>
                      <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{step.body}</p>
                    </div>
                  </div>
                  <Link href={`/${businessSlug}/${step.path}`} className="rounded-2xl border border-line px-3 py-2 text-center text-[12px] font-semibold text-ink hover:bg-sunken">
                    {step.action}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <CalendarRange size={17} className="text-plum" /> Weekly forecast
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-muted">{data.weeklyForecast.summary}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-[20px] border border-white/55 bg-white/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Bookings</div>
              <div className="mt-1 text-xl font-semibold">{data.weeklyForecast.bookingCount}</div>
            </div>
            <div className="rounded-[20px] border border-white/55 bg-white/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Booked</div>
              <div className="mt-1 truncate text-xl font-semibold">{data.weeklyForecast.booked}</div>
            </div>
            <div className="rounded-[20px] border border-white/55 bg-white/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Deposits due</div>
              <div className="mt-1 truncate text-xl font-semibold">{data.weeklyForecast.expectedDeposits}</div>
            </div>
          </div>
          <div className="mt-3 rounded-[20px] border border-white/55 bg-white/40 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Busiest day</div>
            <div className="mt-1 text-[13.5px] font-semibold text-ink">{data.weeklyForecast.busiestDay}</div>
          </div>
          <div className="mt-3 grid gap-2">
            {data.weeklyForecast.risks.map((risk) => (
              <div key={risk} className="rounded-[18px] bg-warning-soft px-3 py-2 text-[12.5px] font-medium text-warning">
                {risk}
              </div>
            ))}
          </div>
        </div>
      </section>

      {count === 0 ? (
        <EmptyState icon={CheckCircle2} title="All clear" body="No pressing signals right now — your revenue, stock, and clients look healthy." />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <ListChecks size={17} className="text-plum" /> Today&apos;s quick wins
              </h2>
              <div className="mt-4 grid gap-2">
                {data.quickWins.map((win, index) => (
                  <div key={`${win}-${index}`} className="flex items-start gap-3 rounded-[20px] border border-white/55 bg-white/40 px-4 py-3 text-[13px] font-medium text-ink">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-plum-soft text-[11px] font-bold text-plum">{index + 1}</span>
                    {win}
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <Target size={17} className="text-plum" /> How to use this
              </h2>
              <p className="mt-3 text-[13px] leading-6 text-muted">
                Work from top to bottom. Critical and high-priority items are ranked by cash risk, calendar blockage, or client retention value.
              </p>
            </div>
          </section>

          <section className="grid gap-4">
            {data.insights.map((insight) => {
              const style = toneStyle[insight.tone as BadgeTone] ?? toneStyle.plum;
              const Icon = style.icon;
              return (
                <article
                  key={insight.id}
                  className="card relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${style.accent}`} aria-hidden />
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.74fr)]">
                    <div>
                      <div className="flex items-start gap-3">
                        <span className={`icon-chip grid size-11 shrink-0 place-items-center rounded-[20px] ${style.chip}`}>
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{insight.kind}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${priorityStyle[insight.priority] ?? priorityStyle.medium}`}>
                              {insight.priority}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/50 px-2 py-0.5 text-[10.5px] font-bold text-ink">
                              <CircleDollarSign size={11} /> {insight.impact}
                            </span>
                          </div>
                          <h3 className="mt-1 text-[17px] font-semibold leading-snug text-ink">{insight.title}</h3>
                        </div>
                      </div>
                      <p className="mt-3 text-[13.5px] leading-6 text-muted">{insight.body}</p>
                      <div className="mt-4 rounded-[20px] border border-white/55 bg-white/38 p-3">
                        <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Why it matters</div>
                        <p className="mt-1 text-[13px] leading-6 text-ink">{insight.why}</p>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-[22px] border border-white/55 bg-white/38 p-4">
                        <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Next best actions</div>
                        <ol className="mt-3 grid gap-2">
                          {insight.steps.map((step, index) => (
                            <li key={step} className="flex gap-2 text-[13px] leading-5 text-ink">
                              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-plum-soft text-[10px] font-bold text-plum">{index + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      {insight.draft ? (
                        <div className="rounded-[22px] border border-white/55 bg-white/38 p-4">
                          <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">
                            <MessageSquareText size={13} /> Draft copy
                          </div>
                          <p className="mt-2 text-[13px] leading-6 text-ink">{insight.draft}</p>
                        </div>
                      ) : null}
                      {insight.action ? (
                        <Link
                          href={`/${businessSlug}/${insight.action.path}`}
                          className="primary-action group inline-flex w-fit items-center gap-1 rounded-2xl px-4 py-2.5 text-[13px] font-semibold text-white"
                        >
                          {insight.action.label} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
