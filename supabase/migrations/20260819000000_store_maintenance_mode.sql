-- Add maintenance mode and plan flags to stores table
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS is_maintenance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS maintenance_message TEXT,
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';

-- Grant permissions
GRANT UPDATE(is_maintenance, maintenance_message, plan_type, features) ON public.stores TO authenticated;
