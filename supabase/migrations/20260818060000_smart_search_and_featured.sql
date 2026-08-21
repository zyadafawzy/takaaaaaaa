-- Enable pg_trgm if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add featured flags and offer timing to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS featured_until timestamptz,
ADD COLUMN IF NOT EXISTS offer_until timestamptz;

-- Create a robust search_text column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.products'::regclass AND attname = 'search_text') THEN
        ALTER TABLE public.products ADD COLUMN search_text text;
    END IF;
END
$$;

-- Update search_text for existing products
UPDATE public.products 
SET search_text = lower(name || ' ' || coalesce(description, '') || ' ' || sku);

-- Create a GIN trigram index for fast similarity and ilike search
CREATE INDEX IF NOT EXISTS products_search_trgm_idx ON public.products USING gin (search_text gin_trgm_ops);

-- Index for featured products
CREATE INDEX IF NOT EXISTS products_is_featured_idx ON public.products(is_featured) WHERE is_featured = true;
