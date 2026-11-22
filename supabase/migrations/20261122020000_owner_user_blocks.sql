-- Apply only after 20261121130000_tenant_subscriptions_and_branch_limits.sql.
-- This is NOT a complete cross-service revocation mechanism: see the Edge
-- Function's partial-result response and deployment notes before use.
BEGIN;

CREATE TABLE public.platform_user_blocks (
  user_id uuid PRIMARY KEY,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid NOT NULL,
  operation_id uuid,
  operation text CHECK (operation IN ('ban_user', 'unban_user')),
  CHECK ((operation_id IS NULL) = (operation IS NULL))
);
-- Retained after unban: JWTs issued before revocation must never reactivate.
CREATE TABLE public.platform_user_session_fences (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_owner_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  target_user_id uuid,
  target_tenant_id uuid,
  action text NOT NULL CHECK (action IN ('ban_user','unban_user','delete_user','set_subscription')),
  outcome text NOT NULL CHECK (outcome IN ('started','completed','failed','partial'))
);
-- The pending deletion marker has no FK so the audit/control path never cascades
-- into tenant data. It is removed explicitly only after a confirmed outcome.
CREATE TABLE public.platform_owner_deletion_requests (
  user_id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_user_session_fences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_owner_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_owner_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_user_blocks, public.platform_user_session_fences, public.platform_owner_audit,
  public.platform_owner_deletion_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.platform_user_blocks TO service_role;

-- Definer helper is safe for RLS and confirms the account still exists. Thus an
-- already-issued JWT of a deleted user is denied too. No client can read the ledger.
CREATE FUNCTION public.platform_current_user_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
       AND (u.banned_until IS NULL OR u.banned_until <= pg_catalog.now()))
     AND NOT EXISTS (SELECT 1 FROM public.platform_user_blocks b WHERE b.user_id = auth.uid())
     AND (NOT EXISTS (SELECT 1 FROM public.platform_user_session_fences f WHERE f.user_id=auth.uid())
       OR EXISTS (SELECT 1 FROM auth.sessions s WHERE s.user_id=auth.uid()
         AND s.id::text = (auth.jwt()->>'session_id')));
$$;
REVOKE ALL ON FUNCTION public.platform_current_user_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_current_user_allowed() TO authenticated, service_role;

-- Push dispatch is a service/definer path and bypasses RLS. Preserve the
-- subscriptions and delivery history, but skip new claims for blocked users.
-- A push already claimed or sent before the block can still be in flight.
CREATE FUNCTION public.platform_guard_blocked_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status IN ('pending','sending') AND EXISTS (
    SELECT 1 FROM public.notification_subscriptions s
    JOIN auth.users u ON u.id=s.user_id
    WHERE s.id=NEW.subscription_id
      AND ((u.banned_until IS NOT NULL AND u.banned_until > pg_catalog.now())
        OR EXISTS (SELECT 1 FROM public.platform_user_blocks b WHERE b.user_id=s.user_id))
  ) THEN RETURN NULL; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_guard_blocked_push() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER platform_guard_blocked_push
  BEFORE INSERT OR UPDATE OF status ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.platform_guard_blocked_push();

-- A restrictive policy composes with, rather than replaces, existing permissive
-- policies. It applies only to authenticated; ordinary anonymous menus remain.
-- Future tables also need this policy, unless protected by the request guard.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    -- Supabase-managed system tables can be owned by admin roles inaccessible
    -- to the migration runner. This sweep intentionally covers public only.
    WHERE c.relkind IN ('r','p') AND c.relrowsecurity AND n.nspname = 'public'
  LOOP
    EXECUTE pg_catalog.format('DROP POLICY IF EXISTS platform_user_not_blocked ON %I.%I', r.nspname, r.relname);
    EXECUTE pg_catalog.format(
      'CREATE POLICY platform_user_not_blocked ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.platform_current_user_allowed()) WITH CHECK (public.platform_current_user_allowed())',
      r.nspname, r.relname);
  END LOOP;
END $$;

-- PostgREST invokes this before table AND RPC calls, including SECURITY DEFINER
-- functions which bypass table RLS. Reject a pre-existing hook rather than erase it.
CREATE FUNCTION public.platform_block_request_guard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.set_config('request.platform_block_guard_ran', '1', true);
  IF auth.role() = 'authenticated' AND NOT public.platform_current_user_allowed() THEN
    RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_block_request_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_block_request_guard() TO anon, authenticated, service_role;
DO $$
DECLARE setting text;
BEGIN
  FOR setting IN
    SELECT x.value FROM pg_catalog.pg_db_role_setting s
    CROSS JOIN LATERAL pg_catalog.unnest(s.setconfig) AS x(value)
    WHERE s.setrole IN (0, (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticator'))
      AND (s.setdatabase = 0 OR s.setdatabase = (SELECT oid FROM pg_catalog.pg_database WHERE datname = pg_catalog.current_database()))
      AND x.value LIKE 'pgrst.db_pre_request=%'
  LOOP
    IF setting <> 'pgrst.db_pre_request=public.platform_block_request_guard' THEN
      RAISE EXCEPTION 'Existing PostgREST pre-request hook must be composed manually; refusing to overwrite it';
    END IF;
  END LOOP;
END $$;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.platform_block_request_guard';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

-- This checks the hook really ran in the current PostgREST transaction, not just
-- whether the configuration row was written. It does not certify Realtime/Edge.
CREATE FUNCTION public.platform_block_guard_status()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(pg_catalog.current_setting('request.platform_block_guard_ran', true), '') = '1';
$$;
REVOKE ALL ON FUNCTION public.platform_block_guard_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_block_guard_status() TO service_role;

CREATE FUNCTION public.platform_require_owner(p_actor_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_actor_id
    AND pg_catalog.lower(u.email) = 'serviotech.sa@gmail.com' AND u.email_confirmed_at IS NOT NULL
    AND (u.banned_until IS NULL OR u.banned_until <= pg_catalog.now()))
    OR EXISTS (SELECT 1 FROM public.platform_user_blocks b WHERE b.user_id = p_actor_id) THEN
    RAISE EXCEPTION 'Confirmed owner required' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_require_owner(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.platform_owner_audit_event(p_actor_id uuid, p_user_id uuid, p_tenant_id uuid, p_action text, p_outcome text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.platform_require_owner(p_actor_id);
  INSERT INTO public.platform_owner_audit(actor_id, target_user_id, target_tenant_id, action, outcome)
  VALUES (p_actor_id, p_user_id, p_tenant_id, p_action, p_outcome);
END;
$$;
REVOKE ALL ON FUNCTION public.platform_owner_audit_event(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_owner_audit_event(uuid,uuid,uuid,text,text) TO service_role;

-- Starts blocked, locks concurrent operations durably, and revokes all refresh
-- sessions atomically for bans. If the worker dies or Auth returns an ambiguous
-- error the marker remains locked and blocked; operator reconciliation is needed.
CREATE FUNCTION public.platform_begin_block_operation(p_actor_id uuid, p_user_id uuid, p_operation text, p_operation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text;
BEGIN
  PERFORM public.platform_require_owner(p_actor_id);
  IF p_operation NOT IN ('ban_user','unban_user') OR p_operation_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid operation' USING ERRCODE = '22023';
  END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002'; END IF;
  IF p_user_id = p_actor_id OR pg_catalog.lower(v_email) = 'serviotech.sa@gmail.com' THEN
    RAISE EXCEPTION 'Cannot change owner account block' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_owner_deletion_requests d WHERE d.user_id = p_user_id) THEN
    RAISE EXCEPTION 'Deletion operation in progress' USING ERRCODE = '55000';
  END IF;
  INSERT INTO public.platform_user_blocks(user_id, blocked_by, operation_id, operation)
  VALUES (p_user_id, p_actor_id, p_operation_id, p_operation)
  ON CONFLICT (user_id) DO UPDATE SET blocked_by = EXCLUDED.blocked_by,
    operation_id = EXCLUDED.operation_id, operation = EXCLUDED.operation
    WHERE public.platform_user_blocks.operation_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account operation in progress; reconcile manually' USING ERRCODE = '55000'; END IF;
  INSERT INTO public.platform_user_session_fences(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  INSERT INTO public.platform_owner_audit(actor_id,target_user_id,action,outcome)
    VALUES(p_actor_id,p_user_id,p_operation,'started');
END;
$$;
REVOKE ALL ON FUNCTION public.platform_begin_block_operation(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_begin_block_operation(uuid,uuid,text,uuid) TO service_role;

CREATE FUNCTION public.platform_finish_block_operation(p_actor_id uuid, p_user_id uuid, p_operation text, p_operation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.platform_require_owner(p_actor_id);
  IF p_operation = 'unban_user' THEN
    -- Serialize with session creation via the auth.users FK lock, then revoke
    -- any sessions created during an in-flight ban/unban before lifting RLS.
    PERFORM 1 FROM auth.users WHERE id=p_user_id FOR UPDATE;
    DELETE FROM auth.sessions WHERE user_id=p_user_id;
    DELETE FROM public.platform_user_blocks WHERE user_id = p_user_id AND operation = p_operation AND operation_id = p_operation_id;
  ELSIF p_operation = 'ban_user' THEN
    UPDATE public.platform_user_blocks SET operation = NULL, operation_id = NULL
      WHERE user_id = p_user_id AND operation = p_operation AND operation_id = p_operation_id;
  ELSE RAISE EXCEPTION 'Invalid operation' USING ERRCODE = '22023'; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operation mismatch' USING ERRCODE = '55000'; END IF;
  INSERT INTO public.platform_owner_audit(actor_id,target_user_id,action,outcome)
    VALUES(p_actor_id,p_user_id,p_operation,CASE WHEN p_operation='ban_user' THEN 'partial' ELSE 'completed' END);
END;
$$;
REVOKE ALL ON FUNCTION public.platform_finish_block_operation(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_finish_block_operation(uuid,uuid,text,uuid) TO service_role;

-- Only service role invokes this. Aggregate in SQL so PostgREST row caps do not
-- truncate branch totals. An account with no profile retains nullable fields.
CREATE FUNCTION public.platform_owner_user_details(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, blocked boolean, tenant_id uuid, tenant_name text, tenant_slug text,
  role text, plan text, starts_at timestamptz, ends_at timestamptz, branch_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT ids.user_id, (b.user_id IS NOT NULL), p.tenant_id, t.name, t.slug,
    p.role, s.plan, s.starts_at, s.ends_at,
    CASE WHEN p.tenant_id IS NULL THEN NULL ELSE (SELECT count(*) FROM public.branches br WHERE br.tenant_id = p.tenant_id) END
  FROM pg_catalog.unnest(p_user_ids) ids(user_id)
  LEFT JOIN public.platform_user_blocks b ON b.user_id = ids.user_id
  LEFT JOIN public.profiles p ON p.id = ids.user_id
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  LEFT JOIN public.tenant_subscriptions s ON s.tenant_id = p.tenant_id;
$$;
REVOKE ALL ON FUNCTION public.platform_owner_user_details(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_owner_user_details(uuid[]) TO service_role;

CREATE FUNCTION public.platform_prepare_user_deletion(p_actor_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text;
BEGIN
  PERFORM public.platform_require_owner(p_actor_id);
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002'; END IF;
  IF p_actor_id = p_user_id OR pg_catalog.lower(v_email) = 'serviotech.sa@gmail.com' THEN
    RAISE EXCEPTION 'Cannot delete owner account' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_user_blocks WHERE user_id=p_user_id AND operation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Account operation in progress' USING ERRCODE = '55000';
  END IF;
  PERFORM public.platform_check_user_deletion(p_user_id);
  INSERT INTO public.platform_owner_deletion_requests(user_id, actor_id) VALUES(p_user_id,p_actor_id);
  INSERT INTO public.platform_owner_audit(actor_id,target_user_id,action,outcome)
    VALUES(p_actor_id,p_user_id,'delete_user','started');
END;
$$;
REVOKE ALL ON FUNCTION public.platform_prepare_user_deletion(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_prepare_user_deletion(uuid,uuid) TO service_role;

-- The check runs inside the actual Auth DELETE transaction, closing the preflight
-- race. Only the account profile may cascade. Any other application FK, including
-- SET NULL, RESTRICT or CASCADE, blocks deletion rather than losing tenant data.
-- Existing cashier-delete is unaffected unless an owner deletion is pending.
CREATE FUNCTION public.platform_check_user_deletion(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_found boolean;
BEGIN
  -- cashiers.auth_user_id is unique but deliberately has no Auth FK in the
  -- existing schema. FK introspection alone cannot discover this relationship.
  -- Lock writers through this transaction; the Auth trigger rechecks at DELETE.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'User deletion requires READ COMMITTED isolation' USING ERRCODE='0A000';
  END IF;
  LOCK TABLE public.cashiers IN SHARE MODE;
  IF EXISTS (SELECT 1 FROM public.cashiers c WHERE c.auth_user_id=p_user_id) THEN
    RAISE EXCEPTION 'User deletion blocked by linked cashier' USING ERRCODE='23503';
  END IF;
  -- FK inserts into the profile take KEY SHARE. Hold the conflicting row lock
  -- before checking its dependents so a later insert cannot be cascaded or
  -- SET NULL after the check, and a writer already in flight is visible.
  PERFORM 1 FROM public.profiles p WHERE p.id=p_user_id FOR UPDATE;
  FOR r IN
    SELECT c.conrelid::regclass AS relation_id, ns.nspname, tab.relname, c.conkey, c.confkey,
           ref.relname AS referenced_table
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class tab ON tab.oid=c.conrelid
    JOIN pg_catalog.pg_namespace ns ON ns.oid=tab.relnamespace
    JOIN pg_catalog.pg_class ref ON ref.oid=c.confrelid
    WHERE c.contype='f' AND c.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
      AND NOT (c.confrelid='auth.users'::regclass AND ns.nspname='auth')
      AND NOT (c.confrelid='auth.users'::regclass AND c.conrelid='public.profiles'::regclass
               AND c.confdeltype='c' AND c.conkey = ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='id')]::smallint[])
  LOOP
    IF pg_catalog.array_length(r.conkey,1) <> 1 OR pg_catalog.array_length(r.confkey,1) <> 1
      OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = CASE WHEN r.referenced_table='users' THEN 'auth.users'::regclass ELSE 'public.profiles'::regclass END
          AND a.attnum=r.confkey[1] AND a.attname='id') THEN
      RAISE EXCEPTION 'User deletion blocked: unsupported relationship' USING ERRCODE='23503';
    END IF;
    EXECUTE pg_catalog.format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1)',
      r.nspname, r.relname, (SELECT a.attname FROM pg_catalog.pg_attribute a WHERE a.attrelid=r.relation_id AND a.attnum=r.conkey[1]))
      INTO v_found USING p_user_id;
    IF v_found THEN RAISE EXCEPTION 'User deletion blocked by retained application data' USING ERRCODE='23503'; END IF;
  END LOOP;
  -- Some Storage versions use an owner text column without a foreign key.
  -- Lock writers through the enclosing Auth DELETE transaction so a new
  -- unreferenced storage owner cannot appear between this check and deletion.
  IF pg_catalog.to_regclass('storage.objects') IS NOT NULL THEN
    LOCK TABLE storage.objects IN SHARE MODE;
  END IF;
  FOR r IN SELECT a.attname FROM pg_catalog.pg_attribute a
    WHERE a.attrelid=pg_catalog.to_regclass('storage.objects') AND a.attname IN ('owner','owner_id') AND NOT a.attisdropped
  LOOP
    EXECUTE pg_catalog.format('SELECT EXISTS (SELECT 1 FROM storage.objects WHERE %I::text = $1::text)', r.attname)
      INTO v_found USING p_user_id;
    IF v_found THEN RAISE EXCEPTION 'User deletion blocked by retained storage objects' USING ERRCODE='23503'; END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_check_user_deletion(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.platform_guard_owner_user_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid;
BEGIN
  SELECT d.actor_id INTO v_actor FROM public.platform_owner_deletion_requests d WHERE d.user_id = OLD.id;
  IF NOT FOUND THEN RETURN OLD; END IF;
  PERFORM public.platform_require_owner(v_actor);
  IF v_actor = OLD.id OR pg_catalog.lower(OLD.email) = 'serviotech.sa@gmail.com' THEN
    RAISE EXCEPTION 'Cannot delete owner account' USING ERRCODE = '42501';
  END IF;
  PERFORM public.platform_check_user_deletion(OLD.id);
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_guard_owner_user_deletion() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER platform_guard_owner_user_deletion BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.platform_guard_owner_user_deletion();

CREATE FUNCTION public.platform_finish_user_deletion(p_actor_id uuid, p_user_id uuid, p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.platform_require_owner(p_actor_id);
  -- For an ambiguous API error do not call this: leave the marker for reconciliation.
  DELETE FROM public.platform_owner_deletion_requests WHERE user_id=p_user_id AND actor_id=p_actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deletion marker missing' USING ERRCODE='55000'; END IF;
  INSERT INTO public.platform_owner_audit(actor_id,target_user_id,action,outcome)
    VALUES(p_actor_id,p_user_id,'delete_user',CASE WHEN p_success THEN 'completed' ELSE 'failed' END);
END;
$$;
REVOKE ALL ON FUNCTION public.platform_finish_user_deletion(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_finish_user_deletion(uuid,uuid,boolean) TO service_role;

COMMIT;
