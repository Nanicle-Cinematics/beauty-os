import Link from "next/link";
import { LockKeyhole } from "lucide-react";

// Customer-facing support inbox. Deliberately a platform-admin address, not the
// naniclecinematics@gmail.com sender used for outbound mail and security.txt —
// a locked-out owner writing in is a customer about to churn, and the reply has
// to come from someone who can actually unlock them.
const SUPPORT_EMAIL = "degraftnanaaboagye@gmail.com";

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
          This workspace is locked because the free trial period has expired. Your data is safe and nothing has been
          deleted — get in touch and we will reactivate the workspace for you.
        </p>
        <div className="mt-6 grid gap-2">
          {/* Self-serve checkout is not wired yet, so this has to reach a human.
              It previously pointed at /settings, which has no billing on it.
              Addressed to a platform admin, since reactivating a workspace is
              something only that account can actually do. */}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              workspace ? `Reactivate my Beauty OS workspace (${workspace})` : "Reactivate my Beauty OS workspace",
            )}`}
            className="primary-action rounded-2xl px-5 py-3 text-sm font-semibold text-white"
          >
            Contact us to reactivate
          </a>
          {/* The export route is the one tenant surface a locked workspace can
              still reach, but its usual link lives in the app shell — which a
              locked owner never gets to see. Without this the fix would only
              work for someone who guessed the URL. */}
          {workspace ? (
            <a
              href={`/${encodeURIComponent(workspace)}/data-export`}
              className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken"
            >
              Export your data
            </a>
          ) : null}
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
