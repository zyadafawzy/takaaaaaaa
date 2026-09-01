CREATE OR REPLACE FUNCTION public.pos_is_store_owner(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.pos_is_superadmin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.pos_members m
      WHERE m.user_id = _user_id AND m.store_id = _store_id AND m.is_active
        AND m.role = 'store_owner'
    )
$$;

REVOKE ALL ON FUNCTION public.pos_is_store_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_is_store_owner(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_void_invoice(p_invoice_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_inv public.pos_invoices%ROWTYPE; v_item record; v_bal numeric(12,2);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO v_inv FROM public.pos_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  IF NOT public.pos_is_store_owner(v_uid, v_inv.store_id) THEN RAISE EXCEPTION 'غير مصرح — صاحب المتجر فقط'; END IF;
  IF v_inv.status <> 'confirmed' THEN RAISE EXCEPTION 'يمكن إلغاء الفواتير المؤكدة فقط'; END IF;
  IF COALESCE(trim(p_reason),'') = '' THEN RAISE EXCEPTION 'سبب الإلغاء مطلوب'; END IF;

  FOR v_item IN SELECT variant_id, qty FROM public.invoice_items WHERE invoice_id = p_invoice_id LOOP
    PERFORM public.pos_apply_stock(v_inv.store_id, v_inv.branch_id, v_item.variant_id,
      v_item.qty, 'sale_void', p_invoice_id, 'pos_invoice', v_uid, true, p_reason);
  END LOOP;

  PERFORM set_config('tekka.pos_rpc', 'on', true);
  UPDATE public.pos_invoices
     SET status = 'voided', voided_at = now(), voided_by = v_uid, void_reason = p_reason
   WHERE id = p_invoice_id;
  PERFORM set_config('tekka.pos_rpc', 'off', true);

  IF v_inv.customer_id IS NOT NULL AND v_inv.paid_amount < v_inv.total THEN
    UPDATE public.customer_credit_accounts
       SET current_balance = current_balance - (v_inv.total - v_inv.paid_amount), updated_at = now()
     WHERE customer_id = v_inv.customer_id AND store_id = v_inv.store_id
     RETURNING current_balance INTO v_bal;
    INSERT INTO public.customer_ledger_entries
      (customer_id, store_id, entry_type, invoice_id, credit, balance_after, created_by, notes)
    VALUES (v_inv.customer_id, v_inv.store_id, 'refund', p_invoice_id,
            v_inv.total - v_inv.paid_amount, COALESCE(v_bal,0), v_uid, 'إلغاء فاتورة');
  END IF;

  INSERT INTO public.invoice_refunds (original_invoice_id, store_id, amount, reason, processed_by)
  VALUES (p_invoice_id, v_inv.store_id, GREATEST(v_inv.total, 0.01), p_reason, v_uid);

  INSERT INTO public.pos_audit_logs (store_id, table_name, record_id, action, new_data, performed_by)
  VALUES (v_inv.store_id, 'pos_invoices', p_invoice_id, 'UPDATE',
          jsonb_build_object('status','voided','reason',p_reason), v_uid);

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_close_shift(p_shift_id uuid, p_closing_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); s public.cash_shifts%ROWTYPE;
  v_cash numeric(12,2) := 0; v_card numeric(12,2) := 0; v_sales numeric(12,2) := 0;
  v_refunds numeric(12,2) := 0; v_count int := 0; v_expected numeric(12,2); v_date date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO s FROM public.cash_shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الوردية غير موجودة'; END IF;
  IF NOT (s.cashier_id = v_uid OR public.pos_is_store_owner(v_uid, s.store_id)) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF s.status = 'closed' THEN RAISE EXCEPTION 'الوردية مقفولة بالفعل'; END IF;

  SELECT COALESCE(SUM(CASE WHEN pm.type = 'cash' THEN ip.amount ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN pm.type = 'card' THEN ip.amount ELSE 0 END),0)
    INTO v_cash, v_card
    FROM public.invoice_payments ip
    JOIN public.pos_invoices i ON i.id = ip.invoice_id
    JOIN public.payment_methods pm ON pm.id = ip.method_id
   WHERE i.shift_id = p_shift_id AND i.status = 'confirmed';

  SELECT COALESCE(SUM(total),0), COUNT(*) INTO v_sales, v_count
    FROM public.pos_invoices WHERE shift_id = p_shift_id AND status = 'confirmed';
  SELECT COALESCE(SUM(total),0) INTO v_refunds
    FROM public.pos_invoices WHERE shift_id = p_shift_id AND status IN ('voided','refunded');

  v_expected := ROUND(s.opening_amount + v_cash, 2);
  v_date := (s.opened_at AT TIME ZONE 'Africa/Cairo')::date;

  UPDATE public.cash_shifts
     SET status = 'closed', closed_at = now(), closing_amount = p_closing_amount,
         expected_amount = v_expected, difference = ROUND(p_closing_amount - v_expected, 2)
   WHERE id = p_shift_id;

  INSERT INTO public.daily_closings
    (store_id, branch_id, closing_date, total_sales, total_refunds, net_sales, total_cash, total_card, invoices_count, closed_by)
  VALUES (s.store_id, s.branch_id, v_date, v_sales, v_refunds, v_sales - v_refunds, v_cash, v_card, v_count, v_uid)
  ON CONFLICT (store_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), closing_date)
  DO UPDATE SET
    total_sales = public.daily_closings.total_sales + EXCLUDED.total_sales,
    total_refunds = public.daily_closings.total_refunds + EXCLUDED.total_refunds,
    net_sales = public.daily_closings.net_sales + EXCLUDED.net_sales,
    total_cash = public.daily_closings.total_cash + EXCLUDED.total_cash,
    total_card = public.daily_closings.total_card + EXCLUDED.total_card,
    invoices_count = public.daily_closings.invoices_count + EXCLUDED.invoices_count,
    closed_at = now();

  RETURN jsonb_build_object('ok', true, 'expected', v_expected,
    'difference', ROUND(p_closing_amount - v_expected, 2), 'sales', v_sales, 'invoices', v_count);
END;
$function$;