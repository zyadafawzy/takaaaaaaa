CREATE TABLE IF NOT EXISTS public.store_order_counters (
  scope text PRIMARY KEY,
  prefix text NOT NULL DEFAULT 'TK',
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.store_order_counters TO service_role;

ALTER TABLE public.store_order_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "counters_service_only" ON public.store_order_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.next_order_number(_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text := COALESCE(_store_id::text, 'main');
  v_prefix text := 'TK';
  v_slug text;
  v_n integer;
BEGIN
  IF _store_id IS NOT NULL THEN
    SELECT slug INTO v_slug FROM public.stores WHERE id = _store_id;
    IF v_slug IS NOT NULL THEN
      v_prefix := UPPER(SUBSTRING(REGEXP_REPLACE(v_slug, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3));
      IF v_prefix = '' OR v_prefix IS NULL THEN v_prefix := 'ST'; END IF;
    END IF;
  END IF;

  INSERT INTO public.store_order_counters AS c (scope, prefix, last_number)
  VALUES (v_scope, v_prefix, 1)
  ON CONFLICT (scope) DO UPDATE
    SET last_number = c.last_number + 1, prefix = EXCLUDED.prefix, updated_at = now()
  RETURNING c.last_number INTO v_n;

  RETURN v_prefix || '-' || LPAD(v_n::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_order_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_order_number(uuid) TO service_role;