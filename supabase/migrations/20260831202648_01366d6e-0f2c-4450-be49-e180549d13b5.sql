-- ============================================================
-- TEKKA POS — Phase 1..6 (single idempotent migration)
-- Adapts to the EXISTING schema. No drops. No data loss.
-- ============================================================

-- ---------- 0. Enums ----------
DO $$ BEGIN
  CREATE TYPE public.pos_role AS ENUM ('store_owner','branch_manager','cashier','inventory_clerk','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 1. Branches ----------
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  allow_negative_stock boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branches_store ON public.branches(store_id);

-- ---------- 2. POS membership ----------
CREATE TABLE IF NOT EXISTS public.pos_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  role public.pos_role NOT NULL DEFAULT 'cashier',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pos_members_user ON public.pos_members(user_id);

-- ---------- 3. Auth helper functions ----------
CREATE OR REPLACE FUNCTION public.pos_is_superadmin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE user_id = _user_id AND active AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.pos_has_store_role(_user_id uuid, _store_id uuid, _roles public.pos_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pos_is_superadmin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.pos_members m
      WHERE m.user_id = _user_id AND m.store_id = _store_id AND m.is_active
        AND m.role = ANY(_roles)
    )
$$;

CREATE OR REPLACE FUNCTION public.pos_can_read_store(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pos_is_superadmin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.pos_members m
      WHERE m.user_id = _user_id AND m.store_id = _store_id AND m.is_active
    )
$$;

-- write = everyone except viewer
CREATE OR REPLACE FUNCTION public.pos_can_write_store(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pos_has_store_role(_user_id, _store_id,
    ARRAY['store_owner','branch_manager','cashier','inventory_clerk']::public.pos_role[])
$$;

CREATE OR REPLACE FUNCTION public.pos_can_manage_store(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pos_has_store_role(_user_id, _store_id,
    ARRAY['store_owner','branch_manager']::public.pos_role[])
$$;

CREATE OR REPLACE FUNCTION public.pos_can_stock_store(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pos_has_store_role(_user_id, _store_id,
    ARRAY['store_owner','branch_manager','inventory_clerk']::public.pos_role[])
$$;

-- ---------- 4. Extend existing product_variants (additive only) ----------
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS cost_price numeric(12,2);
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS unit_label text NOT NULL DEFAULT 'قطعة';
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS min_stock_qty numeric(12,3) NOT NULL DEFAULT 0;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- ---------- 5. Barcodes ----------
CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, barcode)
);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON public.product_barcodes(store_id, barcode);

CREATE TABLE IF NOT EXISTS public.unknown_scan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  barcode text NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scanned_by uuid,
  session_id uuid,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  notes text
);
CREATE INDEX IF NOT EXISTS idx_unknown_scan_store ON public.unknown_scan_items(store_id, resolved);

-- ---------- 6. Customers ----------
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_customers_store ON public.customers(store_id);

-- ---------- 7. Shifts + payment methods ----------
CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  cashier_id uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_amount numeric(12,2) NOT NULL DEFAULT 0,
  closing_amount numeric(12,2),
  expected_amount numeric(12,2),
  difference numeric(12,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','suspended')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_open ON public.cash_shifts(store_id, cashier_id, status);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('cash','card','wallet','credit','other')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (store_id, name)
);

-- ---------- 8. POS invoices ----------
CREATE TABLE IF NOT EXISTS public.pos_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES public.cash_shifts(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  sale_source text NOT NULL DEFAULT 'inplace' CHECK (sale_source IN ('inplace','delivery')),
  delivery_order_id uuid,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  cashier_id uuid NOT NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  change_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','voided','refunded')),
  confirmed_at timestamptz,
  confirmed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_pos_invoices_store_date ON public.pos_invoices(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pos_invoices_shift ON public.pos_invoices(shift_id);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.pos_invoices(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  barcode_scanned text,
  product_name_snapshot text NOT NULL,
  unit_label_snapshot text NOT NULL DEFAULT 'قطعة',
  sell_price_snapshot numeric(12,2) NOT NULL,
  cost_price_snapshot numeric(12,2),
  qty numeric(12,3) NOT NULL CHECK (qty > 0),
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.pos_invoices(id) ON DELETE CASCADE,
  method_id uuid NOT NULL REFERENCES public.payment_methods(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);

CREATE TABLE IF NOT EXISTS public.invoice_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_invoice_id uuid NOT NULL REFERENCES public.pos_invoices(id),
  refund_invoice_id uuid REFERENCES public.pos_invoices(id),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  processed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 9. Credit + loyalty ----------
CREATE TABLE IF NOT EXISTS public.customer_credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  credit_limit numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, store_id)
);

CREATE TABLE IF NOT EXISTS public.customer_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('sale','payment','refund','adjustment')),
  invoice_id uuid REFERENCES public.pos_invoices(id) ON DELETE SET NULL,
  debit numeric(12,2) NOT NULL DEFAULT 0,
  credit numeric(12,2) NOT NULL DEFAULT 0,
  balance_after numeric(12,2) NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON public.customer_ledger_entries(customer_id, created_at);

CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  points_balance int NOT NULL DEFAULT 0,
  lifetime_points int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, store_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id uuid NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.pos_invoices(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earn','redeem','expire','adjust')),
  points int NOT NULL,
  balance_after int NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 10. Suppliers + purchases ----------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  address text,
  tax_number text,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_store ON public.suppliers(store_id);

CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  invoice_number text,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','cancelled')),
  confirmed_at timestamptz,
  confirmed_by uuid,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_store ON public.purchase_invoices(store_id, invoice_date);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id uuid NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id),
  product_name_snapshot text NOT NULL,
  cost_price numeric(12,2) NOT NULL CHECK (cost_price >= 0),
  qty numeric(12,3) NOT NULL CHECK (qty > 0),
  expiry_date date,
  line_total numeric(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_invoice ON public.purchase_items(purchase_invoice_id);

CREATE TABLE IF NOT EXISTS public.supplier_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('purchase','payment','return','adjustment')),
  purchase_invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE SET NULL,
  debit numeric(12,2) NOT NULL DEFAULT 0,
  credit numeric(12,2) NOT NULL DEFAULT 0,
  balance_after numeric(12,2) NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier ON public.supplier_ledger_entries(supplier_id, created_at);

-- ---------- 11. Inventory (POS-scoped, separate from legacy inventory_movements) ----------
CREATE TABLE IF NOT EXISTS public.inventory_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  qty_on_hand numeric(12,3) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_stock_scope
  ON public.inventory_stock(store_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), variant_id);

CREATE TABLE IF NOT EXISTS public.pos_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN (
    'sale','sale_void','purchase','purchase_return','adjustment','damage','expiry','transfer_in','transfer_out'
  )),
  qty_change numeric(12,3) NOT NULL,
  qty_before numeric(12,3) NOT NULL,
  qty_after numeric(12,3) NOT NULL,
  reference_id uuid,
  reference_type text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_inv_mov_variant ON public.pos_inventory_movements(variant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pos_inv_mov_store ON public.pos_inventory_movements(store_id, created_at);

CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('low_stock','out_of_stock','expiry_soon')),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_active ON public.stock_alerts(store_id, is_active);

CREATE TABLE IF NOT EXISTS public.damaged_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id),
  qty numeric(12,3) NOT NULL CHECK (qty > 0),
  reason text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expired_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id),
  qty numeric(12,3) NOT NULL CHECK (qty > 0),
  expiry_date date,
  disposed_at timestamptz NOT NULL DEFAULT now(),
  disposed_by uuid NOT NULL
);

-- ---------- 12. Logs + daily closing ----------
CREATE TABLE IF NOT EXISTS public.pos_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_audit_logs_table ON public.pos_audit_logs(table_name, performed_at);

CREATE TABLE IF NOT EXISTS public.print_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.pos_invoices(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  printed_at timestamptz NOT NULL DEFAULT now(),
  printed_by uuid,
  printer_name text
);

CREATE TABLE IF NOT EXISTS public.daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  closing_date date NOT NULL,
  total_sales numeric(12,2) NOT NULL DEFAULT 0,
  total_refunds numeric(12,2) NOT NULL DEFAULT 0,
  net_sales numeric(12,2) NOT NULL DEFAULT 0,
  total_cash numeric(12,2) NOT NULL DEFAULT 0,
  total_card numeric(12,2) NOT NULL DEFAULT 0,
  invoices_count int NOT NULL DEFAULT 0,
  closed_by uuid NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_closings_scope
  ON public.daily_closings(store_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), closing_date);

-- ---------- 13. updated_at triggers ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['branches','pos_members','inventory_stock','customer_credit_accounts','loyalty_accounts']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_updated_at') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_updated_at', t);
    END IF;
  END LOOP;
END $$;

-- ---------- 14. Immutability of confirmed invoices ----------
CREATE OR REPLACE FUNCTION public.prevent_confirmed_invoice_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('confirmed','refunded') THEN
    RAISE EXCEPTION 'لا يمكن حذف فاتورة مؤكدة';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_confirmed_delete ON public.pos_invoices;
CREATE TRIGGER trg_prevent_confirmed_delete
  BEFORE DELETE ON public.pos_invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_confirmed_invoice_delete();

CREATE OR REPLACE FUNCTION public.prevent_confirmed_invoice_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('tekka.pos_rpc', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'لا يمكن تعديل فاتورة غير مسودة';
  END IF;
  IF NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'تأكيد أو إلغاء الفاتورة يتم عبر الدوال الآمنة فقط';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_confirmed_update ON public.pos_invoices;
CREATE TRIGGER trg_prevent_confirmed_update
  BEFORE UPDATE ON public.pos_invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_confirmed_invoice_update();

CREATE OR REPLACE FUNCTION public.prevent_locked_invoice_items()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status text; v_inv uuid;
BEGIN
  v_inv := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT status INTO v_status FROM public.pos_invoices WHERE id = v_inv;
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'لا يمكن تعديل أصناف فاتورة مؤكدة';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_lock_invoice_items ON public.invoice_items;
CREATE TRIGGER trg_lock_invoice_items
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_invoice_items();

-- ---------- 15. Invoice numbering (per store, atomic) ----------
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_store_id uuid, p_branch_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_scope text;
  v_prefix text := 'POS';
  v_slug text;
  v_date text;
  v_n integer;
BEGIN
  v_date := to_char(now() AT TIME ZONE 'Africa/Cairo', 'YYYYMMDD');
  v_scope := 'pos:' || p_store_id::text || ':' || COALESCE(p_branch_id::text, 'main') || ':' || v_date;

  SELECT slug INTO v_slug FROM public.stores WHERE id = p_store_id;
  IF v_slug IS NOT NULL THEN
    v_prefix := UPPER(SUBSTRING(REGEXP_REPLACE(v_slug, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3));
    IF v_prefix IS NULL OR v_prefix = '' THEN v_prefix := 'POS'; END IF;
  END IF;

  INSERT INTO public.store_order_counters AS c (scope, prefix, last_number)
  VALUES (v_scope, v_prefix, 1)
  ON CONFLICT (scope) DO UPDATE
    SET last_number = c.last_number + 1, updated_at = now()
  RETURNING c.last_number INTO v_n;

  RETURN v_prefix || '-' || v_date || '-' || LPAD(v_n::text, 5, '0');
END;
$$;

-- ---------- 16. Core RPCs ----------

-- 16.1 stock apply helper (internal)
CREATE OR REPLACE FUNCTION public.pos_apply_stock(
  p_store_id uuid, p_branch_id uuid, p_variant_id uuid,
  p_delta numeric, p_type text, p_ref_id uuid, p_ref_type text,
  p_user_id uuid, p_allow_negative boolean, p_notes text DEFAULT NULL
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before numeric(12,3); v_after numeric(12,3); v_row public.inventory_stock%ROWTYPE; v_min numeric(12,3);
BEGIN
  SELECT * INTO v_row FROM public.inventory_stock
   WHERE store_id = p_store_id AND variant_id = p_variant_id
     AND COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(p_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.inventory_stock (store_id, branch_id, variant_id, qty_on_hand)
    VALUES (p_store_id, p_branch_id, p_variant_id, 0)
    RETURNING * INTO v_row;
  END IF;

  v_before := v_row.qty_on_hand;
  v_after := v_before + p_delta;

  IF v_after < 0 AND NOT p_allow_negative THEN
    RAISE EXCEPTION 'المخزون غير كافٍ للصنف (المتاح %)', v_before;
  END IF;

  UPDATE public.inventory_stock SET qty_on_hand = v_after, updated_at = now() WHERE id = v_row.id;

  INSERT INTO public.pos_inventory_movements
    (store_id, branch_id, variant_id, movement_type, qty_change, qty_before, qty_after, reference_id, reference_type, notes, created_by)
  VALUES (p_store_id, p_branch_id, p_variant_id, p_type, p_delta, v_before, v_after, p_ref_id, p_ref_type, p_notes, p_user_id);

  SELECT min_stock_qty INTO v_min FROM public.product_variants WHERE id = p_variant_id;
  IF v_after <= 0 THEN
    INSERT INTO public.stock_alerts (store_id, branch_id, variant_id, alert_type)
    SELECT p_store_id, p_branch_id, p_variant_id, 'out_of_stock'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stock_alerts a WHERE a.variant_id = p_variant_id AND a.store_id = p_store_id
        AND a.is_active AND a.alert_type = 'out_of_stock');
  ELSIF v_min IS NOT NULL AND v_after <= v_min THEN
    INSERT INTO public.stock_alerts (store_id, branch_id, variant_id, alert_type)
    SELECT p_store_id, p_branch_id, p_variant_id, 'low_stock'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stock_alerts a WHERE a.variant_id = p_variant_id AND a.store_id = p_store_id
        AND a.is_active AND a.alert_type = 'low_stock');
  ELSE
    UPDATE public.stock_alerts SET is_active = false, resolved_at = now()
     WHERE variant_id = p_variant_id AND store_id = p_store_id AND is_active
       AND alert_type IN ('low_stock','out_of_stock');
  END IF;

  RETURN v_after;
END;
$$;

-- 16.2 confirm invoice
CREATE OR REPLACE FUNCTION public.rpc_confirm_invoice(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.pos_invoices%ROWTYPE;
  v_item record;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_paid numeric(12,2) := 0;
  v_allow_neg boolean := false;
  v_bal numeric(12,2);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO v_inv FROM public.pos_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  IF NOT public.pos_can_write_store(v_uid, v_inv.store_id) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF v_inv.status <> 'draft' THEN RAISE EXCEPTION 'الفاتورة مش مسودة'; END IF;
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

  FOR v_item IN SELECT variant_id, qty FROM public.invoice_items WHERE invoice_id = p_invoice_id LOOP
    PERFORM public.pos_apply_stock(v_inv.store_id, v_inv.branch_id, v_item.variant_id,
      -v_item.qty, 'sale', p_invoice_id, 'pos_invoice', v_uid, v_allow_neg, NULL);
  END LOOP;

  PERFORM set_config('tekka.pos_rpc', 'on', true);
  UPDATE public.pos_invoices SET
    subtotal = v_subtotal,
    total = v_total,
    paid_amount = v_paid,
    change_amount = GREATEST(v_paid - v_total, 0),
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = v_uid
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
       SET points_balance = points_balance + FLOOR(v_total / 10)::int,
           lifetime_points = lifetime_points + FLOOR(v_total / 10)::int,
           updated_at = now()
     WHERE customer_id = v_inv.customer_id AND store_id = v_inv.store_id;
    INSERT INTO public.loyalty_transactions (loyalty_account_id, invoice_id, transaction_type, points, balance_after)
    SELECT id, p_invoice_id, 'earn', FLOOR(v_total / 10)::int, points_balance
      FROM public.loyalty_accounts WHERE customer_id = v_inv.customer_id AND store_id = v_inv.store_id;
  END IF;

  INSERT INTO public.pos_audit_logs (store_id, table_name, record_id, action, new_data, performed_by)
  VALUES (v_inv.store_id, 'pos_invoices', p_invoice_id, 'UPDATE',
          jsonb_build_object('status','confirmed','total',v_total), v_uid);

  RETURN jsonb_build_object('ok', true, 'invoice_id', p_invoice_id, 'total', v_total, 'paid', v_paid,
                            'change', GREATEST(v_paid - v_total, 0));
END;
$$;

-- 16.3 scan barcode
CREATE OR REPLACE FUNCTION public.rpc_scan_barcode(p_store_id uuid, p_barcode text, p_branch_id uuid DEFAULT NULL, p_session_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); r record; v_qty numeric(12,3);
BEGIN
  IF v_uid IS NULL OR NOT public.pos_can_read_store(v_uid, p_store_id) THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  SELECT b.barcode, v.id AS variant_id, v.product_id, v.price, v.cost_price, v.unit_label, v.size_label,
         p.name AS product_name
    INTO r
    FROM public.product_barcodes b
    JOIN public.product_variants v ON v.id = b.variant_id
    JOIN public.products p ON p.id = v.product_id
   WHERE b.store_id = p_store_id AND b.barcode = trim(p_barcode)
   LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.unknown_scan_items (store_id, branch_id, barcode, scanned_by, session_id)
    VALUES (p_store_id, p_branch_id, trim(p_barcode), v_uid, p_session_id);
    RETURN jsonb_build_object('found', false, 'barcode', trim(p_barcode));
  END IF;

  SELECT qty_on_hand INTO v_qty FROM public.inventory_stock
   WHERE store_id = p_store_id AND variant_id = r.variant_id
     AND COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(p_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN jsonb_build_object(
    'found', true, 'barcode', r.barcode, 'variant_id', r.variant_id, 'product_id', r.product_id,
    'product_name', r.product_name, 'unit_label', COALESCE(r.unit_label, r.size_label, 'قطعة'),
    'sell_price', r.price, 'cost_price', r.cost_price, 'stock', COALESCE(v_qty, 0));
END;
$$;

-- 16.4 void invoice
CREATE OR REPLACE FUNCTION public.rpc_void_invoice(p_invoice_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_inv public.pos_invoices%ROWTYPE; v_item record; v_bal numeric(12,2);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO v_inv FROM public.pos_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  IF NOT public.pos_can_manage_store(v_uid, v_inv.store_id) THEN RAISE EXCEPTION 'غير مصرح — مدير فرع فأعلى'; END IF;
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
$$;

-- 16.5 close shift
CREATE OR REPLACE FUNCTION public.rpc_close_shift(p_shift_id uuid, p_closing_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); s public.cash_shifts%ROWTYPE;
  v_cash numeric(12,2) := 0; v_card numeric(12,2) := 0; v_sales numeric(12,2) := 0;
  v_refunds numeric(12,2) := 0; v_count int := 0; v_expected numeric(12,2); v_date date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO s FROM public.cash_shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الوردية غير موجودة'; END IF;
  IF NOT (s.cashier_id = v_uid OR public.pos_can_manage_store(v_uid, s.store_id)) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
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
$$;

-- 16.6 adjust stock
CREATE OR REPLACE FUNCTION public.rpc_adjust_stock(
  p_store_id uuid, p_branch_id uuid, p_variant_id uuid, p_qty_new numeric, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_cur numeric(12,3) := 0; v_after numeric;
BEGIN
  IF v_uid IS NULL OR NOT public.pos_can_stock_store(v_uid, p_store_id) THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  SELECT qty_on_hand INTO v_cur FROM public.inventory_stock
   WHERE store_id = p_store_id AND variant_id = p_variant_id
     AND COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(p_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_cur := COALESCE(v_cur, 0);

  v_after := public.pos_apply_stock(p_store_id, p_branch_id, p_variant_id, p_qty_new - v_cur,
    'adjustment', NULL, 'manual', v_uid, true, p_reason);

  INSERT INTO public.pos_audit_logs (store_id, table_name, record_id, action, old_data, new_data, performed_by)
  VALUES (p_store_id, 'inventory_stock', p_variant_id, 'UPDATE',
          jsonb_build_object('qty', v_cur), jsonb_build_object('qty', v_after, 'reason', p_reason), v_uid);

  RETURN jsonb_build_object('ok', true, 'qty_before', v_cur, 'qty_after', v_after);
END;
$$;

-- 16.7 confirm purchase
CREATE OR REPLACE FUNCTION public.rpc_confirm_purchase(p_purchase_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); pi public.purchase_invoices%ROWTYPE; it record;
        v_total numeric(12,2) := 0; v_bal numeric(12,2) := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO pi FROM public.purchase_invoices WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'فاتورة الشراء غير موجودة'; END IF;
  IF NOT public.pos_can_stock_store(v_uid, pi.store_id) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF pi.status <> 'draft' THEN RAISE EXCEPTION 'الفاتورة مش مسودة'; END IF;

  SELECT COALESCE(SUM(line_total),0) INTO v_total FROM public.purchase_items WHERE purchase_invoice_id = p_purchase_id;

  FOR it IN SELECT variant_id, qty, cost_price FROM public.purchase_items WHERE purchase_invoice_id = p_purchase_id LOOP
    PERFORM public.pos_apply_stock(pi.store_id, pi.branch_id, it.variant_id, it.qty,
      'purchase', p_purchase_id, 'purchase_invoice', v_uid, true, NULL);
    UPDATE public.product_variants SET cost_price = it.cost_price WHERE id = it.variant_id;
  END LOOP;

  UPDATE public.purchase_invoices
     SET status = 'confirmed', total = v_total, confirmed_at = now(), confirmed_by = v_uid
   WHERE id = p_purchase_id;

  SELECT COALESCE(balance_after,0) INTO v_bal FROM public.supplier_ledger_entries
   WHERE supplier_id = pi.supplier_id ORDER BY created_at DESC LIMIT 1;
  v_bal := COALESCE(v_bal,0) + (v_total - pi.paid_amount);

  INSERT INTO public.supplier_ledger_entries
    (supplier_id, store_id, entry_type, purchase_invoice_id, credit, balance_after, created_by, notes)
  VALUES (pi.supplier_id, pi.store_id, 'purchase', p_purchase_id, v_total - pi.paid_amount, v_bal, v_uid, 'فاتورة شراء');

  RETURN jsonb_build_object('ok', true, 'total', v_total);
END;
$$;

-- 16.8 customer payment
CREATE OR REPLACE FUNCTION public.rpc_customer_payment(p_customer_id uuid, p_amount numeric, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_store uuid; v_bal numeric(12,2);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'المبلغ غير صحيح'; END IF;
  SELECT store_id INTO v_store FROM public.customers WHERE id = p_customer_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  IF NOT public.pos_can_write_store(v_uid, v_store) THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  INSERT INTO public.customer_credit_accounts (customer_id, store_id) VALUES (p_customer_id, v_store)
  ON CONFLICT (customer_id, store_id) DO NOTHING;

  UPDATE public.customer_credit_accounts
     SET current_balance = current_balance - p_amount, updated_at = now()
   WHERE customer_id = p_customer_id AND store_id = v_store
   RETURNING current_balance INTO v_bal;

  INSERT INTO public.customer_ledger_entries
    (customer_id, store_id, entry_type, credit, balance_after, created_by, notes)
  VALUES (p_customer_id, v_store, 'payment', p_amount, v_bal, v_uid, COALESCE(p_notes,'تحصيل نقدي'));

  RETURN jsonb_build_object('ok', true, 'balance', v_bal);
END;
$$;

-- ---------- 17. GRANTS ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches','pos_members','product_barcodes','unknown_scan_items','customers','cash_shifts',
    'payment_methods','pos_invoices','invoice_items','invoice_payments','invoice_refunds',
    'customer_credit_accounts','customer_ledger_entries','loyalty_accounts','loyalty_transactions',
    'suppliers','purchase_invoices','purchase_items','supplier_ledger_entries','inventory_stock',
    'pos_inventory_movements','stock_alerts','damaged_items','expired_items','pos_audit_logs',
    'print_logs','daily_closings']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.pos_apply_stock(uuid,uuid,uuid,numeric,text,uuid,text,uuid,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_scan_barcode(uuid,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_void_invoice(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_close_shift(uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_adjust_stock(uuid,uuid,uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_customer_payment(uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_is_superadmin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_can_read_store(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_can_write_store(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_can_manage_store(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_can_stock_store(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_has_store_role(uuid,uuid,public.pos_role[]) TO authenticated;

-- ---------- 18. RLS POLICIES ----------

-- generic store-scoped tables (store_id column present)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches','product_barcodes','unknown_scan_items','customers','cash_shifts','payment_methods',
    'pos_invoices','invoice_refunds','customer_credit_accounts','customer_ledger_entries',
    'loyalty_accounts','suppliers','purchase_invoices','supplier_ledger_entries','inventory_stock',
    'pos_inventory_movements','stock_alerts','damaged_items','expired_items','print_logs','daily_closings']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
      USING (public.pos_can_read_store(auth.uid(), store_id))$f$, t || '_read', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.pos_can_write_store(auth.uid(), store_id))$f$, t || '_insert', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
      USING (public.pos_can_write_store(auth.uid(), store_id))
      WITH CHECK (public.pos_can_write_store(auth.uid(), store_id))$f$, t || '_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
      USING (public.pos_can_manage_store(auth.uid(), store_id))$f$, t || '_delete', t);
  END LOOP;
END $$;

-- pos_invoices: only draft rows are updatable/deletable directly
DROP POLICY IF EXISTS pos_invoices_update ON public.pos_invoices;
CREATE POLICY pos_invoices_update ON public.pos_invoices FOR UPDATE TO authenticated
  USING (public.pos_can_write_store(auth.uid(), store_id) AND status = 'draft')
  WITH CHECK (public.pos_can_write_store(auth.uid(), store_id));
DROP POLICY IF EXISTS pos_invoices_delete ON public.pos_invoices;
CREATE POLICY pos_invoices_delete ON public.pos_invoices FOR DELETE TO authenticated
  USING (public.pos_can_manage_store(auth.uid(), store_id) AND status = 'draft');

-- pos_members
DROP POLICY IF EXISTS pos_members_read ON public.pos_members;
CREATE POLICY pos_members_read ON public.pos_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.pos_can_manage_store(auth.uid(), store_id));
DROP POLICY IF EXISTS pos_members_write ON public.pos_members;
CREATE POLICY pos_members_write ON public.pos_members FOR ALL TO authenticated
  USING (public.pos_has_store_role(auth.uid(), store_id, ARRAY['store_owner']::public.pos_role[]))
  WITH CHECK (public.pos_has_store_role(auth.uid(), store_id, ARRAY['store_owner']::public.pos_role[]));

-- child tables scoped through parent invoice
DROP POLICY IF EXISTS invoice_items_read ON public.invoice_items;
CREATE POLICY invoice_items_read ON public.invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pos_invoices i WHERE i.id = invoice_id AND public.pos_can_read_store(auth.uid(), i.store_id)));
DROP POLICY IF EXISTS invoice_items_write ON public.invoice_items;
CREATE POLICY invoice_items_write ON public.invoice_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pos_invoices i WHERE i.id = invoice_id AND public.pos_can_write_store(auth.uid(), i.store_id) AND i.status = 'draft'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pos_invoices i WHERE i.id = invoice_id AND public.pos_can_write_store(auth.uid(), i.store_id) AND i.status = 'draft'));

DROP POLICY IF EXISTS invoice_payments_read ON public.invoice_payments;
CREATE POLICY invoice_payments_read ON public.invoice_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pos_invoices i WHERE i.id = invoice_id AND public.pos_can_read_store(auth.uid(), i.store_id)));
DROP POLICY IF EXISTS invoice_payments_write ON public.invoice_payments;
CREATE POLICY invoice_payments_write ON public.invoice_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pos_invoices i WHERE i.id = invoice_id AND public.pos_can_write_store(auth.uid(), i.store_id) AND i.status = 'draft'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pos_invoices i WHERE i.id = invoice_id AND public.pos_can_write_store(auth.uid(), i.store_id) AND i.status = 'draft'));

DROP POLICY IF EXISTS purchase_items_read ON public.purchase_items;
CREATE POLICY purchase_items_read ON public.purchase_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_invoices p WHERE p.id = purchase_invoice_id AND public.pos_can_read_store(auth.uid(), p.store_id)));
DROP POLICY IF EXISTS purchase_items_write ON public.purchase_items;
CREATE POLICY purchase_items_write ON public.purchase_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_invoices p WHERE p.id = purchase_invoice_id AND public.pos_can_stock_store(auth.uid(), p.store_id) AND p.status = 'draft'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_invoices p WHERE p.id = purchase_invoice_id AND public.pos_can_stock_store(auth.uid(), p.store_id) AND p.status = 'draft'));

DROP POLICY IF EXISTS loyalty_transactions_read ON public.loyalty_transactions;
CREATE POLICY loyalty_transactions_read ON public.loyalty_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loyalty_accounts a WHERE a.id = loyalty_account_id AND public.pos_can_read_store(auth.uid(), a.store_id)));

DROP POLICY IF EXISTS pos_audit_logs_read ON public.pos_audit_logs;
CREATE POLICY pos_audit_logs_read ON public.pos_audit_logs FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND public.pos_can_manage_store(auth.uid(), store_id));