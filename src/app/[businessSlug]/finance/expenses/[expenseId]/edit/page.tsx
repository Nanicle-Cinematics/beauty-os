import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getExpense } from "@/lib/finance-data";
import { updateExpenseAction } from "@/lib/finance-actions";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

const expenseCategories = ["Supplies", "Rent", "Salaries", "Utilities", "Marketing", "Equipment", "Transport", "Maintenance"];

type EditExpensePageProps = {
  params: Promise<{ businessSlug: string; expenseId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditExpensePage({ params, searchParams }: EditExpensePageProps) {
  const { businessSlug, expenseId } = await params;
  const { error } = await searchParams;
  await requireTenantAccess(businessSlug);
  const expense = await getExpense(businessSlug, expenseId);
  if (!expense) notFound();

  return (
    <div className="mx-auto grid w-full max-w-xl gap-5">
      <PageHeader title="Edit expense" description="Update the details of this expense.">
        <Link href={`/${businessSlug}/finance/expenses`} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-sunken">
          <ArrowLeft size={15} /> Back
        </Link>
      </PageHeader>

      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div>
      ) : null}

      <form action={updateExpenseAction} className="card grid gap-4 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="expenseId" value={expense.id} />

        <label className="field-label">
          Category
          <input name="category" list="expense-categories" defaultValue={expense.category} className="input" required />
          <datalist id="expense-categories">
            {expenseCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
          <label className="field-label">
            Amount
            <input name="amount" type="number" min="0" step="0.01" defaultValue={expense.amount} className="input" required />
          </label>
          <label className="field-label">
            Date
            <input name="incurredAt" type="date" defaultValue={expense.incurredAt} className="input" />
          </label>
        </div>

        <label className="field-label">
          Description (optional)
          <input name="description" defaultValue={expense.description} placeholder="What was it for?" className="input" />
        </label>

        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-xl primary-action px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">
            <Save size={15} /> Save changes
          </button>
          <Link href={`/${businessSlug}/finance/expenses`} className="inline-flex items-center rounded-xl border border-line px-5 py-3 text-sm font-medium text-muted hover:bg-sunken">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
