-- ============================================================
-- Beauty OS — Row-Level Security (tenant isolation defense-in-depth)
--
-- Every tenant-scoped table only exposes rows for the current
-- business, decided by the transaction-local GUC `app.business_id`.
-- `app.bypass_rls = 'on'` lifts the filter for auth/admin/system
-- paths (login, workspace resolution, platform admin).
--
-- Defaults are SAFE: with neither GUC set, current_setting(..., true)
-- returns NULL, every predicate is false, and ZERO rows are visible.
--
-- FORCE is required because the app role owns these tables (owners
-- otherwise bypass RLS). Idempotent: safe to re-run.
--
-- Statements are separated by "--STMT--" lines so the app-side applier
-- can run them one at a time; psql runs the whole file directly.
-- ============================================================

--STMT--
-- Direct tenant tables (own businessId)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Appointment','AuditLog','BusinessHours','BusinessInvite','Campaign','ClientTier',
    'Coupon','Customer','CustomerNote','Expense','Invoice','LoyaltyLedgerEntry',
    'LoyaltyProgram','NotificationLog','Payment','Product','PurchaseOrder','Service',
    'ServiceCategory','StaffMember','StockMovement','Subscription','Supplier','WaitlistEntry'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (current_setting('app.bypass_rls', true) = 'on'
               OR "businessId" = current_setting('app.business_id', true))
        WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
               OR "businessId" = current_setting('app.business_id', true));
    $f$, t);
  END LOOP;
END $$;

--STMT--
-- The tenant table itself (keyed by id)
ALTER TABLE "Business" ENABLE ROW LEVEL SECURITY;
--STMT--
ALTER TABLE "Business" FORCE ROW LEVEL SECURITY;
--STMT--
DROP POLICY IF EXISTS tenant_isolation ON "Business";
--STMT--
CREATE POLICY tenant_isolation ON "Business"
  USING (current_setting('app.bypass_rls', true) = 'on'
         OR "id" = current_setting('app.business_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
         OR "id" = current_setting('app.business_id', true));

--STMT--
-- Child tables (scoped through a parent's businessId)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('CustomerPhoto',    'customerId',      'Customer'),
      ('InvoiceLineItem',  'invoiceId',       'Invoice'),
      ('PurchaseOrderItem','purchaseOrderId', 'PurchaseOrder'),
      ('ServiceImage',     'serviceId',       'Service'),
      ('ServiceProduct',   'serviceId',       'Service'),
      ('ServiceStaff',     'serviceId',       'Service'),
      ('TimeOff',          'staffMemberId',   'StaffMember'),
      ('WorkingHours',     'staffMemberId',   'StaffMember')
    ) AS v(tbl, fk, parent)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', r.tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', r.tbl);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (current_setting('app.bypass_rls', true) = 'on'
               OR EXISTS (SELECT 1 FROM %I p
                          WHERE p."id" = %I.%I
                            AND p."businessId" = current_setting('app.business_id', true)))
        WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
               OR EXISTS (SELECT 1 FROM %I p
                          WHERE p."id" = %I.%I
                            AND p."businessId" = current_setting('app.business_id', true)));
    $f$, r.tbl, r.parent, r.tbl, r.fk, r.parent, r.tbl, r.fk);
  END LOOP;
END $$;
