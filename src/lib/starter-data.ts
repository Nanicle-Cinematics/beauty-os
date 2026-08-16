import "server-only";

import { prisma } from "@/lib/prisma";

type TenantTx = Pick<typeof prisma, "businessHours" | "serviceCategory">;

const beautyServices = [
  { name: "Soft glam", description: "Camera-ready makeup for events and portraits.", price: "650.00", durationMinutes: 90, colorHex: "#db2777" },
  { name: "Bridal trial", description: "Trial look with consultation and product notes.", price: "580.00", durationMinutes: 120, colorHex: "#c084fc" },
  { name: "Silk press + trim", description: "Wash, press, style, and tidy trim.", price: "420.00", durationMinutes: 105, colorHex: "#8b5cf6" },
];

const photographyServices = [
  { name: "Mini session", description: "Fast studio or outdoor session with a small edited gallery.", price: "450.00", durationMinutes: 45, colorHex: "#2563eb" },
  { name: "Portrait shoot", description: "Personal, brand, or graduation portraits with guided posing.", price: "900.00", durationMinutes: 90, colorHex: "#0f766e" },
  { name: "Event coverage", description: "Hourly coverage for birthdays, launches, and private events.", price: "1500.00", durationMinutes: 180, colorHex: "#ea580c" },
  { name: "Wedding package", description: "Ceremony and reception coverage with edited highlights.", price: "4500.00", durationMinutes: 480, colorHex: "#7c3aed" },
];

function starterServicesFor(categoryKey: string) {
  return categoryKey === "photographer" ? photographyServices : beautyServices;
}

function starterCategoryName(categoryKey: string) {
  return categoryKey === "photographer" ? "Photography packages" : "Signature services";
}

export async function seedStarterWorkspaceData(tx: TenantTx, {
  businessId,
  categoryKey,
  ownerStaffId,
}: {
  businessId: string;
  categoryKey: string;
  ownerStaffId?: string | null;
}) {
  for (const dayOfWeek of [1, 2, 3, 4, 5, 6]) {
    await tx.businessHours.create({
      data: {
        businessId,
        dayOfWeek,
        openTime: categoryKey === "photographer" ? "08:00" : "09:00",
        closeTime: dayOfWeek === 6 ? "16:00" : categoryKey === "photographer" ? "18:00" : "19:00",
      },
    });
  }

  await tx.serviceCategory.create({
    data: {
      businessId,
      name: starterCategoryName(categoryKey),
      sortOrder: 1,
      services: {
        create: starterServicesFor(categoryKey).map((service) => ({
          businessId,
          ...service,
          ...(ownerStaffId ? { assignedStaff: { create: { staffMemberId: ownerStaffId } } } : {}),
        })),
      },
    },
  });
}
