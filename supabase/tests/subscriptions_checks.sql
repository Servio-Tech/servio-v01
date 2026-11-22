\set ON_ERROR_STOP on
CREATE FUNCTION pg_temp.assert_true(p_ok boolean, p_message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', p_message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(p_sql text, p_code text, p_message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_code text; actual_message text;
BEGIN
  BEGIN EXECUTE p_sql; EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_code = RETURNED_SQLSTATE, actual_message = MESSAGE_TEXT;
    IF actual_code <> p_code OR position(p_message IN actual_message) = 0 THEN
      RAISE EXCEPTION 'Wrong error: % %, expected % / %', actual_code, actual_message, p_code, p_message;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected error % for %', p_code, p_sql;
END $$;
SELECT pg_temp.assert_true((SELECT plan='starter' FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'legacy starter');
SELECT pg_temp.assert_true((SELECT plan='pro' FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000002'), 'legacy pro');
SELECT pg_temp.assert_true((SELECT plan='pro' FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000003'), 'legacy >3 pro');
SELECT pg_temp.assert_true((SELECT count(*)=4 FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000003'), 'legacy >3 preserved');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000004' AND slug='main'), 'repair branchless tenant');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000005' AND slug='other'), 'no extra branch');
SELECT pg_temp.assert_true(public.resolve_branch_id('starter', 'main') IS NOT NULL AND public.resolve_branch_id('alternative', NULL) IS NOT NULL, 'public menu branch resolution');
SELECT pg_temp.expect_error($q$INSERT INTO public.tenants(name,slug) VALUES ('Reserved','owner-console')$q$, '23514', 'tenants_owner_console_slug_reserved');
SELECT pg_temp.expect_error($q$UPDATE public.tenants SET slug='OWNER-CONSOLE' WHERE id='00000000-0000-0000-0000-000000000001'$q$, '23514', 'tenants_owner_console_slug_reserved');
UPDATE public.branches SET name='Renamed' WHERE tenant_id='00000000-0000-0000-0000-000000000003' AND slug='fourth';
SELECT pg_temp.expect_error($q$INSERT INTO public.branches(tenant_id,name,slug) VALUES ('00000000-0000-0000-0000-000000000003','Fifth','fifth')$q$, '23514', 'Branch limit reached');
SELECT pg_temp.expect_error($q$UPDATE public.branches SET tenant_id='00000000-0000-0000-0000-000000000001' WHERE tenant_id='00000000-0000-0000-0000-000000000005'$q$, '23514', 'Branch limit reached');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
SELECT pg_temp.assert_true((SELECT count(*)=1 AND min(plan)='starter' FROM public.tenant_subscriptions), 'RLS permits only member tenant');
SELECT pg_temp.expect_error($q$INSERT INTO public.branches(tenant_id,name,slug,is_active) VALUES ('00000000-0000-0000-0000-000000000001','Two','two',false)$q$, '23514', 'Branch limit reached');
SELECT pg_temp.expect_error($q$UPDATE public.tenant_subscriptions SET plan='pro'$q$, '42501', 'permission denied');
SELECT pg_temp.expect_error($q$INSERT INTO public.tenant_subscriptions(tenant_id,plan) VALUES ('00000000-0000-0000-0000-000000000001','pro')$q$, '42501', 'permission denied');
SELECT pg_temp.expect_error($q$DELETE FROM public.tenant_subscriptions$q$, '42501', 'permission denied');
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','pro',now(),null)$q$, '42501', 'Confirmed platform owner');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.expect_error($q$SELECT * FROM public.tenant_subscriptions$q$, '42501', 'permission denied');
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','pro',now(),null)$q$, '42501', 'permission denied');
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.expect_error($q$UPDATE public.tenant_subscriptions SET plan='pro'$q$, '42501', 'permission denied');
RESET ROLE;

-- No linked cashier: forged tenant/role metadata cannot claim an existing tenant.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
SELECT set_config('request.jwt.claim.email','serviotech.sa@gmail.com',false);
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','pro',now(),null)$q$, '42501', 'Confirmed platform owner');
SELECT pg_temp.expect_error($q$SELECT public.ensure_profile_for_current_user()$q$, '22023', 'Tenant name is required');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
SELECT pg_temp.assert_true((SELECT (public.ensure_profile_for_current_user()).role='cashier'), 'linked cashier role');
SELECT pg_temp.assert_true((SELECT (public.ensure_profile_for_current_user()).tenant_id='00000000-0000-0000-0000-000000000002'), 'linked cashier tenant from server');
SELECT pg_temp.assert_true((SELECT count(*)=1 AND min(plan)='pro' FROM public.tenant_subscriptions), 'cashier reads own subscription');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',false);
SELECT pg_temp.assert_true((SELECT (public.ensure_profile_for_current_user()).role='admin'), 'new registration is admin');
SELECT pg_temp.assert_true((SELECT (public.ensure_profile_for_current_user()).tenant_id <> '00000000-0000-0000-0000-000000000001'), 'new registration ignores forged tenant');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.branches b JOIN public.tenants t ON t.id=b.tenant_id WHERE t.slug='new-restaurant' AND b.slug='main'), 'registration creates exactly one main');
SELECT pg_temp.assert_true(public.resolve_branch_id('new-restaurant', 'main') IS NOT NULL, 'new public menu route');
SELECT pg_temp.assert_true((SELECT s.plan='starter' FROM public.tenant_subscriptions s JOIN public.tenants t ON t.id=s.tenant_id WHERE t.slug='new-restaurant'), 'new registration starter');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000002','pro',null,null)$q$, '22023', 'Invalid subscription dates');
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000002','pro',now(),now())$q$, '22023', 'Invalid subscription dates');
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000002','free',now(),null)$q$, '22023', 'Plan must be');
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000002','starter',now(),null)$q$, '23514', 'Cannot downgrade to starter');
SELECT (public.owner_set_subscription('00000000-0000-0000-0000-000000000001','pro','2026-01-01','2026-12-31')).plan;
SELECT (public.owner_set_subscription('00000000-0000-0000-0000-000000000004','pro','2000-01-01','2000-02-01')).plan;
SELECT (public.owner_set_subscription('00000000-0000-0000-0000-000000000004','starter','2000-01-01','2000-02-01')).plan;
SELECT (public.owner_set_subscription('00000000-0000-0000-0000-000000000004','pro','2000-01-01','2000-02-01')).plan;
RESET ROLE;
INSERT INTO public.branches(tenant_id,name,slug) VALUES ('00000000-0000-0000-0000-000000000004','Expired dates do not enforce','second');
SELECT pg_temp.assert_true((SELECT plan='pro' AND ends_at < now() FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000004'), 'dates are recorded, not enforced');
SELECT pg_temp.assert_true((SELECT plan='pro' FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000002'), 'failed downgrade is rolled back');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000002'), 'failed downgrade preserves branches');
INSERT INTO public.branches(tenant_id,name,slug,is_active) VALUES ('00000000-0000-0000-0000-000000000002','Third','third',false);
SELECT pg_temp.expect_error($q$INSERT INTO public.branches(tenant_id,name,slug) VALUES ('00000000-0000-0000-0000-000000000002','Fourth','fourth')$q$, '23514', 'Branch limit reached');
UPDATE auth.users SET email_confirmed_at=NULL WHERE id='10000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter',now(),null)$q$, '42501', 'Confirmed platform owner');
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=now() WHERE id='10000000-0000-0000-0000-000000000002';
UPDATE public.cashiers SET is_active=false WHERE auth_user_id='10000000-0000-0000-0000-000000000004';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.tenant_subscriptions), 'inactive cashier cannot read subscription');
RESET ROLE;
SELECT 'functional checks passed' AS result;
