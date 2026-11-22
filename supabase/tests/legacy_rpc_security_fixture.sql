-- Extends the existing isolated subscription fixtures; never used against production.
ALTER TABLE public.orders
  ADD COLUMN cashier_session_id uuid,
  ADD COLUMN cashier_id uuid,
  ADD COLUMN payment_status text,
  ADD COLUMN payment_method text,
  ADD COLUMN cash_amount numeric,
  ADD COLUMN card_amount numeric;
CREATE TABLE public.cashier_sessions (
  id uuid PRIMARY KEY, tenant_id uuid, branch_id uuid, cashier_id uuid, auth_user_id uuid,
  status text DEFAULT 'open', opened_at timestamptz DEFAULT now(),
  total_sales numeric DEFAULT 0, cash_sales numeric DEFAULT 0, card_sales numeric DEFAULT 0,
  wallet_sales numeric DEFAULT 0, transfer_sales numeric DEFAULT 0, other_sales numeric DEFAULT 0
);
INSERT INTO public.cashier_sessions(id,tenant_id,branch_id,cashier_id,auth_user_id)
SELECT 'f0000000-0000-0000-0000-000000000001',c.tenant_id,c.branch_id,c.id,c.auth_user_id
FROM public.cashiers c WHERE c.auth_user_id='10000000-0000-0000-0000-000000000004';
INSERT INTO public.cashier_sessions(id,tenant_id,branch_id,cashier_id,auth_user_id,status)
SELECT 'f0000000-0000-0000-0000-000000000002',c.tenant_id,c.branch_id,c.id,c.auth_user_id,'closed'
FROM public.cashiers c WHERE c.auth_user_id='10000000-0000-0000-0000-000000000004';
-- Reconstructed from the read-only live definition: the project migrations do
-- not contain this deployed trigger function. Production owner is postgres.
CREATE FUNCTION public.sync_cashier_session_totals_from_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.refresh_cashier_session_totals(OLD.cashier_session_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.refresh_cashier_session_totals(NEW.cashier_session_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
-- Guard bodies are extracted from the actual migrations by the runner.
CREATE TRIGGER orders_guard_ready_payment_state BEFORE INSERT OR UPDATE OF status,payment_status
ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_ready_order_payment_state();
CREATE TRIGGER orders_guard_unpaid_completion_state BEFORE INSERT OR UPDATE OF status,payment_status
ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_unpaid_completion_state();
CREATE TRIGGER orders_sync_cashier_session_totals
AFTER INSERT OR DELETE OR UPDATE OF status,payment_status,payment_method,cash_amount,card_amount,total_price,cashier_session_id
ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_cashier_session_totals_from_order();
