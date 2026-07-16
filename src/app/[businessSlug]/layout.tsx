import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NameNudgeBanner } from "@/components/name-nudge-banner";
import { requireTenantAccess } from "@/lib/auth";
import { getTenantChrome } from "@/lib/tenant-data";

export const dynamic = "force-dynamic";

type TenantLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ businessSlug: string }>;
};

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { businessSlug } = await params;
  const user = await requireTenantAccess(businessSlug);
  const chrome = await getTenantChrome(user, businessSlug);

  if (!chrome) {
    notFound();
  }

  return (
    <AppShell chrome={chrome}>
      {chrome.namePlaceholder ? <NameNudgeBanner slug={chrome.slug} currentName={chrome.name} /> : null}
      {children}
    </AppShell>
  );
}
