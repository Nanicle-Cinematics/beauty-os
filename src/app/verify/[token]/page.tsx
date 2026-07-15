import Link from "next/link";
import { Check, TriangleAlert } from "lucide-react";
import { verifyEmail } from "@/lib/verification-data";

export const dynamic = "force-dynamic";

type VerifyPageProps = {
  params: Promise<{ token: string }>;
};

const copy = {
  verified: { title: "Email verified", body: "Thanks — your email is confirmed and your account is secure.", tone: "ok" as const },
  already: { title: "Already verified", body: "This email was already confirmed. You're all set.", tone: "ok" as const },
  invalid: { title: "Link invalid or expired", body: "This verification link is no longer valid. Sign in and resend a fresh one from your workspaces.", tone: "bad" as const },
};

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { token } = await params;
  const result = await verifyEmail(token);
  const { title, body, tone } = copy[result];

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-plum">Beauty OS</div>
        </div>
        <div className="grid gap-4 rounded-[24px] border border-line bg-card p-6 text-center shadow-[var(--shadow-soft)]">
          <div
            className={`mx-auto grid size-12 place-items-center rounded-full ${
              tone === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            }`}
          >
            {tone === "ok" ? <Check size={22} strokeWidth={2.5} /> : <TriangleAlert size={22} />}
          </div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted">{body}</p>
          <Link href="/app" className="mt-1 rounded-xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">
            Go to your workspaces
          </Link>
        </div>
      </div>
    </main>
  );
}
