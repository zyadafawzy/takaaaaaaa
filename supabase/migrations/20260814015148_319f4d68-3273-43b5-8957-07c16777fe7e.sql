-- 1) products: visibility + review columns
alter table public.products
  add column if not exists visible boolean not null default false,
  add column if not exists featured boolean not null default false,
  add column if not exists visible_from timestamptz,
  add column if not exists visible_until timestamptz,
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_note text not null default '';

alter table public.product_images
  add column if not exists asset_version integer not null default 1,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists content_type text not null default '';

-- 2) import batch run state
do $$ begin
  create type public.import_run_state as enum ('queued','running','completed','failed','cancelled');
exception when duplicate_object then null; end $$;

alter table public.catalog_import_batches
  add column if not exists run_state public.import_run_state not null default 'queued',
  add column if not exists run_message text not null default '',
  add column if not exists last_progress_at timestamptz,
  add column if not exists index_file_hash text,
  add column if not exists index_rows_count integer not null default 0,
  add column if not exists imported_count integer not null default 0,
  add column if not exists published_count integer not null default 0,
  add column if not exists needs_review_count integer not null default 0,
  add column if not exists report_path text;

-- 3) immutable price history
create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  old_price numeric,
  new_price numeric not null,
  old_compare_at_price numeric,
  new_compare_at_price numeric,
  reason text not null default '',
  actor_user_id uuid,
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

grant select on public.product_price_history to authenticated;
grant all on public.product_price_history to service_role;
alter table public.product_price_history enable row level security;

drop policy if exists "staff reads price history" on public.product_price_history;
create policy "staff reads price history" on public.product_price_history
  for select to authenticated using (public.is_staff(auth.uid()));

-- 4) visibility is part of sellability now
create or replace function public.product_is_sellable(_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.products p
    join public.product_variants v on v.product_id = p.id
    where p.id = _product_id
      and p.status = 'published'
      and p.available
      and p.is_complete
      and p.visible
      and (p.visible_from is null or p.visible_from <= now())
      and (p.visible_until is null or p.visible_until > now())
      and v.active
      and v.price > 0
      and v.stock_quantity is not null
      and (v.stock_quantity > 0 or v.allow_backorder)
  )
$$;

drop policy if exists "public reads sellable products" on public.products;
create policy "public reads sellable products" on public.products
  for select to anon, authenticated
  using (
    status = 'published' and available and is_complete and visible
    and (visible_from is null or visible_from <= now())
    and (visible_until is null or visible_until > now())
    and public.product_is_sellable(id)
  );

-- 5) revert auto-published imported products back to draft/hidden
update public.products p
   set status = 'draft', available = false, visible = false, published_at = null
 where p.status = 'published'
   and exists (select 1 from public.catalog_import_rows r where r.created_product_id = p.id);

update public.product_images i
   set published = false
 where exists (select 1 from public.catalog_import_rows r where r.created_product_id = i.product_id);

insert into public.audit_logs (actor_user_id, actor_email, action, entity_type, entity_id, metadata)
values (null, 'system', 'revert_import_autopublish', 'products', null,
        jsonb_build_object('reason', 'الاستيراد لا ينشر تلقائيًا — كل المنتجات المستوردة رجعت مسودة مخفية'));

-- 6) indexes
create index if not exists products_storefront_idx
  on public.products (status, visible, available, is_complete, name);
create index if not exists products_category_name_idx on public.products (category_id, name);
create index if not exists products_sku_idx on public.products (sku);
create index if not exists product_variants_product_active_idx
  on public.product_variants (product_id, active, sort_order);
create index if not exists product_images_product_idx
  on public.product_images (product_id, published, sort_order);
create index if not exists catalog_import_rows_batch_status_idx
  on public.catalog_import_rows (batch_id, status, row_number);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);

create extension if not exists pg_trgm;
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index if not exists products_search_text_trgm_idx on public.products using gin (search_text gin_trgm_ops);