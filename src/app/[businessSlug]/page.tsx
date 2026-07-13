import { notFound } from "next/navigation";
import { TenantDashboard } from "@/components/tenant-dashboard";
import { getTenantDashboardData } from "@/lib/dashboard-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type TenantPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

export default async function TenantPage({ params }: TenantPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getTenantDashboardData(businessSlug);

  if (!data) {
    notFound();
  }

  return <TenantDashboard data={data} businessSlug={businessSlug} currentSection="dashboard" />;
}
