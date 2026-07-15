import Link from "next/link";
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
    <main className="grid min-h-screen place-items-center bg-[#fafafa] px-4 py-10 text-[#18181b]">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9d4e7a]">Beauty OS</div>
        </div>
        <div className="grid gap-4 rounded-[28px] border border-[#e7e7ea] bg-white p-6 text-center shadow-[0_18px_45px_rgba(24,24,27,0.08)]">
          <div
            className={`mx-auto grid size-12 place-items-center rounded-full text-lg font-semibold ${
              tone === "ok" ? "bg-[#faf1f6] text-[#9d4e7a]" : "bg-rose-50 text-rose-700"
            }`}
          >
            {tone === "ok" ? "✓" : "!"}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm font-semibold text-[#71717a]">{body}</p>
          <Link href="/app" className="mt-1 rounded-2xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white">
            Go to your workspaces
          </Link>
        </div>
      </div>
    </main>
  );
}
