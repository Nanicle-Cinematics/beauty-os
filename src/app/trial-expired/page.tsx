import Link from "next/link";
import { LockKeyhole } from "lucide-react";

type TrialExpiredPageProps = {
  searchParams: Promise<{ workspace?: string }>;
};

export default async function TrialExpiredPage({ searchParams }: TrialExpiredPageProps) {
  const { workspace } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink">
      <section className="glass-panel w-full max-w-md rounded-[28px] p-7 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger">
          <LockKeyhole size={21} />
        </div>
        <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight">Your 7-day trial has ended</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This workspace is locked because the free trial period has expired. Upgrade the workspace to continue using Beauty OS.
        </p>
        <div className="mt-6 grid gap-2">
          <Link href="/settings" className="primary-action rounded-2xl px-5 py-3 text-sm font-semibold text-white">
            Upgrade workspace
          </Link>
          <Link
            href="/logout"
            prefetch={false}
            className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken"
          >
            Sign out
          </Link>
        </div>
        {workspace ? (
          <p className="mt-4 text-xs font-medium text-faint">Locked workspace: {workspace}</p>
        ) : null}
      </section>
    </main>
  );
}
