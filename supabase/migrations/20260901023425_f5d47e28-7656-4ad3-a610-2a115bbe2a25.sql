-- ========== 1) pos_invoices: hold + حقول مالية ==========
ALTER TABLE public.pos_invoices DROP CONSTRAINT IF EXISTS pos_invoices_status_check;
ALTER TABLE public.pos_invoices ADD CONSTRAINT pos_invoices_status_check
  CHECK (status = ANY (ARRAY['draft'::text,'hold'::text,'confirmed'::text,'voided'::text,'refunded'::text]));

ALTER TABLE public.pos_invoices
  ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_earned int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ========== 2) invoice_items: أصناف مجهولة ==========
ALTER TABLE public.invoice_items ALTER COLUMN variant_id DROP NOT NULL;
ALTER TABLE public.invoice_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS unknown_scan_item_id uuid REFERENCES public.unknown_scan_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_unknown_product boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

-- ========== 3) unknown_scan_items: بيانات الصنف المؤقت ==========
ALTER TABLE public.unknown_scan_items
  ADD COLUMN IF NOT EXISTS temp_name text NOT NULL DEFAULT 'منتج غير مسجل',
  ADD COLUMN IF NOT EXISTS manual_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS qty numeric(12,3) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_label text NOT NULL DEFAULT 'قطعة',
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.pos_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_unknown_scans_store_date
  ON public.unknown_scan_items(store_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_unknown_scans_barcode
  ON public.unknown_scan_items(store_id, barcode) WHERE resolved = false;

-- ========== 4) stock_alerts ==========
ALTER TABLE public.stock_alerts
  ADD COLUMN IF NOT EXISTS current_qty numeric(12,3),
  ADD COLUMN IF NOT EXISTS min_qty numeric(12,3),
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS is_ordered boolean NOT NULL DEFAULT false;

-- ========== 5) الهوالك والمنتهي ==========
ALTER TABLE public.damaged_items
  ADD COLUMN IF NOT EXISTS cost_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS photo_urls text[];
ALTER TABLE public.expired_items
  ADD COLUMN IF NOT EXISTS cost_value numeric(12,2);

-- ========== 6) سجل الطباعة ==========
ALTER TABLE public.print_logs
  ADD COLUMN IF NOT EXISTS paper_size text NOT NULL DEFAULT '80mm';
DROP POLICY IF EXISTS "print_logs_insert_members" ON public.print_logs;
CREATE POLICY "print_logs_insert_members" ON public.print_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.pos_can_read_store(auth.uid(), store_id));

-- ========== 7) صلاحية الخصم ==========
ALTER TABLE public.pos_members
  ADD COLUMN IF NOT EXISTS can_discount boolean NOT NULL DEFAULT true;

-- ========== 8) triggers تسمح بحالة hold ==========
CREATE OR REPLACE FUNCTION public.prevent_confirmed_invoice_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF current_setting('tekka.pos_rpc', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD.status NOT IN ('draft','hold') THEN
    RAISE EXCEPTION 'لا يمكن تعديل فاتورة غير مسودة';
  END IF;
  IF NEW.status NOT IN ('draft','hold') THEN
    RAISE EXCEPTION 'تأكيد أو إلغاء الفاتورة يتم عبر الدوال الآمنة فقط';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_locked_invoice_items()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE v_status text; v_inv uuid;
BEGIN
  v_inv := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT status INTO v_status FROM public.pos_invoices WHERE id = v_inv;
  IF v_status IS NOT NULL AND v_status NOT IN ('draft','hold') THEN
    RAISE EXCEPTION 'لا يمكن تعديل أصناف فاتورة مؤكدة';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_confirmed_invoice_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF OLD.status NOT IN ('draft','hold') THEN
    RAISE EXCEPTION 'لا يمكن حذف فاتورة مؤكدة أو ملغاة';
  END IF;
  RETURN OLD;
END;
$function$;

-- ========== 9) rpc_confirm_invoice: hold + أصناف مجهولة + idempotent ==========
CREATE OR REPLACE FUNCTION public.rpc_confirm_invoice(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.pos_invoices%ROWTYPE;
  v_item record;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_paid numeric(12,2) := 0;
  v_allow_neg boolean := false;
  v_bal numeric(12,2);
  v_points int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO v_inv FROM public.pos_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  IF NOT public.pos_can_write_store(v_uid, v_inv.store_id) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF v_inv.status = 'confirmed' THEN RAISE EXCEPTION 'الفاتورة مؤكدة بالفعل'; END IF;
  IF v_inv.status NOT IN ('draft','hold') THEN RAISE EXCEPTION 'لا يمكن اعتماد فاتورة بحالة %', v_inv.status; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.invoice_items WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'الفاتورة فاضية';
  END IF;

  SELECT COALESCE(SUM(line_total),0) INTO v_subtotal FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  v_total := ROUND(v_subtotal - v_inv.discount_amount + v_inv.tax_amount, 2);
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.invoice_payments WHERE invoice_id = p_invoice_id;

  IF v_inv.branch_id IS NOT NULL THEN
    SELECT allow_negative_stock INTO v_allow_neg FROM public.branches WHERE id = v_inv.branch_id;
  END IF;
  v_allow_neg := COALESCE(v_allow_neg, false);

  FOR v_item IN SELECT variant_id, qty FROM public.invoice_items
                 WHERE invoice_id = p_invoice_id AND variant_id IS NOT NULL LOOP
    PERFORM public.pos_apply_stock(v_inv.store_id, v_inv.branch_id, v_item.variant_id,
      -v_item.qty, 'sale', p_invoice_id, 'pos_invoice', v_uid, v_allow_neg, NULL);
  END LOOP;

  UPDATE public.unknown_scan_items u SET invoice_id = p_invoice_id
   WHERE u.id IN (SELECT unknown_scan_item_id FROM public.invoice_items
                   WHERE invoice_id = p_invoice_id AND unknown_scan_item_id IS NOT NULL);

  v_points := FLOOR(GREATEST(v_total,0) / 10)::int;

  PERFORM set_config('tekka.pos_rpc', 'on', true);
  UPDATE public.pos_invoices SET
    subtotal = v_subtotal,
    total = v_total,
    paid_amount = v_paid,
    change_amount = GREATEST(v_paid - v_total, 0),
    credit_amount = GREATEST(v_total - v_paid, 0),
    loyalty_points_earned = CASE WHEN v_inv.customer_id IS NULL THEN 0 ELSE v_points END,
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = v_uid,
    updated_at = now()
  WHERE id = p_invoice_id;
  PERFORM set_config('tekka.pos_rpc', 'off', true);

  IF v_inv.customer_id IS NOT NULL AND v_paid < v_total THEN
    INSERT INTO public.customer_credit_accounts (customer_id, store_id, current_balance)
    VALUES (v_inv.customer_id, v_inv.store_id, 0)
    ON CONFLICT (customer_id, store_id) DO NOTHING;

    UPDATE public.customer_credit_accounts
       SET current_balance = current_balance + (v_total - v_paid), updated_at = now()
     WHERE customer_id = v_inv.customer_id AND store_id = v_inv.store_id
     RETURNING current_balance INTO v_bal;

    INSERT INTO public.customer_ledger_entries
      (customer_id, store_id, entry_type, invoice_id, debit, balance_after, created_by, notes)
    VALUES (v_inv.customer_id, v_inv.store_id, 'sale', p_invoice_id, v_total - v_paid, v_bal, v_uid, 'بيع آجل');
  END IF;

  IF v_inv.customer_id IS NOT NULL THEN
    INSERT INTO public.loyalty_accounts (customer_id, store_id) VALUES (v_inv.customer_id, v_inv.store_id)
    ON CONFLICT (customer_id, store_id) DO NOTHING;
    UPDATE public.loyalty_accounts
       SET points_balance = points_balance + v_points,
           lifetime_points = lifetime_points + v_points,
           updated_at = now()
     WHERE customer_id = v_inv.customer_id AND store_id = v_inv.store_id;
    INSERT INTO public.loyalty_transactions (loyalty_account_id, invoice_id, transaction_type, points, balance_after)
    SELECT id, p_invoice_id, 'earn', v_points, points_balance
      FROM public.loyalty_accounts WHERE customer_id = v_inv.customer_id AND store_id = v_inv.store_id;
  END IF;

  INSERT INTO public.pos_audit_logs (store_id, table_name, record_id, action, new_data, performed_by)
  VALUES (v_inv.store_id, 'pos_invoices', p_invoice_id, 'UPDATE',
          jsonb_build_object('status','confirmed','total',v_total), v_uid);

  RETURN jsonb_build_object('ok', true, 'invoice_id', p_invoice_id, 'total', v_total, 'paid', v_paid,
                            'change', GREATEST(v_paid - v_total, 0),
                            'credit', GREATEST(v_total - v_paid, 0));
END;
$function$;

-- ========== 10) تعليق واسترجاع الفواتير ==========
CREATE OR REPLACE FUNCTION public.rpc_hold_invoice(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_uid uuid := auth.uid(); v_inv public.pos_invoices%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO v_inv FROM public.pos_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  IF NOT public.pos_can_write_store(v_uid, v_inv.store_id) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF v_inv.status NOT IN ('draft','hold') THEN RAISE EXCEPTION 'لا يمكن تعليق فاتورة بحالة %', v_inv.status; END IF;
  PERFORM set_config('tekka.pos_rpc', 'on', true);
  UPDATE public.pos_invoices SET status = 'hold', updated_at = now() WHERE id = p_invoice_id;
  PERFORM set_config('tekka.pos_rpc', 'off', true);
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_resume_invoice(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_uid uuid := auth.uid(); v_inv public.pos_invoices%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO v_inv FROM public.pos_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  IF NOT public.pos_can_write_store(v_uid, v_inv.store_id) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF v_inv.status <> 'hold' THEN RAISE EXCEPTION 'الفاتورة غير معلّقة'; END IF;
  PERFORM set_config('tekka.pos_rpc', 'on', true);
  UPDATE public.pos_invoices SET status = 'draft', updated_at = now() WHERE id = p_invoice_id;
  PERFORM set_config('tekka.pos_rpc', 'off', true);
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ========== 11) تحويل باركود مجهول لمنتج حقيقي ==========
CREATE OR REPLACE FUNCTION public.rpc_resolve_unknown_barcode(
  p_store_id uuid,
  p_barcode text,
  p_name text,
  p_sell_price numeric,
  p_cost_price numeric DEFAULT NULL,
  p_unit_label text DEFAULT 'قطعة',
  p_category_id uuid DEFAULT NULL,
  p_initial_qty numeric DEFAULT 0,
  p_branch_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_variant uuid;
  v_product uuid;
  v_slug text;
BEGIN
  IF v_uid IS NULL OR NOT public.pos_can_stock_store(v_uid, p_store_id) THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  SELECT v.id INTO v_variant FROM public.product_barcodes b
    JOIN public.product_variants v ON v.id = b.variant_id
   WHERE b.store_id = p_store_id AND b.barcode = trim(p_barcode) LIMIT 1;

  IF v_variant IS NULL THEN
    v_slug := 'pos-' || lower(replace(gen_random_uuid()::text, '-', ''));
    INSERT INTO public.products (name, slug, status, category_id, owner_store_id)
    VALUES (trim(p_name), v_slug, 'published', p_category_id, p_store_id)
    RETURNING id INTO v_product;

    INSERT INTO public.product_variants (product_id, price, cost_price, unit_label, active, min_stock_qty)
    VALUES (v_product, ROUND(p_sell_price,2), p_cost_price, COALESCE(NULLIF(p_unit_label,''),'قطعة'), true, 0)
    RETURNING id INTO v_variant;

    INSERT INTO public.product_barcodes (store_id, variant_id, barcode, is_primary)
    VALUES (p_store_id, v_variant, trim(p_barcode), true)
    ON CONFLICT (store_id, barcode) DO NOTHING;
  END IF;

  IF COALESCE(p_initial_qty,0) > 0 THEN
    PERFORM public.pos_apply_stock(p_store_id, p_branch_id, v_variant, p_initial_qty,
      'adjustment_add', NULL, 'unknown_resolve', v_uid, true, 'تحويل باركود مجهول');
  END IF;

  UPDATE public.unknown_scan_items
     SET resolved = true, resolved_at = now(), resolved_by = v_uid, resolved_variant_id = v_variant
   WHERE store_id = p_store_id AND barcode = trim(p_barcode) AND resolved = false;

  RETURN jsonb_build_object('ok', true, 'variant_id', v_variant);
END;
$function$;

-- ========== 12) تسجيل هالك / منتهي ==========
CREATE OR REPLACE FUNCTION public.rpc_record_damage(
  p_store_id uuid,
  p_variant_id uuid,
  p_qty numeric,
  p_reason text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_kind text DEFAULT 'damage',
  p_expiry_date date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_uid uuid := auth.uid(); v_cost numeric(12,2); v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.pos_can_stock_store(v_uid, p_store_id) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF p_qty <= 0 THEN RAISE EXCEPTION 'الكمية لازم تكون أكبر من صفر'; END IF;
  IF p_kind NOT IN ('damage','expiry') THEN RAISE EXCEPTION 'نوع غير مدعوم'; END IF;

  SELECT ROUND(COALESCE(cost_price,0) * p_qty, 2) INTO v_cost
    FROM public.product_variants WHERE id = p_variant_id;

  PERFORM public.pos_apply_stock(p_store_id, p_branch_id, p_variant_id, -p_qty,
    p_kind, NULL, p_kind, v_uid, true, p_reason);

  IF p_kind = 'damage' THEN
    INSERT INTO public.damaged_items (store_id, branch_id, variant_id, qty, cost_value, reason, recorded_by)
    VALUES (p_store_id, p_branch_id, p_variant_id, p_qty, v_cost, p_reason, v_uid)
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.expired_items (store_id, branch_id, variant_id, qty, cost_value, expiry_date, disposed_by)
    VALUES (p_store_id, p_branch_id, p_variant_id, p_qty, v_cost, p_expiry_date, v_uid)
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'cost_value', v_cost);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_hold_invoice(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_resume_invoice(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_resolve_unknown_barcode(uuid, text, text, numeric, numeric, text, uuid, numeric, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_record_damage(uuid, uuid, numeric, text, uuid, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_hold_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_resume_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_resolve_unknown_barcode(uuid, text, text, numeric, numeric, text, uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_record_damage(uuid, uuid, numeric, text, uuid, text, date) TO authenticated;