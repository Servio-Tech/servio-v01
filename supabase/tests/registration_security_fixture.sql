-- Extends subscriptions_fixture.sql, subscription_dates_fixture.sql and
-- legacy_rpc_security_fixture.sql ONLY in a disposable local PostgreSQL cluster.
-- The original project does not contain the initial base-table bootstrap, so
-- these fixtures approximate it. Relevant RLS/column ACLs below reproduce the
-- checked-in migrations; unrelated fixture policies are not production claims.
ALTER TABLE public.cashiers ADD COLUMN created_at timestamptz DEFAULT now();
-- Needed by the actual 220800 migration. This fixture does not test shift RPCs.
ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY fixture_all ON public.store;
DROP POLICY fixture_all ON public.cashiers;
DROP POLICY fixture_profiles_self_select ON public.profiles;
REVOKE ALL ON public.profiles, public.cashiers FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (id,tenant_id,full_name,role,created_at,phone) ON public.profiles TO authenticated;
GRANT SELECT (id,tenant_id,full_name,username,role,branch_id,created_at,is_active) ON public.cashiers TO authenticated;
-- cashier-login uses a service key, not a client role, to bind this column.
GRANT SELECT, UPDATE (auth_user_id) ON public.cashiers TO service_role;
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
CREATE POLICY store_admin_all ON public.store FOR ALL TO authenticated
  USING (public.is_current_tenant_admin() AND public.tenant_match(tenant_id))
  WITH CHECK (public.is_current_tenant_admin() AND public.tenant_match(tenant_id));
CREATE POLICY store_staff_select ON public.store FOR SELECT TO authenticated USING (public.tenant_match(tenant_id));
CREATE POLICY cashiers_admin_select ON public.cashiers FOR SELECT TO authenticated
  USING (public.is_current_tenant_admin() AND public.tenant_match(tenant_id));

-- Model the previously deployed Auth insert trigger, then remove it using the
-- actual 20261104050000 migration before testing any signup.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER sync_profile_settings_after_auth_update AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_settings_from_auth();

-- Preexisting inactive, linked identity: constructed by fixture owner before
-- later lifecycle restrictions, never from attacker-controlled metadata.
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES ('20000000-0000-0000-0000-000000000009','inactive@example.test',now(),
        '{"tenant_id":"00000000-0000-0000-0000-000000000002","role":"cashier"}');
-- The old trigger made a profile; remove it to exercise profileless recovery.
DELETE FROM public.profiles WHERE id='20000000-0000-0000-0000-000000000009';
INSERT INTO public.cashiers(tenant_id,branch_id,auth_user_id,full_name,is_active,username,pin_hash)
SELECT tenant_id,id,'20000000-0000-0000-0000-000000000009','Inactive',false,'inactive','not-used'
FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND slug='main';
