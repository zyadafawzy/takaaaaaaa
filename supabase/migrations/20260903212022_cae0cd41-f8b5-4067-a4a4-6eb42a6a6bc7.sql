ALTER TABLE public.pos_invoices
  ADD COLUMN IF NOT EXISTS client_invoice_id text,
  ADD COLUMN IF NOT EXISTS is_offline boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS pos_invoices_store_client_id_uniq
  ON public.pos_invoices (store_id, client_invoice_id)
  WHERE client_invoice_id IS NOT NULL;

ALTER TABLE public.cash_shifts
  ADD COLUMN IF NOT EXISTS client_shift_id text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'online';

CREATE UNIQUE INDEX IF NOT EXISTS cash_shifts_store_client_id_uniq
  ON public.cash_shifts (store_id, client_shift_id)
  WHERE client_shift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_variants_store_updated_idx
  ON public.product_variants (store_id, updated_at);