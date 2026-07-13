# Beauty OS

Multi-tenant SaaS for beauty studios, salons, artists, and spas.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Key routes:

- `/` - workspace switcher
- `/:businessSlug` - tenant workspace dashboard
- `/:businessSlug/appointments` - tenant appointment operations
- `/platform` - platform owner admin portal
- `/login` - sign in
- `/logout` - sign out

## Development Accounts

Until production auth is connected, local/demo auth accepts:

| Email | Role | Password |
| --- | --- | --- |
| `admin@beautyos.dev` | Platform admin | `password123` |
| `owner@osuglow.example` | Osu Glow owner | `password123` |
| `owner@luxelash.example` | Luxe Lash owner | `password123` |

## Database Setup

Beauty OS uses a shared Postgres database with tenant-scoped records keyed by `businessId`.

1. Create a Postgres database, for example Neon.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL`.
4. Push the schema and seed starter data:

```bash
npm run db:push
npm run db:seed
```

Without `DATABASE_URL`, the app still renders using sample fallback data so UI work can continue safely.

## Multi-Tenant Foundation

- `src/lib/prisma.ts` creates the server-side Prisma client.
- `src/lib/tenant-data.ts` resolves workspace, tenant, and platform data.
- `src/lib/auth.ts` manages cookie sessions and route guards.
- `src/lib/appointment-data.ts` scopes appointment reads and writes by business.
- `src/app/[businessSlug]/page.tsx` resolves the tenant by slug before rendering the dashboard.
- `prisma/seed.mjs` creates starter categories, plans, businesses, owners, staff, services, clients, appointments, inventory, and loyalty records.
