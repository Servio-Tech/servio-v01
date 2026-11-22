\set ON_ERROR_STOP on
-- This file runs twice in rollback-only transactions: first on the vulnerable
-- code, then after the actual migration. No Supabase service or network is used.
SELECT :'phase' IN ('baseline','secured') AS valid_phase, :'phase' = 'secured' AS secured \gset
\if :valid_phase
\else
  \echo 'ERROR: phase must be baseline or secured'
  \quit 1
\endif
\echo Running order payload checks, phase :phase
BEGIN;
SELECT set_config('test.secured', :'secured', true);

CREATE FUNCTION public.order_payload_security_assert(p_ok boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'assertion failed: %', p_message; END IF;
END $$;

-- Exception helpers execute as the caller, assert SQLSTATE AND message, and
-- fail if the call succeeds. A caught error rolls its subtransaction back.
CREATE FUNCTION public.order_payload_security_expect_sql(p_sql text, p_state text, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE got_state text; got_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS got_state = RETURNED_SQLSTATE, got_message = MESSAGE_TEXT;
  END;
  IF got_state IS DISTINCT FROM p_state OR got_message IS DISTINCT FROM p_message THEN
    RAISE EXCEPTION 'expected [%] %, got [%] % for %', p_state, p_message, got_state, got_message, p_sql;
  END IF;
END $$;
CREATE FUNCTION public.order_payload_security_expect_order(p_items jsonb, p_total numeric, p_state text, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE got_state text; got_message text;
BEGIN
  BEGIN
    PERFORM public.create_public_order_with_tracking('alpha', p_items, p_total, '1', NULL, 'main');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS got_state = RETURNED_SQLSTATE, got_message = MESSAGE_TEXT;
  END;
  IF got_state IS DISTINCT FROM p_state OR got_message IS DISTINCT FROM p_message THEN
    RAISE EXCEPTION 'order expected [%] %, got [%] %; payload %', p_state, p_message, got_state, got_message, p_items;
  END IF;
END $$;

CREATE FUNCTION public.order_payload_security_sample() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT '[{"id":"30000000-0000-0000-0000-000000000001","name":"forged coffee","category_id":"forged category","categoryId":"forged fallback","quantity":2,"price":7.25,"cartItemId":"cart-1","description":"large","image":"large","tags":["large"],"allergens":[],"custom_field":"retained","selected_addons":[{"id":"30000000-0000-0000-0000-000000000002","name":"forged milk"},{"id":null,"name":"  حليب  "},{"id":"30000000-0000-0000-0000-000000000003","name":"forged second branch"}]},{"id":"30000000-0000-0000-0000-000000000002","name":"forged second line","category_id":"wrong","quantity":1,"price":2,"selected_addons":[]}]'::jsonb
$$;

-- Permissions must not silently change, including effective PUBLIC inheritance.
DO $$
DECLARE f text;
BEGIN
 FOREACH f IN ARRAY ARRAY[
 'public.create_public_order(text,jsonb,numeric,text,text,text)',
 'public.create_public_order_with_tracking(text,jsonb,numeric,text,text,text)',
 'public.create_public_order_with_tracking(text,jsonb,numeric,text,text)',
 'public.get_public_order_tracking(text,uuid,text)'] LOOP
   PERFORM public.order_payload_security_assert(has_function_privilege('anon',f,'EXECUTE') AND has_function_privilege('authenticated',f,'EXECUTE'), 'API grants retained: ' || f);
 END LOOP;
 PERFORM public.order_payload_security_assert(NOT has_schema_privilege('anon','servio_subscription_private','USAGE') AND NOT has_schema_privilege('authenticated','servio_subscription_private','USAGE'), 'private wrapper schema inaccessible');
 IF current_setting('test.secured')::boolean THEN
   PERFORM public.order_payload_security_assert(NOT has_function_privilege('anon','public.canonicalize_new_order_labels()','EXECUTE') AND NOT has_function_privilege('authenticated','public.canonicalize_new_order_labels()','EXECUTE') AND NOT has_function_privilege('service_role','public.canonicalize_new_order_labels()','EXECUTE'), 'trigger function not callable');
   PERFORM public.order_payload_security_assert(EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.orders'::regclass AND tgname='orders_secure_insert_item_labels' AND tgenabled='O' AND NOT tgisinternal), 'canonicalization trigger enabled');
   PERFORM public.order_payload_security_assert(EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.orders'::regclass AND tgname='orders_secure_update_item_labels' AND tgenabled='O' AND NOT tgisinternal), 'update canonicalization trigger enabled');
 END IF;
END $$;

-- Actual public calls under each database role with matching JWT role. Tracking
-- returns the stored items, so it independently checks the modern RPC's result.
SELECT set_config('request.jwt.claim.role','anon',true), set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ DECLARE r public.orders; t jsonb; tracked jsonb; BEGIN
 r := public.create_public_order('alpha',public.order_payload_security_sample(),16.50,'1','legacy note','main');
 PERFORM public.order_payload_security_assert(r.id IS NOT NULL AND r.total_price=16.50 AND r.notes='legacy note' AND r.status='pending', 'anonymous legacy order');
 INSERT INTO public.test_result VALUES ('anon legacy',jsonb_build_object('id',r.id,'items',r.items));
 t := public.create_public_order_with_tracking('alpha',public.order_payload_security_sample(),16.50,' 1 ','  keep note  ','main');
 PERFORM public.order_payload_security_assert(t->>'order_id' IS NOT NULL AND length(t->>'tracking_token')=64 AND t->>'table_number'='1' AND (t->>'total_price')::numeric=16.50 AND t->>'status'='pending','anonymous tracking response');
 tracked := public.get_public_order_tracking('alpha',(t->>'order_id')::uuid,t->>'tracking_token');
 PERFORM public.order_payload_security_assert(tracked->>'order_id'=t->>'order_id' AND tracked->>'status'='pending' AND (tracked->>'total_price')::numeric=16.50,'valid tracking token');
 PERFORM public.order_payload_security_assert(public.get_public_order_tracking('alpha',(t->>'order_id')::uuid,'wrong-token') IS NULL AND public.get_public_order_tracking('other',(t->>'order_id')::uuid,t->>'tracking_token') IS NULL,'tracking token and tenant isolation');
 INSERT INTO public.test_result VALUES ('anon tracking',jsonb_build_object('id',t->>'order_id','items',tracked->'items','token',t->>'tracking_token'));
 t := public.create_public_order_with_tracking('alpha',public.order_payload_security_sample(),16.50,'1',NULL);
 tracked := public.get_public_order_tracking('alpha',(t->>'order_id')::uuid,t->>'tracking_token');
 PERFORM public.order_payload_security_assert(tracked IS NOT NULL AND tracked->>'table_number'='1', 'anonymous five-argument overload');
 INSERT INTO public.test_result VALUES ('anon tracking five',jsonb_build_object('id',t->>'order_id','items',tracked->'items'));
END $$;
SELECT public.order_payload_security_expect_sql('INSERT INTO public.orders(tenant_id,branch_id,items,total_price) VALUES (''00000000-0000-0000-0000-000000000001'',''20000000-0000-0000-0000-000000000001'', public.order_payload_security_sample(),16.5)', '42501','permission denied for table orders');
SELECT public.order_payload_security_expect_sql('SELECT * FROM public.orders','42501','permission denied for table orders');
SELECT public.order_payload_security_expect_sql('UPDATE public.orders SET notes=''forged''','42501','permission denied for table orders');
SELECT public.order_payload_security_expect_sql('SELECT servio_subscription_private.create_public_order(''alpha'',public.order_payload_security_sample(),16.5,''1'',NULL,''main'')','42501','permission denied for schema servio_subscription_private');
DO $$ BEGIN IF current_setting('test.secured')::boolean THEN
 PERFORM public.order_payload_security_expect_sql('SELECT public.canonicalize_new_order_labels()','42501','permission denied for function canonicalize_new_order_labels');
END IF; END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r public.orders; t jsonb; tracked jsonb; BEGIN
 r:=public.create_public_order('alpha',public.order_payload_security_sample(),16.50,'1','legacy staff','main');
 PERFORM public.order_payload_security_assert(r.id IS NOT NULL AND r.total_price=16.50, 'authenticated legacy order');
 INSERT INTO public.test_result VALUES ('auth legacy',jsonb_build_object('id',r.id,'items',r.items));
 t:=public.create_public_order_with_tracking('alpha',public.order_payload_security_sample(),16.50,'1',' staff note ','main');
 tracked:=public.get_public_order_tracking('alpha',(t->>'order_id')::uuid,t->>'tracking_token');
 PERFORM public.order_payload_security_assert(tracked IS NOT NULL AND (tracked->>'total_price')::numeric=16.50, 'authenticated tracking order');
 INSERT INTO public.test_result VALUES ('auth tracking',jsonb_build_object('id',t->>'order_id','items',tracked->'items'));
 t:=public.create_public_order_with_tracking('alpha',public.order_payload_security_sample(),16.50,'1',NULL);
 tracked:=public.get_public_order_tracking('alpha',(t->>'order_id')::uuid,t->>'tracking_token');
 PERFORM public.order_payload_security_assert(tracked IS NOT NULL AND (tracked->>'total_price')::numeric=16.50, 'authenticated five-argument overload');
 INSERT INTO public.test_result VALUES ('auth tracking five',jsonb_build_object('id',t->>'order_id','items',tracked->'items'));
 INSERT INTO public.orders(tenant_id,branch_id,items,total_price,table_number,notes,payment_status,payment_method,cash_amount,card_amount)
 VALUES ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',public.order_payload_security_sample(),16.50,'1','paid staff','paid','split',6.5,10)
 RETURNING * INTO r;
 PERFORM public.order_payload_security_assert(r.id IS NOT NULL AND r.payment_status='paid' AND r.payment_method='split' AND r.cash_amount=6.5 AND r.card_amount=10 AND r.total_price=16.5 AND r.notes='paid staff','direct staff insert and split payment unchanged');
 INSERT INTO public.test_result VALUES ('staff direct',jsonb_build_object('id',r.id,'items',r.items));
END $$;
SELECT public.order_payload_security_expect_sql('SELECT servio_subscription_private.create_public_order(''alpha'',public.order_payload_security_sample(),16.5,''1'',NULL,''main'')','42501','permission denied for schema servio_subscription_private');
DO $$ BEGIN IF current_setting('test.secured')::boolean THEN
 PERFORM public.order_payload_security_expect_sql('SELECT public.canonicalize_new_order_labels()','42501','permission denied for function canonicalize_new_order_labels');
END IF; END $$;
RESET ROLE;

-- Full JSON comparison: first build the precise expected result of the existing
-- compactors, then modify ONLY the labels expected from the new trigger. It also
-- proves order, quantity, prices, cart IDs, add-on order and other keys survive.
DO $$ DECLARE r record; expected jsonb; raw jsonb:=public.order_payload_security_sample(); secure boolean:=current_setting('test.secured')::boolean; tracking boolean; BEGIN
 FOR r IN SELECT label,result FROM public.test_result ORDER BY label LOOP
   tracking := r.label LIKE '%tracking%';
   expected := CASE WHEN tracking THEN public.compact_public_order_items(raw) ELSE public.compact_order_items_payload(raw) END;
   IF secure THEN
     expected:=jsonb_set(expected,'{0,name}',to_jsonb('قهوة'::text));
     expected:=jsonb_set(expected,'{0,category_id}',to_jsonb('40000000-0000-0000-0000-000000000001'::text));
     expected:=jsonb_set(expected,'{0}',(expected->0)-'categoryId');
     expected:=jsonb_set(expected,'{0,selected_addons,0,name}',to_jsonb('حليب شوفان'::text));
     expected:=jsonb_set(expected,'{0,selected_addons,1,name}',to_jsonb('حليب'::text));
     expected:=jsonb_set(expected,'{0,selected_addons,2,name}',to_jsonb('مكمل فرع آخر'::text));
     expected:=jsonb_set(expected,'{1,name}',to_jsonb('حليب شوفان'::text));
     expected:=jsonb_set(expected,'{1,category_id}',to_jsonb('all'::text));
   ELSE
     -- This is the exploit control, not a catalog or mocked assertion: stored
     -- labels route/display forged values despite valid IDs, price and add-ons.
     PERFORM public.order_payload_security_assert(r.result#>>'{items,0,name}'='forged coffee' AND r.result#>>'{items,0,category_id}'='forged category' AND r.result#>>'{items,0,selected_addons,0,name}'='forged milk', 'baseline exploit reproduced through '||r.label);
     IF NOT tracking THEN PERFORM public.order_payload_security_assert(r.result#>>'{items,0,categoryId}'='forged fallback','baseline fallback alias reproduced'); END IF;
   END IF;
   PERFORM public.order_payload_security_assert(r.result->'items'=expected, 'full stored JSON differs in '||r.label||': got '||(r.result->'items')::text||' expected '||expected::text);
   PERFORM public.order_payload_security_assert(EXISTS(SELECT 1 FROM public.orders o WHERE o.id=(r.result->>'id')::uuid AND o.tenant_id='00000000-0000-0000-0000-000000000001' AND o.branch_id='20000000-0000-0000-0000-000000000001' AND o.total_price=16.50 AND o.items=r.result->'items'), 'real stored row: '||r.label);
 END LOOP;
 PERFORM public.order_payload_security_assert((SELECT count(*) FROM public.test_result)=7,'all seven paths exercised');
 PERFORM public.order_payload_security_assert(EXISTS(SELECT 1 FROM public.orders o JOIN public.test_result tr ON o.id=(tr.result->>'id')::uuid WHERE tr.label='anon tracking' AND o.notes='keep note' AND o.tracking_token_hash=encode(extensions.digest(tr.result->>'token','sha256'),'hex') AND o.tracking_token_hash<>tr.result->>'token'), 'notes normalized, tracking token hashed');
END $$;

-- Staff can edit existing order items in the POS. Reproduce the UPDATE bypass
-- with a valid quantity/total/split payment, then require trusted labels after
-- the migration. This is distinct from updating historical status/payment.
SET LOCAL ROLE authenticated;
DO $$ DECLARE o public.orders; p jsonb; oid uuid; BEGIN
 SELECT (result->>'id')::uuid INTO oid FROM public.test_result WHERE label='staff direct';
 SELECT items INTO p FROM public.orders WHERE id=oid;
 p:=jsonb_set(p,'{0,name}',to_jsonb('update forged name'::text));
 p:=jsonb_set(p,'{0,category_id}',to_jsonb('update forged category'::text));
 p:=jsonb_set(p,'{0,categoryId}',to_jsonb('update forged fallback'::text),true);
 p:=jsonb_set(p,'{0,selected_addons,0,name}',to_jsonb('update forged addon'::text));
 p:=jsonb_set(p,'{0,quantity}','1');
 UPDATE public.orders SET items=p,total_price=9.25,cash_amount=4.25,card_amount=5 WHERE id=oid RETURNING * INTO o;
 PERFORM public.order_payload_security_assert(o.total_price=9.25 AND o.cash_amount=4.25 AND o.card_amount=5 AND o.items#>>'{0,quantity}'='1','legitimate order edit and payment preserved');
 IF current_setting('test.secured')::boolean THEN
   PERFORM public.order_payload_security_assert(o.items#>>'{0,name}'='قهوة' AND o.items#>>'{0,category_id}'='40000000-0000-0000-0000-000000000001' AND NOT (o.items->0 ? 'categoryId') AND o.items#>>'{0,selected_addons,0,name}'='حليب شوفان','staff item UPDATE must not accept forged labels');
 ELSE
   PERFORM public.order_payload_security_assert(o.items#>>'{0,name}'='update forged name' AND o.items#>>'{0,category_id}'='update forged category' AND o.items#>>'{0,selected_addons,0,name}'='update forged addon','baseline staff item UPDATE exploit reproduced');
 END IF;
END $$;
RESET ROLE;

-- Historical snapshots must survive migration and ordinary status/payment
-- updates, including clients that explicitly submit the same items unchanged.
SET LOCAL ROLE authenticated;
UPDATE public.orders SET items=items WHERE id='90000000-0000-0000-0000-000000000001';
SELECT public.order_payload_security_assert((SELECT items='[{"id":"30000000-0000-0000-0000-000000000001","name":"historical label","category_id":"historical category","quantity":1,"price":7.25}]'::jsonb FROM public.orders WHERE id='90000000-0000-0000-0000-000000000001'),'no-op items update may compact old image but must not rewrite snapshot labels');
UPDATE public.orders SET status='ready',payment_status='paid',payment_method='cash',cash_amount=7.25 WHERE id='90000000-0000-0000-0000-000000000001';
DO $$ DECLARE o public.orders; BEGIN
 SELECT * INTO o FROM public.orders WHERE id='90000000-0000-0000-0000-000000000001';
 PERFORM public.order_payload_security_assert(o.items='[{"id":"30000000-0000-0000-0000-000000000001","name":"historical label","category_id":"historical category","quantity":1,"price":7.25}]'::jsonb AND o.status='ready' AND o.payment_status='paid' AND o.cash_amount=7.25, 'historical update retains original snapshot and payment');
END $$;
-- Changed item payloads are checked by the existing validators on UPDATE too.
SELECT public.order_payload_security_expect_sql('UPDATE public.orders SET items=jsonb_set(items,''{0,price}'',''0.01''::jsonb) WHERE id=''90000000-0000-0000-0000-000000000001''','22023','ORDER_ITEM_PRICE_MISMATCH');
SELECT public.order_payload_security_expect_sql('UPDATE public.orders SET items=jsonb_set(items,''{0,selected_addons}'',''[{"name":"unconfigured"}]''::jsonb,true) WHERE id=''90000000-0000-0000-0000-000000000001''','22023','Order contains an add-on not configured for this item');
RESET ROLE;
-- Explicit compatibility trade-off: changing items refreshes the edited
-- payload's labels from the current catalog, but status/no-op updates above do
-- not. The item quantity and the paid amount still work normally.
UPDATE public.menu_items SET name='قهوة جديدة',category_id='new-route' WHERE id='30000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ DECLARE o public.orders; BEGIN
 UPDATE public.orders SET items=jsonb_set(items,'{0,quantity}','2'),total_price=14.50,cash_amount=14.50 WHERE id='90000000-0000-0000-0000-000000000001' RETURNING * INTO o;
 PERFORM public.order_payload_security_assert(o.total_price=14.50 AND o.cash_amount=14.50 AND o.items#>>'{0,quantity}'='2', 'editing historical quantity and payment still works');
 IF current_setting('test.secured')::boolean THEN
   PERFORM public.order_payload_security_assert(o.items#>>'{0,name}'='قهوة جديدة' AND o.items#>>'{0,category_id}'='new-route', 'genuine item edit refreshes current catalog labels');
 ELSE
   PERFORM public.order_payload_security_assert(o.items#>>'{0,name}'='historical label' AND o.items#>>'{0,category_id}'='historical category', 'baseline item edit keeps previous labels');
 END IF;
END $$;
RESET ROLE;
UPDATE public.menu_items SET name='قهوة',category_id='40000000-0000-0000-0000-000000000001' WHERE id='30000000-0000-0000-0000-000000000001';

-- Alias handling on direct/legacy writes (the modern compactor deliberately
-- accepts only id). The configured cross-branch add-on is valid by prior rules.
SET LOCAL ROLE authenticated;
DO $$ DECLARE r public.orders; p jsonb; BEGIN
 p:='[{"menu_item_id":"30000000-0000-0000-0000-000000000001","name":"alias fake","categoryId":"routing fake","quantity":1,"price":7.25,"selected_addons":[{"menu_item_id":"30000000-0000-0000-0000-000000000003","name":"alias fake addon"}]}]';
 INSERT INTO public.orders(tenant_id,branch_id,items,total_price) VALUES ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',p,7.25) RETURNING * INTO r;
 IF current_setting('test.secured')::boolean THEN
   PERFORM public.order_payload_security_assert(r.items#>>'{0,name}'='قهوة' AND r.items#>>'{0,category_id}'='40000000-0000-0000-0000-000000000001' AND NOT (r.items->0 ? 'categoryId') AND r.items#>>'{0,selected_addons,0,name}'='مكمل فرع آخر' AND r.items#>>'{0,selected_addons,0,menu_item_id}'='30000000-0000-0000-0000-000000000003', 'menu_item_id aliases and permitted cross-branch add-on');
 ELSE
   PERFORM public.order_payload_security_assert(r.items=p, 'baseline alias exploit');
 END IF;
END $$;
RESET ROLE;

-- Nullable source names/categories: never retain a forged label if the
-- authoritative label is NULL. This fixture permits NULL, unlike installations
-- which may impose a NOT NULL constraint externally.
UPDATE public.menu_items SET name=NULL,category_id=NULL WHERE id='30000000-0000-0000-0000-000000000002';
SET LOCAL ROLE anon;
DO $$ DECLARE r public.orders; p jsonb; BEGIN
 p:='[{"id":"30000000-0000-0000-0000-000000000001","name":"fake","quantity":1,"price":7.25,"selected_addons":[{"id":"30000000-0000-0000-0000-000000000002","name":"forged null addon"}]},{"id":"30000000-0000-0000-0000-000000000002","name":"forged null item","category_id":"forged","categoryId":"fallback","quantity":1,"price":2}]';
 r:=public.create_public_order('alpha',p,9.25,'1',NULL,'main');
 IF current_setting('test.secured')::boolean THEN
   PERFORM public.order_payload_security_assert(r.items#>'{0,selected_addons,0,name}'='null'::jsonb AND r.items#>'{1,name}'='null'::jsonb AND r.items#>'{1,category_id}'='null'::jsonb AND NOT (r.items->1 ? 'categoryId'), 'NULL authoritative values remove forged labels');
 ELSE
   PERFORM public.order_payload_security_assert(r.items#>>'{0,selected_addons,0,name}'='forged null addon' AND r.items#>>'{1,name}'='forged null item', 'baseline NULL exploit');
 END IF;
END $$;
RESET ROLE;
UPDATE public.menu_items SET name='حليب شوفان',category_id='all' WHERE id='30000000-0000-0000-0000-000000000002';

-- Prepare failures against real availability, tenant and ingredient checks.
INSERT INTO public.menu_items VALUES
 ('30000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','unavailable',3,'all',false,ARRAY[]::text[],ARRAY[]::uuid[],0),
 ('30000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ingredient unavailable',3,'all',true,ARRAY[]::text[],ARRAY[]::uuid[],0);
INSERT INTO public.menu_ingredients VALUES ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',false);
INSERT INTO public.menu_item_ingredients VALUES ('30000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
UPDATE public.menu_items SET free_addon_item_ids=free_addon_item_ids || ARRAY['30000000-0000-0000-0000-000000000004'::uuid,'30000000-0000-0000-0000-000000000006'::uuid,'30000000-0000-0000-0000-000000000007'::uuid] WHERE id='30000000-0000-0000-0000-000000000001';

-- Repeat real negative calls for BOTH client roles. The helper verifies exact
-- error code/message, so an unrelated denial cannot masquerade as a guard.
CREATE FUNCTION public.order_payload_security_negative_cases() RETURNS void LANGUAGE plpgsql AS $$
DECLARE p jsonb := '[{"id":"30000000-0000-0000-0000-000000000001","quantity":1,"price":7.25}]'; a jsonb; BEGIN
 PERFORM public.order_payload_security_expect_order('[]',0,'22023','Order must contain menu items');
 PERFORM public.order_payload_security_expect_order('[42]',7.25,'22023','Order contains an invalid menu item');
 PERFORM public.order_payload_security_expect_order('[{"id":"not-a-uuid","quantity":1,"price":7.25}]',7.25,'22023','Order contains an invalid menu item');
 PERFORM public.order_payload_security_expect_order('[{"id":"30000000-0000-0000-0000-000000000099","quantity":1,"price":7.25}]',7.25,'P0001','MENU_ITEM_UNAVAILABLE');
 PERFORM public.order_payload_security_expect_order('[{"id":"30000000-0000-0000-0000-000000000004","quantity":1,"price":9}]',9,'P0001','MENU_ITEM_UNAVAILABLE');
 PERFORM public.order_payload_security_expect_order('[{"id":"30000000-0000-0000-0000-000000000003","quantity":1,"price":4}]',4,'P0001','MENU_ITEM_NOT_IN_BRANCH_OR_UNAVAILABLE');
 PERFORM public.order_payload_security_expect_order('[{"id":"30000000-0000-0000-0000-000000000006","quantity":1,"price":3}]',3,'P0001','MENU_ITEM_UNAVAILABLE');
 PERFORM public.order_payload_security_expect_order('[{"id":"30000000-0000-0000-0000-000000000007","quantity":1,"price":3}]',3,'P0001','MENU_ITEM_UNAVAILABLE');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,price}','0.01'),0.01,'22023','ORDER_ITEM_PRICE_MISMATCH');
 PERFORM public.order_payload_security_expect_order(p,0.01,'22023','ORDER_TOTAL_MISMATCH');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,quantity}','0'),7.25,'22023','Order quantity must be an integer between 1 and 100');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,quantity}','101'),7.25,'22023','Order quantity must be an integer between 1 and 100');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,quantity}','1.5'),7.25,'22023','Order quantity must be a positive integer');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','null'),7.25,'22023','Order contains invalid add-ons');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','["حليب"]',true),7.25,'22023','Order contains an invalid add-on');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','[{"name":"غير مسموح"}]',true),7.25,'22023','Order contains an add-on not configured for this item');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','[{"id":"not-a-uuid","name":"x"}]',true),7.25,'22023','Order contains an invalid add-on');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','[{"id":"30000000-0000-0000-0000-000000000005","name":"x"}]',true),7.25,'22023','Order contains an add-on not configured for this item');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','[{"id":"30000000-0000-0000-0000-000000000004","name":"x"}]',true),7.25,'P0001','MENU_ITEM_UNAVAILABLE');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','[{"id":"30000000-0000-0000-0000-000000000006","name":"x"}]',true),7.25,'P0001','MENU_ITEM_UNAVAILABLE');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','[{"id":"30000000-0000-0000-0000-000000000007","name":"x"}]',true),7.25,'P0001','MENU_ITEM_UNAVAILABLE');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','[{"name":"حليب"},{"name":" حليب "}]',true),7.25,'22023','Order contains a duplicate add-on');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','[{"id":"30000000-0000-0000-0000-000000000002"},{"id":"30000000-0000-0000-0000-000000000002"}]',true),7.25,'22023','Order contains a duplicate add-on');
 PERFORM public.order_payload_security_expect_order(jsonb_set(p,'{0,selected_addons}','[{"name":"حليب"},{"name":"عسل"},{"name":"حليب"},{"name":"عسل"},{"name":"حليب"}]',true),7.25,'22023','Order exceeds the configured add-on limit');
 PERFORM public.order_payload_security_expect_order('[{"id":"30000000-0000-0000-0000-000000000005","quantity":5,"price":1.23}]',6.15,'22023','ORDER_ITEM_PRICE_MISMATCH');
END $$;
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT public.order_payload_security_negative_cases();
SELECT public.order_payload_security_expect_sql('SELECT public.create_public_order_with_tracking(''alpha'',public.order_payload_security_sample(),16.5,''no-such-table'',NULL,''main'')','22023','Invalid table number for this branch');
DO $$ DECLARE t jsonb; BEGIN
 t:=public.create_public_order_with_tracking('alpha','[{"id":"30000000-0000-0000-0000-000000000005","name":"precision","quantity":5,"price":1.234}]',6.17,'كاشير',NULL,'main');
 PERFORM public.order_payload_security_assert((t->>'total_price')::numeric=6.17 AND t->>'table_number'='كاشير','exact configured price precision and cashier marker work');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.order_payload_security_negative_cases();
SELECT public.order_payload_security_expect_sql('INSERT INTO public.orders(tenant_id,branch_id,items,total_price,payment_status,payment_method,cash_amount,card_amount) VALUES (''00000000-0000-0000-0000-000000000001'',''20000000-0000-0000-0000-000000000001'',public.order_payload_security_sample(),16.5,''paid'',''split'',1,1)','22023','Split payment must equal the order total');
SELECT public.order_payload_security_expect_sql('INSERT INTO public.orders(tenant_id,branch_id,items,total_price,payment_status,payment_method,cash_amount) VALUES (''00000000-0000-0000-0000-000000000001'',''20000000-0000-0000-0000-000000000001'',public.order_payload_security_sample(),16.5,''unpaid'',''cash'',16.5)','22023','Unpaid orders cannot contain payment details');
RESET ROLE;

-- Both public overloads, the legacy RPC and tracking are subscription-gated.
-- Test expired, not-yet-started, and missing subscriptions without bypassing
-- the wrapper via a superuser. Also exercise staff's restrictive RLS policy.
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT public.order_payload_security_expect_sql('SELECT public.create_public_order(''beta'',public.order_payload_security_sample(),16.5,''1'',NULL,''main'')','42501','Service unavailable');
SELECT public.order_payload_security_expect_sql('SELECT public.create_public_order_with_tracking(''beta'',public.order_payload_security_sample(),16.5,''1'',NULL,''main'')','42501','Service unavailable');
SELECT public.order_payload_security_expect_sql('SELECT public.create_public_order_with_tracking(''beta'',public.order_payload_security_sample(),16.5,''1'',NULL)','42501','Service unavailable');
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.order_payload_security_expect_sql('SELECT public.create_public_order(''beta'',public.order_payload_security_sample(),16.5,''1'',NULL,''main'')','42501','Service unavailable');
SELECT public.order_payload_security_expect_sql('SELECT public.create_public_order_with_tracking(''beta'',public.order_payload_security_sample(),16.5,''1'',NULL,''main'')','42501','Service unavailable');
RESET ROLE;
UPDATE public.tenant_subscriptions SET starts_at=now()+interval '1 day' WHERE tenant_id='00000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT public.order_payload_security_expect_sql('SELECT public.create_public_order_with_tracking(''alpha'',public.order_payload_security_sample(),16.5,''1'',NULL,''main'')','42501','Service unavailable');
DO $$ DECLARE t jsonb; BEGIN
 SELECT result INTO t FROM public.test_result WHERE label='anon tracking';
 PERFORM public.order_payload_security_assert(public.get_public_order_tracking('alpha',(t->>'id')::uuid,t->>'token') IS NULL,'tracking hidden when subscription future');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.order_payload_security_expect_sql('SELECT public.create_public_order_with_tracking(''alpha'',public.order_payload_security_sample(),16.5,''1'',NULL,''main'')','42501','Service unavailable');
SELECT public.order_payload_security_expect_sql('INSERT INTO public.orders(tenant_id,branch_id,items,total_price) VALUES (''00000000-0000-0000-0000-000000000001'',''20000000-0000-0000-0000-000000000001'',public.order_payload_security_sample(),16.5)','42501','new row violates row-level security policy "subscription_row_active" for table "orders"');
SELECT public.order_payload_security_assert((SELECT count(*)=0 FROM public.orders),'expired/future staff cannot read orders');
RESET ROLE;
-- now() is transaction-stable: ending exactly now is inactive.
UPDATE public.tenant_subscriptions SET starts_at=now()-interval '1 day',ends_at=now() WHERE tenant_id='00000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT public.order_payload_security_expect_sql('SELECT public.create_public_order_with_tracking(''alpha'',public.order_payload_security_sample(),16.5,''1'',NULL,''main'')','42501','Service unavailable');
RESET ROLE;
DELETE FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT public.order_payload_security_expect_sql('SELECT public.create_public_order_with_tracking(''alpha'',public.order_payload_security_sample(),16.5,''1'',NULL,''main'')','42501','Service unavailable');
RESET ROLE;
-- Starting exactly now is active; prove anonymous and staff paths recover.
INSERT INTO public.tenant_subscriptions VALUES ('00000000-0000-0000-0000-000000000001',now(),now()+interval '1 day');
SET LOCAL ROLE anon;
DO $$ DECLARE t jsonb; BEGIN
 t:=public.create_public_order_with_tracking('alpha','[{"id":"30000000-0000-0000-0000-000000000001","quantity":1,"price":7.25}]',7.25,'1',NULL,'main');
 PERFORM public.order_payload_security_assert(t->>'order_id' IS NOT NULL,'anonymous order resumes at subscription start boundary');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.order_payload_security_assert((SELECT count(*)>0 FROM public.orders),'staff access resumes after renewal');
DO $$ DECLARE t jsonb; BEGIN
 t:=public.create_public_order_with_tracking('alpha','[{"id":"30000000-0000-0000-0000-000000000001","quantity":1,"price":7.25}]',7.25,'1',NULL,'main');
 PERFORM public.order_payload_security_assert(t->>'order_id' IS NOT NULL,'public order resumes after renewal');
END $$;
RESET ROLE;
ROLLBACK;
\echo PASS order payload phase :phase
