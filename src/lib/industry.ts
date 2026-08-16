export type IndustryKey = "beauty" | "photography";

export type IndustryCopy = {
  key: IndustryKey;
  workspaceDescriptor: string;
  nav: {
    appointments: string;
    services: string;
    staff: string;
    inventory: string;
  };
  quickAdd: {
    booking: string;
    service: string;
  };
  pages: {
    appointmentsTitle: string;
    appointmentsDescription: string;
    scheduleTitle: string;
    scheduleDescription: string;
    createBookingTitle: string;
    serviceTitle: string;
    serviceDescription: string;
    serviceMenuTitle: string;
    serviceMenuDescription: string;
    addServiceTitle: string;
    staffTitle: string;
    staffDescription: string;
    staffRosterTitle: string;
    staffRosterDescription: string;
    inventoryTitle: string;
    inventoryDescription: string;
    inventoryListTitle: string;
    inventoryListDescription: string;
    addInventoryTitle: string;
    addInventoryCategoryPlaceholder: string;
  };
};

export type RoleOption = { value: string; label: string };

const beautyRoleLabels: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  SENIOR_ARTIST: "Senior artist",
  ARTIST: "Artist",
  CASHIER: "Cashier",
  INVENTORY_OFFICER: "Inventory officer",
};

const photographyRoleLabels: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Studio manager",
  RECEPTIONIST: "Booking coordinator",
  SENIOR_ARTIST: "Lead photographer",
  ARTIST: "Photographer",
  CASHIER: "Accounts coordinator",
  INVENTORY_OFFICER: "Gear manager",
};

const beautyCopy: IndustryCopy = {
  key: "beauty",
  workspaceDescriptor: "Beauty OS workspace",
  nav: {
    appointments: "Appointments",
    services: "Services",
    staff: "Staff",
    inventory: "Inventory",
  },
  quickAdd: {
    booking: "New booking",
    service: "New service",
  },
  pages: {
    appointmentsTitle: "Appointments",
    appointmentsDescription: "Every booking for this business - confirm, complete, and keep the day flowing.",
    scheduleTitle: "Schedule",
    scheduleDescription: "Tenant-scoped appointment records for this business only.",
    createBookingTitle: "Create booking",
    serviceTitle: "Services",
    serviceDescription: "The menu you sell - pricing, duration, and categories.",
    serviceMenuTitle: "Service menu",
    serviceMenuDescription: "Prices, deposits, duration, and the team who can deliver each service.",
    addServiceTitle: "Add service",
    staffTitle: "Staff",
    staffDescription: "Your team - roles, access, and who is on the floor.",
    staffRosterTitle: "Team roster",
    staffRosterDescription: "Roles, commission, workload, and revenue for this business.",
    inventoryTitle: "Inventory",
    inventoryDescription: "Stock on hand, movement, and reorder risk.",
    inventoryListTitle: "Stock on hand",
    inventoryListDescription: "Levels, value, and expiry - adjust stock inline as you use or receive product.",
    addInventoryTitle: "Add product",
    addInventoryCategoryPlaceholder: "e.g. Hair, Nails",
  },
};

const photographyCopy: IndustryCopy = {
  key: "photography",
  workspaceDescriptor: "Photography workspace",
  nav: {
    appointments: "Shoots",
    services: "Packages",
    staff: "Crew",
    inventory: "Gear",
  },
  quickAdd: {
    booking: "New shoot",
    service: "New package",
  },
  pages: {
    appointmentsTitle: "Shoots",
    appointmentsDescription: "Every shoot for this business - confirm, complete, and keep production moving.",
    scheduleTitle: "Shoot schedule",
    scheduleDescription: "Tenant-scoped shoot records for this photography workspace only.",
    createBookingTitle: "Create shoot",
    serviceTitle: "Packages",
    serviceDescription: "The packages you sell - pricing, session length, and categories.",
    serviceMenuTitle: "Package menu",
    serviceMenuDescription: "Prices, deposits, session length, and the crew who can deliver each package.",
    addServiceTitle: "Add package",
    staffTitle: "Crew",
    staffDescription: "Your crew - roles, access, commission, and who is assigned to shoots.",
    staffRosterTitle: "Crew roster",
    staffRosterDescription: "Roles, commission, workload, and booked revenue for this photography business.",
    inventoryTitle: "Gear",
    inventoryDescription: "Equipment, props, consumables, movement, and replacement risk.",
    inventoryListTitle: "Gear and supplies",
    inventoryListDescription: "Levels, value, and expiry - adjust gear, props, and consumables as they move.",
    addInventoryTitle: "Add gear or supply",
    addInventoryCategoryPlaceholder: "e.g. Cameras, Lenses, Props",
  },
};

export function industryKeyFromCategory(categoryKey?: string | null): IndustryKey {
  const key = (categoryKey ?? "").toLowerCase();
  return key.includes("photo") ? "photography" : "beauty";
}

export function industryCopy(categoryKey?: string | null): IndustryCopy {
  return industryKeyFromCategory(categoryKey) === "photography" ? photographyCopy : beautyCopy;
}

export function roleLabelForIndustry(role: string, categoryKey?: string | null) {
  const labels = industryKeyFromCategory(categoryKey) === "photography" ? photographyRoleLabels : beautyRoleLabels;
  return labels[role] ?? role;
}

export function roleOptionsForIndustry(roles: RoleOption[], categoryKey?: string | null) {
  return roles.map((role) => ({ ...role, label: roleLabelForIndustry(role.value, categoryKey) }));
}
