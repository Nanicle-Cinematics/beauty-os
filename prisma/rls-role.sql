-- ============================================================
-- Beauty OS — restricted runtime role for RLS
--
-- Neon's default owner role (neondb_owner) has BYPASSRLS, which
-- silently defeats Row-Level Security even with FORCE. The app must
-- therefore connect at RUNTIME as this restricted role, which lacks
-- BYPASSRLS so the tenant_isolation policies actually apply. DDL /
-- migrations continue to run as the owner.
--
-- Run as the owner. Set the password out-of-band (see last line) and
-- point the app's DATABASE_URL at this role.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    CREATE ROLE app_rls WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rls;

-- Future tables/sequences created by the owner (e.g. via prisma db push)
-- are granted to app_rls automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_rls;

-- Set the login password (replace before running; keep it only in the
-- app's DATABASE_URL secret, never commit it):
--   ALTER ROLE app_rls WITH PASSWORD '<strong-random-password>';
