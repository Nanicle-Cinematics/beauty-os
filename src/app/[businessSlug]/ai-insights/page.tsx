import { notFound } from "next/navigation";
import Link from "next/link";
import { Brain, ArrowRight, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge, EmptyState } from "@/components/ui";
import { getAiInsightsData } from "@/lib/ai-insights-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AiInsightsPageProps = { params: Promise<{ businessSlug: string }> };

export default async function AiInsightsPage({ params }: AiInsightsPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getAiInsightsData(businessSlug);
  if (!data) notFound();

  return (
    <div className="grid gap-5">
      <PageHeader title="AI Insights" description="Contextual intelligence from your live operation — what to act on next." />

      <section className="brand-dark relative overflow-hidden rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-lift)]">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-rose"><Brain size={22} /></span>
          <div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight">Here&apos;s what stands out</h2>
            <p className="mt-1 max-w-xl text-[13.5px] leading-6 text-white/70">{data.summary}</p>
          </div>
        </div>
      </section>

      {data.insights.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="All clear" body="No pressing signals right now — your revenue, stock, and clients look healthy." />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {data.insights.map((insight) => (
            <article key={insight.id} className="card flex flex-col p-5">
              <Badge tone={insight.tone}>{insight.kind}</Badge>
              <h3 className="mt-3 text-[15px] font-semibold text-ink">{insight.title}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-6 text-muted">{insight.body}</p>
              {insight.action ? (
                <Link href={`/${businessSlug}/${insight.action.path}`} className="mt-4 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-plum hover:gap-1.5">
                  {insight.action.label} <ArrowRight size={14} />
                </Link>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
