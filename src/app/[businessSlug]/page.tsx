import { notFound } from "next/navigation";
import { TenantDashboard } from "@/components/tenant-dashboard";
import { getTenantWorkspace } from "@/lib/tenant-data";
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
  const tenant = await getTenantWorkspace(businessSlug);

  if (!tenant) {
    notFound();
  }

  return (
    <TenantDashboard
      businessName={tenant.name}
      businessSlug={tenant.slug}
      planName={tenant.planName}
      staffSeats={tenant.staffSeats}
      branchCount={tenant.branchCount}
      automationStatus={tenant.automationStatus}
    />
  );
}
