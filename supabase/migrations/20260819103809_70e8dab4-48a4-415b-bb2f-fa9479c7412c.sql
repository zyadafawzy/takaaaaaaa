ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS is_maintenance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;