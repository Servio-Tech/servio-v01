-- Apply after 20261122030000: that migration wraps all then-executable
-- SECURITY DEFINER RPCs and keeps the public function OIDs and ACLs. Revoke the
-- public entry points *after* wrapping; its private copies are already inaccessible
-- to API roles. Do not revoke service_role/owner privileges needed for maintenance.
-- Current registration uses ensure_profile_for_current_user(), not the legacy
-- unbound tenant creator. The totals helper is called by a definer order trigger.
BEGIN;

REVOKE ALL ON FUNCTION public.create_tenant_for_registration(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_cashier_session_totals(uuid)
  FROM PUBLIC, anon, authenticated;

-- Never strand an installed totals trigger if the live ownership differs from
-- what was inspected. Check the actual effective privilege *after* revocation.
DO $$
DECLARE
  sync_oid pg_catalog.oid := pg_catalog.to_regprocedure('public.sync_cashier_session_totals_from_order()');
BEGIN
  IF sync_oid IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = sync_oid AND p.prosecdef
      AND pg_catalog.has_function_privilege(p.proowner,
        'public.refresh_cashier_session_totals(uuid)', 'EXECUTE')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.orders'::pg_catalog.regclass
      AND t.tgfoid = sync_oid AND NOT t.tgisinternal AND t.tgenabled IN ('O', 'A')
  ) THEN
    RAISE EXCEPTION 'Cashier totals trigger or its owner privilege differs from the inspected configuration';
  END IF;
END $$;

-- These invoker trigger bodies only use their NEW row and built-in operators.
-- ALTER keeps function OIDs, bodies, trigger bindings, owners and ACLs unchanged.
ALTER FUNCTION public.guard_ready_order_payment_state() SET search_path = '';
ALTER FUNCTION public.guard_unpaid_completion_state() SET search_path = '';

NOTIFY pgrst, 'reload schema';
COMMIT;
