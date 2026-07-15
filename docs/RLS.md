# Row-Level Security (tenant isolation)

Defense-in-depth so a missing `businessId` filter can never leak one tenant's
data to another. App-layer scoping stays; the database enforces it too.

## Status — ✅ LIVE IN PRODUCTION (2026-07-15)

- ✅ **Policies** — `prisma/rls.sql` (33 tables: 24 direct `businessId`,
  `Business` by `id`, 8 child tables via parent `EXISTS`). Applied to prod.
- ✅ **Restricted role** — `prisma/rls-role.sql` (`app_rls`, no `BYPASSRLS`).
  Neon's `neondb_owner` has `BYPASSRLS`, which defeats RLS — the app connects
  as `app_rls` at runtime.
- ✅ **App integration** — `tenant-context.ts` + the `prisma.ts` extension +
  `tenantTransaction`, wired through the auth guards. Active when `DB_RLS=on`.
- ✅ **Production cutover done** — prod (and local `.env`) now connect as
  `app_rls` with `DB_RLS=on`; `MIGRATE_DATABASE_URL` holds the owner URL for
  DDL. Verified live: every module + auth + platform admin works, cross-tenant
  read/write blocked, own-tenant writes succeed, zero runtime errors.

**Rollback (instant):** set prod `DATABASE_URL` back to the owner URL (owner
has `BYPASSRLS`, so RLS lifts immediately) and redeploy; or unset `DB_RLS`.

## How it works

Each tenant-scoped table has a policy:

```
USING (current_setting('app.bypass_rls', true) = 'on'
       OR "businessId" = current_setting('app.business_id', true))
```

Two transaction-local GUCs, set per request:

- `app.business_id` — the current tenant. Set for all tenant data access.
- `app.bypass_rls = 'on'` — lifts the filter for auth / workspace-resolution /
  platform-admin / system paths (login, session lookup, membership checks,
  `Business`-by-slug resolution, cross-tenant admin reads).

With **neither** set, `current_setting(..., true)` is NULL, every predicate is
false, and **zero rows** are visible — the safe default.

GUCs are set with `set_config(name, value, true)` (the `true` = transaction-
local) so they're safe under Neon's transaction-mode pooler — a connection
can't leak one request's tenant to the next.

## App integration (the remaining work)

1. **Runtime role.** Point `DATABASE_URL` at `app_rls` (keep an owner URL,
   e.g. `MIGRATE_DATABASE_URL`, for `prisma db push` / applying these SQL files).
2. **Tenant context.** `AsyncLocalStorage<{ businessId?, bypass? }>` set in the
   auth guards: `requireTenantAccess` resolves the business id and sets
   `{ businessId }`; `getCurrentUser` / `requireUser` / `requirePlatformAdmin`
   and the login path run with `{ bypass: true }`.
3. **Prisma extension.** In `$allOperations`, wrap each non-interactive op as
   `base.$transaction([ set_config(app.business_id, app.bypass_rls), query(args) ])`
   so the GUC and the query share one transaction/connection. Interactive
   transactions (recordPayment, createBusiness, acceptInvite, inventory add,
   loyalty update) set the GUC as their first statement and mark the context so
   inner ops don't double-wrap. Compose with the existing P1001/P1002/P1017
   retry loop.

## Production cutover (staged — the DB is shared with local dev)

Applying policies to the shared DB affects prod instantly, so order matters:

1. Ship integration code **flagged off** (`DB_RLS` unset) → no behaviour change.
2. On the prod DB (as owner): run `prisma/rls-role.sql`, set the `app_rls`
   password, `GRANT` verified.
3. Add `MIGRATE_DATABASE_URL` (owner) and switch `DATABASE_URL` to `app_rls`
   **with `DB_RLS=on`** — but policies not yet applied, so app_rls sees
   everything (bypass-less but unrestricted). Verify the app is fully healthy
   as `app_rls`.
4. Apply `prisma/rls.sql` (as owner). RLS now enforces; the app is already
   setting GUCs. Verify: normal tenant flows work, a cross-tenant probe returns
   nothing, platform admin still sees all.
5. Rollback if needed: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` or point
   `DATABASE_URL` back at the owner (BYPASSRLS) — either instantly lifts RLS.

## Applying the SQL

No `psql` needed — statements are separated by `--STMT--`:

```
node -e "const {PrismaClient}=require('@prisma/client');const fs=require('fs');\
const p=new PrismaClient({datasources:{db:{url:process.env.MIGRATE_DATABASE_URL}}});\
(async()=>{for(const s of fs.readFileSync('prisma/rls.sql','utf8').split(/^--STMT--$/m).map(x=>x.trim()).filter(x=>x&&!/^(--.*\n?)*$/.test(x)))await p.\$executeRawUnsafe(s);await p.\$disconnect()})()"
```
