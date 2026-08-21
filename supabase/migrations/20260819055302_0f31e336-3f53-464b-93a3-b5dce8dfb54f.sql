CREATE TABLE public.admin_master_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  owner_email text NOT NULL,
  passphrase_salt text NOT NULL,
  passphrase_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_master_config TO service_role;

ALTER TABLE public.admin_master_config ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER admin_master_config_updated_at
BEFORE UPDATE ON public.admin_master_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.admin_master_config (id, owner_email, passphrase_salt, passphrase_hash)
VALUES (
  true,
  'fzyad387@gmail.com',
  'a7f3c1d9e2b48065',
  encode(digest('a7f3c1d9e2b48065' || 'zizo2024', 'sha256'), 'hex')
)
ON CONFLICT (id) DO NOTHING;