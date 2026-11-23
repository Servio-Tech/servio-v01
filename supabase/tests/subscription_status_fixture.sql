-- Additional test-only fixture for the deletion-guard migration and an
-- authenticated cashier whose profile has not yet been provisioned.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE TABLE public.cashier_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id uuid REFERENCES public.cashiers(id), status text NOT NULL
);
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES ('10000000-0000-0000-0000-000000000006','cashier2@example.test',now(),'{}');
INSERT INTO public.cashiers(tenant_id,branch_id,auth_user_id,full_name)
SELECT tenant_id,id,'10000000-0000-0000-0000-000000000006','Profileless cashier'
FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND slug='main';
