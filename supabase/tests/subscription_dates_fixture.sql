-- Layered on subscriptions_fixture.sql. Disposable approximation, not production.
CREATE ROLE authenticator NOLOGIN;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA storage;
CREATE SCHEMA realtime;
CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
INSERT INTO vault.decrypted_secrets VALUES('servio_notify_webhook_secret','notify-secret');
GRANT USAGE ON SCHEMA auth, public, extensions, storage, realtime, vault TO anon, authenticated, service_role;
ALTER TABLE auth.users ADD COLUMN banned_until timestamptz;
CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id));
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role',true),'') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
ALTER TABLE public.cashiers ADD COLUMN username text, ADD COLUMN pin_hash text, ADD COLUMN role text DEFAULT 'cashier';
UPDATE public.cashiers SET username='cashier',pin_hash=extensions.crypt('1234',extensions.gen_salt('bf'));
CREATE TABLE public.categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,branch_id uuid,name text,printer_name text,separate_print boolean,split_print boolean);
CREATE TABLE public.menu_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,branch_id uuid,created_at timestamptz DEFAULT now(),name text,price numeric,category_id uuid,description text,allergens jsonb,tags jsonb,available boolean,image text,recommendation_item_ids uuid[],addon_options jsonb,free_addon_item_ids uuid[],max_addons integer);
CREATE TABLE public.menu_ingredients(id uuid,tenant_id uuid,branch_id uuid,available boolean);
CREATE TABLE public.menu_item_ingredients(menu_item_id uuid,ingredient_id uuid,tenant_id uuid,branch_id uuid);
CREATE TABLE public."table"(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,branch_id uuid,table_number text);
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,branch_id uuid,items jsonb,total_price numeric,table_number text,notes text,status text,is_completed boolean,created_at timestamptz DEFAULT now(),completed_at timestamptz,tracking_token_hash text);
CREATE TABLE public.waiter_calls(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,branch_id uuid,table_number text,reason text,is_resolved boolean);
CREATE TABLE public.feedbacks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,branch_id uuid,table_number text,rating numeric,tags text[],comment text);
CREATE TABLE public.notification_subscriptions(id uuid PRIMARY KEY,user_id uuid,tenant_id uuid,branch_id uuid,endpoint text,p256dh text,auth text,language text DEFAULT 'ar');
CREATE TABLE public.notification_events(event_type text,event_id uuid,tenant_id uuid,branch_id uuid,created_at timestamptz DEFAULT now(),PRIMARY KEY(event_type,event_id));
CREATE TABLE public.notification_deliveries(event_type text,event_id uuid,subscription_id uuid REFERENCES public.notification_subscriptions(id),status text DEFAULT 'pending',attempted_at timestamptz,PRIMARY KEY(event_type,event_id,subscription_id),FOREIGN KEY(event_type,event_id) REFERENCES public.notification_events(event_type,event_id) ON DELETE CASCADE);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text,owner_id text);
CREATE TABLE realtime.messages(id uuid PRIMARY KEY);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
-- A bucket URL is publicly served by Storage/CDN, but SQL table access isn't
-- granted to anonymous users. This policy models the existing authenticated path.
CREATE POLICY storage_test_read ON storage.objects FOR SELECT TO authenticated USING (true);
CREATE POLICY realtime_test_read ON realtime.messages FOR SELECT TO authenticated USING (true);
GRANT SELECT ON storage.objects TO anon, authenticated;
GRANT SELECT ON realtime.messages TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tenants','profiles','cashiers','store','categories','menu_items','menu_ingredients','menu_item_ingredients','table','orders','waiter_calls','feedbacks','notification_subscriptions','notification_events','notification_deliveries'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  IF t = 'profiles' THEN
   EXECUTE 'CREATE POLICY fixture_profiles_self_select ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid())';
  ELSE
   EXECUTE format('CREATE POLICY fixture_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',t);
  END IF;
 END LOOP;
END $$;
GRANT SELECT ON public.tenants TO anon;
CREATE POLICY fixture_anon ON public.tenants FOR SELECT TO anon USING (true);
CREATE FUNCTION public.staff_probe() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT 'staff-data'::text $$;
REVOKE ALL ON FUNCTION public.staff_probe() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_probe() TO authenticated;
-- Old overload intentionally retained in the fixture to test pre-branch clients.
CREATE FUNCTION public.create_public_waiter_call(p_slug text,p_table_number text,p_reason text)
RETURNS public.waiter_calls LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.waiter_calls; BEGIN
 INSERT INTO public.waiter_calls(tenant_id,table_number,reason) SELECT id,p_table_number,p_reason FROM public.tenants WHERE slug=p_slug RETURNING * INTO r;
 RETURN r; END $$;
REVOKE ALL ON FUNCTION public.create_public_waiter_call(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_waiter_call(text,text,text) TO anon,authenticated;
INSERT INTO public.store(tenant_id,store_name,store_slug) VALUES ('00000000-0000-0000-0000-000000000001','Starter tenant','starter');
INSERT INTO public.categories(id,tenant_id,branch_id,name) SELECT 'c0000000-0000-0000-0000-000000000001',tenant_id,id,'drinks' FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000001';
INSERT INTO public.menu_items(id,tenant_id,branch_id,name,price,category_id,available,image) SELECT 'd0000000-0000-0000-0000-000000000001',tenant_id,id,'coffee',10,'c0000000-0000-0000-0000-000000000001',true,'image' FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000001';
INSERT INTO public."table"(tenant_id,branch_id,table_number) SELECT tenant_id,id,'1' FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000001';
INSERT INTO storage.objects VALUES ('a0000000-0000-0000-0000-000000000001','menu-item-images','00000000-0000-0000-0000-000000000001/main/a.webp',NULL);
INSERT INTO realtime.messages VALUES ('a0000000-0000-0000-0000-000000000002');
INSERT INTO public.profiles(id,tenant_id,full_name,role) VALUES ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','Cashier','cashier');
INSERT INTO public.notification_subscriptions(id,user_id,tenant_id,branch_id,endpoint,p256dh,auth,language)
SELECT 'a0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004',b.tenant_id,b.id,'https://push.example.test/cashier','key','secret','en'
FROM public.branches b WHERE b.tenant_id='00000000-0000-0000-0000-000000000002' AND b.slug='main';

INSERT INTO public.orders(id,tenant_id,branch_id,items,total_price,table_number,status,is_completed)
SELECT 'b0000000-0000-0000-0000-000000000001',b.tenant_id,b.id,'[]'::jsonb,0,'1','pending',false
FROM public.branches b WHERE b.tenant_id='00000000-0000-0000-0000-000000000002' AND b.slug='main';
INSERT INTO public.orders(id,tenant_id,branch_id,items,total_price,table_number,status,is_completed)
SELECT 'b0000000-0000-0000-0000-000000000002',b.tenant_id,b.id,'[]'::jsonb,0,'1','pending',false
FROM public.branches b WHERE b.tenant_id='00000000-0000-0000-0000-000000000002' AND b.slug='main';
