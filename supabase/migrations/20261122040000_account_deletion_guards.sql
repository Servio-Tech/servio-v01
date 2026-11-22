-- Account removal guards. Apply after the owner-block and subscription migrations.
-- Conservative policy: cashier deletion is archival, NOT physical Auth deletion.
-- Existing linked identities and notification history remain; Auth deletion is
-- refused while a cashier link or notification subscription exists. This does
-- not define a general retention policy for other notification deletion paths.
BEGIN;

-- An independent write per tenant provides a serialization point without
-- modifying tenant data or relying only on SELECT FOR UPDATE: at REPEATABLE READ
-- a competing write aborts rather than using a stale count. No application role
-- can read or modify these rows. Entries intentionally survive tenant deletion.
CREATE TABLE public.platform_staff_guard_versions (
  tenant_id uuid PRIMARY KEY,
  version bigint NOT NULL DEFAULT 1
);
ALTER TABLE public.platform_staff_guard_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_staff_guard_versions FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.platform_lock_staff_guard(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Staff record has no tenant' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.platform_staff_guard_versions AS g(tenant_id,version)
  VALUES (p_tenant_id,1)
  ON CONFLICT (tenant_id) DO UPDATE SET version = g.version + 1;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_lock_staff_guard(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Auth schema versions are managed by Supabase. Inspect the catalog rather than
-- making this guard depend on an Auth column that may not exist in every version.
-- The fixture asserts the supported banned_until shape when testing that branch.
CREATE FUNCTION public.platform_staff_auth_login_allowed(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_banned_type oid; v_allowed boolean;
BEGIN
  -- A cashier without an Auth identity remains usable by the legacy PIN login.
  IF p_user_id IS NULL THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.platform_user_blocks b WHERE b.user_id=p_user_id) THEN
    RETURN false;
  END IF;
  SELECT a.atttypid INTO v_banned_type FROM pg_catalog.pg_attribute a
    WHERE a.attrelid='auth.users'::regclass AND a.attname='banned_until'
      AND a.attnum>0 AND NOT a.attisdropped;
  IF v_banned_type IS NULL THEN
    SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p_user_id) INTO v_allowed;
  ELSE
    IF v_banned_type <> 'timestamptz'::regtype THEN
      RAISE EXCEPTION 'Unsupported auth.users.banned_until type; refusing staff eligibility check';
    END IF;
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=$1 AND (u.banned_until IS NULL OR u.banned_until <= pg_catalog.now()))'
      INTO v_allowed USING p_user_id;
  END IF;
  RETURN v_allowed;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_staff_auth_login_allowed(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.platform_assert_other_admin(p_tenant_id uuid, p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.platform_lock_staff_guard(p_tenant_id);
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.tenant_id=p_tenant_id AND p.role='admin' AND p.id<>p_profile_id
                   AND public.platform_staff_auth_login_allowed(p.id)) THEN
    RAISE EXCEPTION 'LAST_TENANT_ADMIN' USING ERRCODE='23503';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_assert_other_admin(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The supported owner ban path writes this ledger before calling Auth. Reject
-- that write if it would strand the tenant without an eligible admin/cashier.
-- Sorted tenant locks serialize the check with profile changes and cashier archive.
CREATE FUNCTION public.platform_guard_staff_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_tenant_id uuid;
BEGIN
  IF NEW.operation IS DISTINCT FROM 'ban_user' OR
     (TG_OP='UPDATE' AND OLD.operation IS NOT DISTINCT FROM NEW.operation) THEN
    RETURN NEW;
  END IF;
  IF NOT public.platform_staff_auth_login_allowed(NEW.user_id) THEN RETURN NEW; END IF;

  FOR r IN
    SELECT p.tenant_id FROM public.profiles p
      WHERE p.id=NEW.user_id AND p.role='admin'
    UNION
    SELECT c.tenant_id FROM public.cashiers c
      WHERE c.auth_user_id=NEW.user_id AND c.is_active IS TRUE
    ORDER BY tenant_id
  LOOP
    PERFORM public.platform_lock_staff_guard(r.tenant_id);
  END LOOP;

  SELECT p.tenant_id INTO v_tenant_id FROM public.profiles p
    WHERE p.id=NEW.user_id AND p.role='admin';
  IF FOUND AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.tenant_id=v_tenant_id
      AND p.role='admin' AND p.id<>NEW.user_id
      AND public.platform_staff_auth_login_allowed(p.id)
  ) THEN
    RAISE EXCEPTION 'LAST_TENANT_ADMIN' USING ERRCODE='23503';
  END IF;

  FOR r IN SELECT c.id,c.tenant_id FROM public.cashiers c
      WHERE c.auth_user_id=NEW.user_id AND c.is_active IS TRUE
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.cashiers c
      WHERE c.tenant_id=r.tenant_id AND c.is_active IS TRUE AND c.id<>r.id
        AND (c.auth_user_id IS NULL OR public.platform_staff_auth_login_allowed(c.auth_user_id))) THEN
      RAISE EXCEPTION 'LAST_ACTIVE_CASHIER' USING ERRCODE='23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_guard_staff_block() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER platform_guard_staff_block
  BEFORE INSERT OR UPDATE OF operation ON public.platform_user_blocks
  FOR EACH ROW EXECUTE FUNCTION public.platform_guard_staff_block();

-- Applies to direct profile DELETE, role change, tenant transfer and the FK
-- cascade caused by Auth DELETE. A linked cashier profile is retained instead
-- of silently breaking its relationship with the historical cashier record.
CREATE FUNCTION public.platform_guard_staff_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.id IS NOT DISTINCT FROM OLD.id
      AND NEW.role IS NOT DISTINCT FROM OLD.role
      AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id THEN
    RETURN NEW;
  END IF;
  -- A non-FK cashier link could otherwise commit after a fixed snapshot but
  -- before the table lock, and be invisible when checking the profile.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Staff profile removal requires READ COMMITTED isolation' USING ERRCODE='0A000';
  END IF;
  LOCK TABLE public.cashiers IN SHARE MODE;
  IF EXISTS (SELECT 1 FROM public.cashiers c WHERE c.auth_user_id=OLD.id) THEN
    RAISE EXCEPTION 'Linked cashier profile must be retained' USING ERRCODE='23503';
  END IF;
  IF OLD.role='admin' AND (TG_OP='DELETE' OR NEW.role IS DISTINCT FROM 'admin'
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.id IS DISTINCT FROM OLD.id) THEN
    PERFORM public.platform_assert_other_admin(OLD.tenant_id, OLD.id);
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_guard_staff_profile() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER platform_guard_staff_profile BEFORE DELETE OR UPDATE OF id, role, tenant_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.platform_guard_staff_profile();

-- Guard every direct row change, not just the cashier-delete Edge endpoint.
-- Cashier records are historical: do not delete or unlink them through a
-- separate request that could leave orders, shifts or identities inconsistent.
CREATE FUNCTION public.platform_guard_cashier_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Cashier records must be archived, not deleted' USING ERRCODE='23503';
  END IF;

  IF TG_OP='UPDATE' THEN
    IF OLD.auth_user_id IS NOT NULL AND NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
      RAISE EXCEPTION 'Cashier identity link must be retained' USING ERRCODE='23503';
    END IF;
    IF OLD.auth_user_id IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Linked cashier cannot be moved between tenants' USING ERRCODE='23503';
    END IF;
    IF OLD.is_active IS TRUE AND (NEW.is_active IS NOT TRUE OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) THEN
      IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'Cashier removal requires READ COMMITTED isolation' USING ERRCODE='0A000';
      END IF;
      PERFORM public.platform_lock_staff_guard(OLD.tenant_id);
      IF EXISTS (SELECT 1 FROM public.cashier_sessions s WHERE s.cashier_id=OLD.id AND s.status='open') THEN
        RAISE EXCEPTION 'Cashier must close the open shift before account deletion' USING ERRCODE='55000';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.cashiers c
                     WHERE c.tenant_id=OLD.tenant_id AND c.is_active IS TRUE AND c.id<>OLD.id
                       AND (c.auth_user_id IS NULL OR public.platform_staff_auth_login_allowed(c.auth_user_id))) THEN
        RAISE EXCEPTION 'LAST_ACTIVE_CASHIER' USING ERRCODE='23514';
      END IF;
    END IF;
    IF OLD.is_active IS DISTINCT FROM NEW.is_active AND OLD.auth_user_id IS NOT NULL THEN
      -- Fence old JWTs on both archive and reactivation. Session creation takes
      -- the FK key-share lock on auth.users; take the stronger lock first.
      PERFORM 1 FROM auth.users u WHERE u.id=OLD.auth_user_id FOR UPDATE;
      INSERT INTO public.platform_user_session_fences(user_id) VALUES(OLD.auth_user_id) ON CONFLICT DO NOTHING;
      DELETE FROM auth.sessions s WHERE s.user_id=OLD.auth_user_id;
    END IF;
  END IF;

  IF NEW.auth_user_id IS NOT NULL AND (TG_OP='INSERT' OR OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id) THEN
    IF NEW.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Cannot link an archived cashier' USING ERRCODE='23514';
    END IF;
    -- auth_user_id has no FK. Serialize link creation with Auth DELETE and fail
    -- closed if a concurrent deletion won; do not create a dangling link.
    PERFORM 1 FROM auth.users u WHERE u.id=NEW.auth_user_id FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cashier Auth identity not found' USING ERRCODE='23503'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_guard_cashier_lifecycle() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER platform_guard_cashier_lifecycle BEFORE INSERT OR DELETE OR UPDATE OF tenant_id, auth_user_id, is_active ON public.cashiers
  FOR EACH ROW EXECUTE FUNCTION public.platform_guard_cashier_lifecycle();

-- Direct INSERT/UPDATE of shifts is also permitted by the legacy schema. Take
-- the same cashier row lock used by the normal open-shift RPC, so archiving and
-- creating/reopening an open shift cannot pass one another unchecked.
CREATE FUNCTION public.platform_guard_open_cashier_shift()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_active boolean;
BEGIN
  IF NEW.status='open' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'open'
      OR OLD.cashier_id IS DISTINCT FROM NEW.cashier_id) THEN
    SELECT c.is_active INTO v_active FROM public.cashiers c WHERE c.id=NEW.cashier_id FOR UPDATE;
    IF NOT FOUND OR v_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Active cashier required for an open shift' USING ERRCODE='55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_guard_open_cashier_shift() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER platform_guard_open_cashier_shift BEFORE INSERT OR UPDATE OF cashier_id, status ON public.cashier_sessions
  FOR EACH ROW EXECUTE FUNCTION public.platform_guard_open_cashier_shift();

-- The subscription migration wraps this original body in public.deactivate_cashier.
-- Preserve that public wrapper and its subscription check; lock and recheck the
-- requesting manager's profile here so concurrent demotion cannot authorize a
-- stale request. The existing cashier row lock still serializes shift opening.
CREATE OR REPLACE FUNCTION servio_subscription_private.deactivate_cashier(p_cashier_id uuid)
RETURNS TABLE (id uuid, full_name text, auth_user_id uuid, is_active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant_id uuid; v_cashier public.cashiers%ROWTYPE;
BEGIN
  SELECT p.tenant_id INTO v_tenant_id FROM public.profiles p
    WHERE p.id=auth.uid() AND p.role='admin' FOR SHARE;
  IF NOT FOUND OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501';
  END IF;
  SELECT c.* INTO v_cashier FROM public.cashiers c
    WHERE c.id=p_cashier_id AND c.tenant_id=v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cashier not found' USING ERRCODE='P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.cashier_sessions s WHERE s.cashier_id=v_cashier.id AND s.status='open') THEN
    RAISE EXCEPTION 'Cashier must close the open shift before account deletion' USING ERRCODE='55000';
  END IF;
  UPDATE public.cashiers AS c SET is_active=false WHERE c.id=v_cashier.id
    RETURNING c.id,c.full_name,c.auth_user_id,c.is_active INTO id,full_name,auth_user_id,is_active;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION servio_subscription_private.deactivate_cashier(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Deny archived cashier JWTs at the existing PostgREST hook and RLS policy.
-- As with the original block mechanism, already-open Realtime / in-flight push
-- cannot be guaranteed revoked here. Auth accounts are deliberately retained.
CREATE OR REPLACE FUNCTION public.platform_current_user_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
       AND (u.banned_until IS NULL OR u.banned_until<=pg_catalog.now()))
     AND NOT EXISTS (SELECT 1 FROM public.platform_user_blocks b WHERE b.user_id=auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.cashiers c
       WHERE c.auth_user_id=auth.uid() AND c.is_active IS NOT TRUE)
     AND (NOT EXISTS (SELECT 1 FROM public.platform_user_session_fences f WHERE f.user_id=auth.uid())
       OR EXISTS (SELECT 1 FROM auth.sessions s WHERE s.user_id=auth.uid()
         AND s.id::text=(auth.jwt()->>'session_id')));
$$;
REVOKE ALL ON FUNCTION public.platform_current_user_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_current_user_allowed() TO authenticated, service_role;

-- Applies to ALL Auth deletions (including ones not initiated by owner-admin).
-- SHARE prevents uncommitted non-FK links or subscriptions appearing between the
-- checks and deletion. Reject snapshot isolation because after waiting for a
-- writer its old snapshot could miss a newly committed row. The linking trigger
-- also takes an Auth key-share lock, so a writer arriving later cannot leave an
-- orphan. Deadlock/serialization failures roll back the whole operation.
CREATE FUNCTION public.platform_guard_auth_retention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'User deletion requires READ COMMITTED isolation' USING ERRCODE='0A000';
  END IF;
  LOCK TABLE public.cashiers, public.notification_subscriptions IN SHARE MODE;
  IF EXISTS (SELECT 1 FROM public.cashiers c WHERE c.auth_user_id=OLD.id) THEN
    RAISE EXCEPTION 'User deletion blocked by linked cashier' USING ERRCODE='23503';
  END IF;
  IF EXISTS (SELECT 1 FROM public.notification_subscriptions s WHERE s.user_id=OLD.id) THEN
    RAISE EXCEPTION 'User deletion blocked by retained notification subscriptions' USING ERRCODE='23503';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_guard_auth_retention() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER platform_guard_auth_retention BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.platform_guard_auth_retention();

-- Reject last-manager deletion before creating a pending marker. The profile
-- trigger repeats this in the actual Auth transaction, after any preflight race.
CREATE OR REPLACE FUNCTION public.platform_prepare_user_deletion(p_actor_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text; v_tenant_id uuid;
BEGIN
  PERFORM public.platform_require_owner(p_actor_id);
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found' USING ERRCODE='P0002'; END IF;
  IF p_actor_id=p_user_id OR pg_catalog.lower(v_email)='serviotech.sa@gmail.com' THEN
    RAISE EXCEPTION 'Cannot delete owner account' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_user_blocks WHERE user_id=p_user_id AND operation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Account operation in progress' USING ERRCODE='55000';
  END IF;
  PERFORM public.platform_check_user_deletion(p_user_id);
  SELECT p.tenant_id INTO v_tenant_id FROM public.profiles p WHERE p.id=p_user_id AND p.role='admin';
  IF FOUND THEN PERFORM public.platform_assert_other_admin(v_tenant_id,p_user_id); END IF;
  INSERT INTO public.platform_owner_deletion_requests(user_id,actor_id) VALUES(p_user_id,p_actor_id);
  INSERT INTO public.platform_owner_audit(actor_id,target_user_id,action,outcome)
    VALUES(p_actor_id,p_user_id,'delete_user','started');
END;
$$;
REVOKE ALL ON FUNCTION public.platform_prepare_user_deletion(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_prepare_user_deletion(uuid,uuid) TO service_role;

COMMIT;
