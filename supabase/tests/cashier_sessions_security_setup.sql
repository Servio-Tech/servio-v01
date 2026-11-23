-- Fixtures use two tenants and two branches each. IDs stay stable across tests.
INSERT INTO public.tenants(id,slug) VALUES ('00000000-0000-0000-0000-000000000001','tenant-a'),('00000000-0000-0000-0000-000000000002','tenant-b');
INSERT INTO public.tenant_subscriptions SELECT id,now()-interval '1 day',NULL FROM public.tenants;
INSERT INTO public.branches(id,tenant_id) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002');
INSERT INTO auth.users(id) SELECT ('20000000-0000-0000-0000-'||lpad(x::text,12,'0'))::uuid FROM generate_series(1,8) x;
INSERT INTO public.profiles(id,tenant_id,role) VALUES
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','admin'),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','admin'),
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','cashier'),
 ('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','cashier'),
 ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','cashier'),
 ('20000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','cashier'),
 ('20000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','cashier'),
 ('20000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','cashier');
INSERT INTO public.cashiers(id,tenant_id,branch_id,auth_user_id,full_name,username) VALUES
 ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','A1','a1'),
 ('30000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004','A2','a2'),
 ('30000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000005','B1','b1'),
 ('30000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','A3','a3'),
 ('30000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000007','B2','b2'),
 -- Corrupt identity-to-tenant linkage: FKs do not imply matching tenant IDs.
 ('30000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000008','Bad','bad');
INSERT INTO public.cashier_sessions(id,tenant_id,branch_id,cashier_id,auth_user_id) VALUES
 ('40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004'),
 ('40000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000005');
CREATE POLICY cashier_sessions_select ON public.cashier_sessions FOR SELECT TO authenticated
 USING(public.tenant_match(tenant_id) AND (public.is_current_tenant_admin() OR auth_user_id=auth.uid()));
-- Actual old policies; intentionally retain extra permissive write policies too.
CREATE POLICY cashier_sessions_insert ON public.cashier_sessions FOR INSERT TO authenticated
 WITH CHECK(public.tenant_match(tenant_id) AND auth_user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.cashiers c WHERE c.id=cashier_id AND c.auth_user_id=auth.uid() AND c.tenant_id=cashier_sessions.tenant_id AND c.branch_id=cashier_sessions.branch_id AND c.is_active));
CREATE POLICY cashier_sessions_update ON public.cashier_sessions FOR UPDATE TO authenticated
 USING(public.tenant_match(tenant_id) AND (public.is_current_tenant_admin() OR auth_user_id=auth.uid())) WITH CHECK(public.tenant_match(tenant_id));
CREATE POLICY orders_select ON public.orders FOR SELECT TO authenticated USING(public.tenant_match(tenant_id));
-- Models the relevant latest order insertion scope; the complete order-pricing
-- schema/trigger is outside this minimal fixture.
GRANT SELECT ON public.branches TO authenticated;
CREATE POLICY orders_staff_insert ON public.orders FOR INSERT TO authenticated WITH CHECK (
 public.tenant_match(tenant_id) AND EXISTS (SELECT 1 FROM public.branches b WHERE b.id=orders.branch_id AND b.tenant_id=orders.tenant_id AND b.is_active)
 AND (public.is_current_tenant_admin() OR public.is_current_cashier_session(cashier_session_id,tenant_id,branch_id)));
CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated USING(public.tenant_match(tenant_id)) WITH CHECK(public.tenant_match(tenant_id));
-- This totals trigger body is reconstructed from the project's inspected live
-- definition, as documented by legacy_rpc_security_fixture.sql.
CREATE FUNCTION public.sync_cashier_session_totals_from_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP<>'INSERT' THEN PERFORM public.refresh_cashier_session_totals(OLD.cashier_session_id); END IF;
 IF TG_OP<>'DELETE' THEN PERFORM public.refresh_cashier_session_totals(NEW.cashier_session_id); END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER orders_sync_cashier_session_totals AFTER INSERT OR DELETE OR UPDATE OF status,payment_status,payment_method,cash_amount,card_amount,total_price,cashier_session_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_cashier_session_totals_from_order();
CREATE TRIGGER orders_guard_ready_payment_state BEFORE INSERT OR UPDATE OF status,payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_ready_order_payment_state();
CREATE TRIGGER orders_guard_unpaid_completion_state BEFORE INSERT OR UPDATE OF status,payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_unpaid_completion_state();
CREATE TRIGGER platform_guard_open_cashier_shift BEFORE INSERT OR UPDATE OF cashier_id,status ON public.cashier_sessions
FOR EACH ROW EXECUTE FUNCTION public.platform_guard_open_cashier_shift();
CREATE FUNCTION public.create_tenant_for_registration(text,text,text,text,text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END $$;
GRANT EXECUTE ON FUNCTION public.refresh_cashier_session_totals(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.open_cashier_session(numeric), public.close_cashier_session(uuid,numeric,text), public.list_cashier_sessions(integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.open_cashier_session(numeric), public.close_cashier_session(uuid,numeric,text), public.list_cashier_sessions(integer,uuid) TO authenticated;
