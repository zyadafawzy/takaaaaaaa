CREATE TABLE IF NOT EXISTS public.search_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_term TEXT NOT NULL,
    normalized_term TEXT NOT NULL,
    sku TEXT NOT NULL,
    match_type TEXT NOT NULL,
    weight DOUBLE PRECISION DEFAULT 1.0,
    locale TEXT DEFAULT 'ar-EG',
    source TEXT DEFAULT 'catalog_name',
    review_status TEXT DEFAULT 'verified_from_catalog',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sku, normalized_term, match_type)
);

CREATE INDEX IF NOT EXISTS idx_search_aliases_normalized_term ON public.search_aliases(normalized_term);
CREATE INDEX IF NOT EXISTS idx_search_aliases_sku ON public.search_aliases(sku);

CREATE TABLE IF NOT EXISTS public.search_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_original TEXT NOT NULL,
    query_normalized_term TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    clicked_sku TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_aliases TO authenticated;
GRANT SELECT ON public.search_aliases TO anon;
GRANT ALL ON public.search_aliases TO service_role;

GRANT SELECT, INSERT ON public.search_events TO authenticated;
GRANT INSERT ON public.search_events TO anon;
GRANT ALL ON public.search_events TO service_role;

ALTER TABLE public.search_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for aliases" ON public.search_aliases FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert for events" ON public.search_events FOR INSERT TO anon, authenticated WITH CHECK (true);