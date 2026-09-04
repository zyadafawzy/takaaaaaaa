-- 1) كتالوج ماكينة الكاشير (عام، مقفول)
CREATE TABLE public.pos_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL UNIQUE,
  name text NOT NULL,
  brand text,
  pack_size text,
  unit_label text NOT NULL DEFAULT 'قطعة',
  default_price numeric(12,2) NOT NULL DEFAULT 0,
  image_url text,
  category_code text,
  source_ref text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pos_catalog_items TO authenticated;
GRANT ALL ON public.pos_catalog_items TO service_role;

ALTER TABLE public.pos_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_items_read_authenticated"
  ON public.pos_catalog_items FOR SELECT TO authenticated USING (true);

CREATE INDEX pos_catalog_items_name_idx ON public.pos_catalog_items USING gin (name gin_trgm_ops);
CREATE INDEX pos_catalog_items_active_idx ON public.pos_catalog_items (active);

-- 2) أسعار الكتالوج لكل متجر (السعر بس — الباركود مش موجود هنا فمستحيل يتغيّر)
CREATE TABLE public.pos_store_catalog_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.pos_catalog_items(id) ON DELETE CASCADE,
  sell_price numeric(12,2) NOT NULL,
  cost_price numeric(12,2),
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_store_catalog_prices TO authenticated;
GRANT ALL ON public.pos_store_catalog_prices TO service_role;

ALTER TABLE public.pos_store_catalog_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_prices_read_store"
  ON public.pos_store_catalog_prices FOR SELECT TO authenticated
  USING (public.pos_can_read_store(auth.uid(), store_id));

CREATE POLICY "catalog_prices_write_store"
  ON public.pos_store_catalog_prices FOR INSERT TO authenticated
  WITH CHECK (public.pos_can_manage_store(auth.uid(), store_id));

CREATE POLICY "catalog_prices_update_store"
  ON public.pos_store_catalog_prices FOR UPDATE TO authenticated
  USING (public.pos_can_manage_store(auth.uid(), store_id))
  WITH CHECK (public.pos_can_manage_store(auth.uid(), store_id));

CREATE POLICY "catalog_prices_delete_store"
  ON public.pos_store_catalog_prices FOR DELETE TO authenticated
  USING (public.pos_can_manage_store(auth.uid(), store_id));

CREATE INDEX pos_store_catalog_prices_store_idx ON public.pos_store_catalog_prices (store_id);

CREATE TRIGGER pos_catalog_items_updated_at
  BEFORE UPDATE ON public.pos_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER pos_store_catalog_prices_updated_at
  BEFORE UPDATE ON public.pos_store_catalog_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) سطر الفاتورة يقدر يشاور على صنف كتالوج الماكينة
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.pos_catalog_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoice_items_catalog_item_idx ON public.invoice_items (catalog_item_id);