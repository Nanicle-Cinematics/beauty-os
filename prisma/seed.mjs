import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");

  return `scrypt$${salt}$${key}`;
}

// Password for BRAND-NEW users only. Prefer SEED_PASSWORD; otherwise generate
// a strong random one (never the old hardcoded "password123"). Existing users'
// passwords are never touched, so re-seeding can't reset rotated credentials.
const seedPassword = process.env.SEED_PASSWORD || randomBytes(12).toString("base64url").slice(0, 16);
const usingGeneratedPassword = !process.env.SEED_PASSWORD;
const createdCredentials = [];

// Upsert a user without ever overwriting the password of one that already
// exists — the create branch sets it, the update branch leaves it alone.
async function upsertUser({ email, name, isPlatformAdmin = false }) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { name, isPlatformAdmin, emailVerifiedAt: new Date() },
    });
    return existing.id;
  }
  const created = await prisma.user.create({
    data: { email, name, isPlatformAdmin, passwordHash: hashPassword(seedPassword), emailVerifiedAt: new Date() },
  });
  createdCredentials.push({ email, password: seedPassword });
  return created.id;
}

async function seedPlatformAdmin() {
  await upsertUser({ email: "admin@beautyos.dev", name: "Platform Admin", isPlatformAdmin: true });
}

async function seedLookupData() {
  const categories = await Promise.all([
    prisma.businessCategory.upsert({
      where: { key: "hair_makeup_nails" },
      update: { label: "Hair, makeup, nails", icon: "sparkle", sortOrder: 10, isActive: true },
      create: { key: "hair_makeup_nails", label: "Hair, makeup, nails", icon: "sparkle", sortOrder: 10 },
    }),
    prisma.businessCategory.upsert({
      where: { key: "lashes_brows" },
      update: { label: "Lashes and brows", icon: "eye", sortOrder: 20, isActive: true },
      create: { key: "lashes_brows", label: "Lashes and brows", icon: "eye", sortOrder: 20 },
    }),
  ]);

  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { key: "STUDIO" },
      update: {
        name: "Studio Pro",
        priceMonthly: "349.00",
        priceYearly: "3490.00",
        features: ["Bookings", "CRM", "Inventory", "Payments"],
        limits: { staffSeats: 8, branches: 1 },
        isActive: true,
      },
      create: {
        key: "STUDIO",
        name: "Studio Pro",
        priceMonthly: "349.00",
        priceYearly: "3490.00",
        features: ["Bookings", "CRM", "Inventory", "Payments"],
        limits: { staffSeats: 8, branches: 1 },
      },
    }),
    prisma.plan.upsert({
      where: { key: "PROFESSIONAL" },
      update: {
        name: "Growth Suite",
        priceMonthly: "199.00",
        priceYearly: "1990.00",
        features: ["Bookings", "CRM", "Marketing"],
        limits: { staffSeats: 4, branches: 1 },
        isActive: true,
      },
      create: {
        key: "PROFESSIONAL",
        name: "Growth Suite",
        priceMonthly: "199.00",
        priceYearly: "1990.00",
        features: ["Bookings", "CRM", "Marketing"],
        limits: { staffSeats: 4, branches: 1 },
      },
    }),
  ]);

  return {
    hairCategory: categories[0],
    lashCategory: categories[1],
    studioPlan: plans[0],
    growthPlan: plans[1],
  };
}

async function resetTenantSampleData(businessId) {
  await prisma.appointment.deleteMany({ where: { businessId } });
  await prisma.stockMovement.deleteMany({ where: { businessId } });
  await prisma.serviceProduct.deleteMany({ where: { service: { businessId } } });
  await prisma.serviceStaff.deleteMany({ where: { service: { businessId } } });
  await prisma.product.deleteMany({ where: { businessId } });
  await prisma.service.deleteMany({ where: { businessId } });
  await prisma.serviceCategory.deleteMany({ where: { businessId } });
  await prisma.customer.deleteMany({ where: { businessId } });
  await prisma.businessHours.deleteMany({ where: { businessId } });
}

async function seedBusiness({
  slug,
  name,
  categoryId,
  planId,
  ownerEmail,
  ownerName,
  status,
  services,
  customers,
  products,
}) {
  const ownerId = await upsertUser({ email: ownerEmail, name: ownerName });

  const business = await prisma.business.upsert({
    where: { slug },
    update: {
      name,
      categoryId,
      status,
      timezone: "Africa/Accra",
      currency: "GHS",
      country: "Ghana",
      city: "Accra",
    },
    create: {
      slug,
      name,
      categoryId,
      status,
      timezone: "Africa/Accra",
      currency: "GHS",
      country: "Ghana",
      city: "Accra",
    },
  });

  await prisma.subscription.upsert({
    where: { businessId: business.id },
    update: {
      planId,
      billingCycle: "MONTHLY",
      status: status === "TRIAL" ? "TRIALING" : "ACTIVE",
      trialEndsAt: status === "TRIAL" ? new Date("2026-08-13T00:00:00.000Z") : null,
      currentPeriodEnd: new Date("2026-08-13T00:00:00.000Z"),
    },
    create: {
      businessId: business.id,
      planId,
      billingCycle: "MONTHLY",
      status: status === "TRIAL" ? "TRIALING" : "ACTIVE",
      trialEndsAt: status === "TRIAL" ? new Date("2026-08-13T00:00:00.000Z") : null,
      currentPeriodEnd: new Date("2026-08-13T00:00:00.000Z"),
    },
  });

  const ownerStaff = await prisma.staffMember.upsert({
    where: { businessId_userId: { businessId: business.id, userId: ownerId } },
    update: { role: "OWNER", status: "ACTIVE", joinedAt: new Date("2026-07-01T09:00:00.000Z") },
    create: {
      businessId: business.id,
      userId: ownerId,
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: new Date("2026-07-01T09:00:00.000Z"),
      colorHex: "#10b981",
    },
  });

  await resetTenantSampleData(business.id);

  for (const dayOfWeek of [1, 2, 3, 4, 5, 6]) {
    await prisma.businessHours.create({
      data: {
        businessId: business.id,
        dayOfWeek,
        openTime: "09:00",
        closeTime: dayOfWeek === 6 ? "16:00" : "19:00",
      },
    });
  }

  const category = await prisma.serviceCategory.create({
    data: {
      businessId: business.id,
      name: "Signature services",
      sortOrder: 1,
    },
  });

  const createdServices = [];
  for (const service of services) {
    const createdService = await prisma.service.create({
      data: {
        businessId: business.id,
        categoryId: category.id,
        name: service.name,
        description: service.description,
        price: service.price,
        depositAmount: service.depositAmount,
        durationMinutes: service.durationMinutes,
        colorHex: service.colorHex,
        assignedStaff: {
          create: {
            staffMemberId: ownerStaff.id,
          },
        },
      },
    });
    createdServices.push(createdService);
  }

  const createdCustomers = [];
  for (const customer of customers) {
    const createdCustomer = await prisma.customer.create({
      data: {
        businessId: business.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
        tags: customer.tags,
        skinNotes: customer.skinNotes,
      },
    });
    createdCustomers.push(createdCustomer);
  }

  for (const product of products) {
    await prisma.product.create({
      data: {
        businessId: business.id,
        name: product.name,
        category: product.category,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        quantityOnHand: product.quantityOnHand,
        reorderThreshold: product.reorderThreshold,
      },
    });
  }

  const appointmentTimes = [
    ["2026-07-13T09:00:00.000Z", "2026-07-13T10:30:00.000Z"],
    ["2026-07-13T10:30:00.000Z", "2026-07-13T12:00:00.000Z"],
    ["2026-07-13T12:00:00.000Z", "2026-07-13T13:30:00.000Z"],
  ];

  for (let index = 0; index < createdCustomers.length; index += 1) {
    const service = createdServices[index % createdServices.length];
    await prisma.appointment.create({
      data: {
        businessId: business.id,
        customerId: createdCustomers[index].id,
        serviceId: service.id,
        staffMemberId: ownerStaff.id,
        startAt: new Date(appointmentTimes[index][0]),
        endAt: new Date(appointmentTimes[index][1]),
        status: index === 0 ? "CONFIRMED" : "PENDING",
        source: "ADMIN",
        price: service.price,
        depositAmount: service.depositAmount,
        depositPaid: index !== 2,
      },
    });
  }

  await prisma.loyaltyProgram.upsert({
    where: { businessId: business.id },
    update: { active: true },
    create: { businessId: business.id, active: true },
  });

  return business;
}

async function main() {
  await seedPlatformAdmin();

  const { hairCategory, lashCategory, studioPlan, growthPlan } = await seedLookupData();

  await seedBusiness({
    slug: "osu-glow-studio",
    name: "Osu Glow Studio",
    categoryId: hairCategory.id,
    planId: studioPlan.id,
    ownerEmail: "owner@osuglow.example",
    ownerName: "Nadia Mensah",
    status: "ACTIVE",
    services: [
      { name: "Silk press + trim", description: "Wash, press, and ends refresh.", price: "420.00", depositAmount: "100.00", durationMinutes: 90, colorHex: "#10b981" },
      { name: "Soft glam", description: "Event-ready makeup application.", price: "650.00", depositAmount: "150.00", durationMinutes: 90, colorHex: "#f43f5e" },
      { name: "Wig install", description: "Install, style, and finish.", price: "780.00", depositAmount: "200.00", durationMinutes: 120, colorHex: "#2563eb" },
    ],
    customers: [
      { firstName: "Ama", lastName: "Serwaa", phone: "+233200000001", email: "ama@example.com", tags: ["VIP"], skinNotes: "Prefers warm undertones" },
      { firstName: "Esi", lastName: "Manu", phone: "+233200000002", email: "esi@example.com", tags: ["repeat"], skinNotes: "Sensitive skin" },
      { firstName: "Akua", lastName: "Mensah", phone: "+233200000003", email: "akua@example.com", tags: ["bridal"], skinNotes: "Likes soft finish" },
    ],
    products: [
      { name: "Lace adhesive", category: "Hair", costPrice: "45.00", sellingPrice: "80.00", quantityOnHand: "2.00", reorderThreshold: "5.00" },
      { name: "Developer 20 vol", category: "Color", costPrice: "35.00", sellingPrice: "60.00", quantityOnHand: "4.00", reorderThreshold: "6.00" },
      { name: "Nude gel polish", category: "Nails", costPrice: "30.00", sellingPrice: "75.00", quantityOnHand: "1.00", reorderThreshold: "4.00" },
    ],
  });

  await seedBusiness({
    slug: "luxe-lash-lab",
    name: "Luxe Lash Lab",
    categoryId: lashCategory.id,
    planId: growthPlan.id,
    ownerEmail: "owner@luxelash.example",
    ownerName: "Mina Owusu",
    status: "TRIAL",
    services: [
      { name: "Classic lash set", description: "Natural lash extension set.", price: "360.00", depositAmount: "80.00", durationMinutes: 120, colorHex: "#f43f5e" },
      { name: "Brow lamination", description: "Shape, lift, and tint.", price: "220.00", depositAmount: "50.00", durationMinutes: 60, colorHex: "#f59e0b" },
    ],
    customers: [
      { firstName: "Yaa", lastName: "Boateng", phone: "+233200000004", email: "yaa@example.com", tags: ["new"], skinNotes: "Prefers natural finish" },
      { firstName: "Afia", lastName: "Owusu", phone: "+233200000005", email: "afia@example.com", tags: ["VIP"], skinNotes: "Avoid strong adhesive" },
      { firstName: "Serwaa", lastName: "King", phone: "+233200000006", email: "serwaa@example.com", tags: ["birthday"], skinNotes: "Send birthday promo" },
    ],
    products: [
      { name: "Classic lash trays", category: "Lashes", costPrice: "55.00", sellingPrice: "95.00", quantityOnHand: "6.00", reorderThreshold: "5.00" },
      { name: "Lash adhesive", category: "Lashes", costPrice: "65.00", sellingPrice: "110.00", quantityOnHand: "2.00", reorderThreshold: "4.00" },
    ],
  });

  console.log("Seeded Beauty OS tenants, plans, services, clients, appointments, and inventory.");

  if (createdCredentials.length) {
    const source = usingGeneratedPassword ? "a generated password (set SEED_PASSWORD to control it)" : "SEED_PASSWORD";
    console.log(`\nCreated ${createdCredentials.length} new user(s) with ${source}:`);
    for (const c of createdCredentials) {
      console.log(usingGeneratedPassword ? `   ${c.email}  ->  ${c.password}` : `   ${c.email}`);
    }
    console.log("Store these now — existing users' passwords were left unchanged.\n");
  } else {
    console.log("No new users created; existing users' passwords were left unchanged.\n");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
