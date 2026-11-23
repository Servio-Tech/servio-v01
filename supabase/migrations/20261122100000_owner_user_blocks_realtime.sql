-- Realtime private-channel authorization is separate from table RLS on public.*.
-- This additive restrictive SELECT policy composes with existing permissive
-- realtime.messages policies and the block predicate installed by
-- 20261122020000_owner_user_blocks.sql. It does not grant table/function access.
--
-- Compatibility contract: the target Supabase Realtime deployment must use
-- SELECT RLS on realtime.messages when authorizing private channel joins/reads.
-- This migration fails closed if its table, enabled RLS, helper, or caller
-- permissions are absent; a local PostgreSQL test verifies policy composition,
-- not the live Supabase Realtime JOIN protocol. Existing connections and Push
-- delivery are intentionally outside this migration's guarantees.
BEGIN;

DO $$
DECLARE
  v_messages oid;
  v_allowed oid;
  v_rls_enabled boolean;
  v_is_security_definer boolean;
  v_relkind "char";
BEGIN
  v_messages := pg_catalog.to_regclass('realtime.messages');
  IF v_messages IS NULL THEN
    RAISE EXCEPTION 'Realtime block policy requires realtime.messages; install a compatible Supabase Realtime schema first';
  END IF;

  SELECT c.relrowsecurity, c.relkind
    INTO v_rls_enabled, v_relkind
    FROM pg_catalog.pg_class c
   WHERE c.oid = v_messages;
  IF v_relkind NOT IN ('r', 'p') THEN
    RAISE EXCEPTION 'Realtime block policy requires realtime.messages to be a table';
  END IF;
  IF v_rls_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Realtime block policy requires row-level security already enabled on realtime.messages';
  END IF;

  IF pg_catalog.to_regclass('public.platform_user_blocks') IS NULL
     OR pg_catalog.to_regclass('public.platform_user_session_fences') IS NULL
     OR pg_catalog.to_regclass('auth.users') IS NULL
     OR pg_catalog.to_regclass('auth.sessions') IS NULL THEN
    RAISE EXCEPTION 'Realtime block policy requires the block ledger, session fence, auth.users, and auth.sessions tables';
  END IF;
  IF pg_catalog.to_regprocedure('auth.uid()') IS NULL
     OR pg_catalog.to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE EXCEPTION 'Realtime block policy requires Supabase auth.uid() and auth.jwt() helpers';
  END IF;

  v_allowed := pg_catalog.to_regprocedure('public.platform_current_user_allowed()');
  IF v_allowed IS NULL THEN
    RAISE EXCEPTION 'Realtime block policy requires public.platform_current_user_allowed() from 20261122020000_owner_user_blocks.sql';
  END IF;
  SELECT p.prosecdef
    INTO v_is_security_definer
    FROM pg_catalog.pg_proc p
   WHERE p.oid = v_allowed;
  IF v_is_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'public.platform_current_user_allowed() must be SECURITY DEFINER';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Realtime block policy requires the authenticated database role';
  END IF;
  IF NOT pg_catalog.has_schema_privilege('authenticated', 'realtime', 'USAGE') THEN
    RAISE EXCEPTION 'Realtime block policy requires existing USAGE on schema realtime for authenticated';
  END IF;
  IF NOT pg_catalog.has_table_privilege('authenticated', v_messages, 'SELECT') THEN
    RAISE EXCEPTION 'Realtime block policy requires existing SELECT on realtime.messages for authenticated';
  END IF;
  IF NOT pg_catalog.has_function_privilege('authenticated', v_allowed, 'EXECUTE') THEN
    RAISE EXCEPTION 'Realtime block policy requires existing EXECUTE on public.platform_current_user_allowed() for authenticated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
     WHERE p.polrelid = v_messages
       AND p.polname = 'platform_user_not_blocked_realtime'
  ) THEN
    RAISE EXCEPTION 'Policy platform_user_not_blocked_realtime already exists; refusing to replace any existing policy';
  END IF;
END;
$$;

CREATE POLICY platform_user_not_blocked_realtime
  ON realtime.messages
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.platform_current_user_allowed());

COMMIT;
