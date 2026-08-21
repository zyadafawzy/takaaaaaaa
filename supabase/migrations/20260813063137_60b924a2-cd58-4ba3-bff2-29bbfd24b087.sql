ALTER TABLE public.catalog_import_rows
  ADD COLUMN IF NOT EXISTS match_method text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS confidence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS match_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS needs_visual_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_file_name text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS catalog_import_rows_batch_row_uniq
  ON public.catalog_import_rows (batch_id, row_number);
CREATE INDEX IF NOT EXISTS catalog_import_rows_status_idx
  ON public.catalog_import_rows (batch_id, status);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_url text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_uniq ON public.products (sku) WHERE sku <> '';
CREATE INDEX IF NOT EXISTS storage_asset_index_seq_idx ON public.storage_asset_index (batch_id, sequence_no);