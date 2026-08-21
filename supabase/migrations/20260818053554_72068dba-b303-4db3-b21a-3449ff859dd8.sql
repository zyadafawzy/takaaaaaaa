ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS offer_until timestamptz;

UPDATE public.products SET is_featured = true WHERE featured = true AND is_featured = false;

CREATE INDEX IF NOT EXISTS products_is_featured_idx ON public.products (is_featured) WHERE is_featured;