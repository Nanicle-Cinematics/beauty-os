import { notFound } from "next/navigation";
import { TenantDashboard } from "@/components/tenant-dashboard";
import { getTenantDashboardData } from "@/lib/dashboard-data";
import { getWorkspaceSummaries } from "@/lib/tenant-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type TenantPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

export default async function TenantPage({ params }: TenantPageProps) {
  const { businessSlug } = await params;
  const user = await requireTenantAccess(businessSlug);
  const [data, workspaces] = await Promise.all([
    getTenantDashboardData(businessSlug),
    getWorkspaceSummaries(user),
  ]);

  if (!data) {
    notFound();
  }

  const account = { email: user.email, canSwitch: user.isPlatformAdmin || workspaces.length > 1 };

  return <TenantDashboard data={data} businessSlug={businessSlug} account={account} currentSection="dashboard" />;
}
