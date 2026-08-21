-- =========================================================
-- تِكّة | أساس قاعدة البيانات الحقيقي (كتالوج فارغ عمدًا)
-- =========================================================

-- ---------- Enums ----------
create type public.app_role as enum ('super_admin','store_manager','inventory_operator','order_operator','ceo_viewer');
create type public.product_status as enum ('draft','published','archived');
create type public.sell_unit as enum ('piece','kg','pack','bundle','liter');
create type public.order_status as enum ('new','awaiting_whatsapp','needs_call','preparing','out_for_delivery','delivered','cancelled');
create type public.fulfillment_method as enum ('delivery','pickup');
create type public.payment_method as enum ('cod');
create type public.substitution_policy as enum ('substitute','call_me','remove');
create type public.import_batch_status as enum ('open','files_uploaded','awaiting_index_file','ready_for_scan','scanned','imported','failed','cancelled');
create type public.asset_scan_status as enum ('pending','ok','rejected','duplicate');
create type public.import_source_kind as enum ('images','index_file','mixed');

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- الموظفون والأدوار
-- =========================================================
create table public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text not null,
  full_name text not null default '',
  role public.app_role not null default 'ceo_viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index admin_profiles_role_idx on public.admin_profiles(role) where active;

grant select on public.admin_profiles to authenticated;
grant all on public.admin_profiles to service_role;
alter table public.admin_profiles enable row level security;

create trigger admin_profiles_updated_at before update on public.admin_profiles
for each row execute function public.set_updated_at();

-- دوال أمان (security definer) لتجنّب التكرار في RLS
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = _user_id and role = _role and active
  )
$$;

create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = _user_id and active and role = any(_roles)
  )
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_profiles where user_id = _user_id and active)
$$;

create policy "staff read own profile" on public.admin_profiles
for select to authenticated using (user_id = auth.uid());
create policy "super admin reads all profiles" on public.admin_profiles
for select to authenticated using (public.has_role(auth.uid(),'super_admin'));
create policy "super admin manages profiles" on public.admin_profiles
for all to authenticated
using (public.has_role(auth.uid(),'super_admin'))
with check (public.has_role(auth.uid(),'super_admin'));

-- =========================================================
-- سجل التدقيق
-- =========================================================
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "super admin reads audit" on public.audit_logs
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','ceo_viewer']::public.app_role[]));

-- =========================================================
-- الكتالوج
-- =========================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  icon text not null default 'basket',
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_slug_ascii check (slug ~ '^[a-z0-9-]+$')
);
create index categories_published_idx on public.categories(published, sort_order);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();

create policy "public reads published categories" on public.categories
for select to anon, authenticated using (published);
create policy "catalog staff reads categories" on public.categories
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator','order_operator','ceo_viewer']::public.app_role[]));
create policy "catalog staff writes categories" on public.categories
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_slug_ascii check (slug ~ '^[a-z0-9-]+$')
);
grant select on public.brands to anon, authenticated;
grant all on public.brands to service_role;
alter table public.brands enable row level security;
create trigger brands_updated_at before update on public.brands for each row execute function public.set_updated_at();
create policy "public reads brands" on public.brands for select to anon, authenticated using (published);
create policy "catalog staff writes brands" on public.brands
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sku text not null unique,
  name text not null,
  description text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  unit public.sell_unit not null default 'piece',
  is_fresh boolean not null default false,
  status public.product_status not null default 'draft',
  available boolean not null default false,
  is_complete boolean not null default false,
  published_at timestamptz,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_ascii check (slug ~ '^[a-z0-9-]+$'),
  constraint products_name_not_blank check (length(btrim(name)) > 0)
);
create index products_status_idx on public.products(status, available);
create index products_category_idx on public.products(category_id);
create index products_search_idx on public.products using gin (to_tsvector('simple', search_text));
grant select on public.products to anon, authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

create policy "staff reads all products" on public.products
for select to authenticated using (public.is_staff(auth.uid()));
create policy "catalog staff writes products" on public.products
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size_label text not null default '',
  price numeric(10,2) not null,
  compare_at_price numeric(10,2),
  stock_quantity integer not null default 0,
  allow_backorder boolean not null default false,
  low_stock_threshold integer not null default 3,
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variant_price_positive check (price > 0),
  constraint variant_compare_gt check (compare_at_price is null or compare_at_price > price),
  constraint variant_stock_nonneg check (stock_quantity >= 0)
);
create index product_variants_product_idx on public.product_variants(product_id, sort_order);
grant select on public.product_variants to anon, authenticated;
grant all on public.product_variants to service_role;
alter table public.product_variants enable row level security;
create trigger product_variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();

-- المنتج ظاهر للعامة فقط إذا: منشور + متاح + مكتمل + له variant فعّال بسعر ومخزون صريح
create or replace function public.product_is_sellable(_product_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.products p
    join public.product_variants v on v.product_id = p.id
    where p.id = _product_id
      and p.status = 'published'
      and p.available
      and p.is_complete
      and v.active
      and v.price > 0
      and v.stock_quantity is not null
      and (v.stock_quantity > 0 or v.allow_backorder)
  )
$$;

create policy "public reads sellable products" on public.products
for select to anon, authenticated
using (status = 'published' and available and is_complete and public.product_is_sellable(id));

create policy "public reads active variants of sellable products" on public.product_variants
for select to anon, authenticated
using (active and price > 0 and public.product_is_sellable(product_id));
create policy "staff reads variants" on public.product_variants
for select to authenticated using (public.is_staff(auth.uid()));
create policy "catalog staff writes variants" on public.product_variants
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  published boolean not null default false,
  asset_index_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, storage_path, product_id)
);
create index product_images_product_idx on public.product_images(product_id, sort_order);
grant select on public.product_images to anon, authenticated;
grant all on public.product_images to service_role;
alter table public.product_images enable row level security;
create trigger product_images_updated_at before update on public.product_images for each row execute function public.set_updated_at();

create policy "public reads published images of sellable products" on public.product_images
for select to anon, authenticated
using (published and public.product_is_sellable(product_id));
create policy "staff reads images" on public.product_images
for select to authenticated using (public.is_staff(auth.uid()));
create policy "catalog staff writes images" on public.product_images
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));

-- =========================================================
-- الرفع والاستيراد
-- =========================================================
create table public.catalog_import_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  kind public.import_source_kind not null default 'images',
  status public.import_batch_status not null default 'open',
  created_by uuid,
  created_by_email text,
  images_bucket_id text not null default 'admin-imports-private',
  images_path_prefix text not null default '',
  index_file_bucket_id text,
  index_file_path text,
  index_file_name text,
  index_file_format text,
  selected_count integer not null default 0,
  uploaded_count integer not null default 0,
  failed_count integer not null default 0,
  duplicate_count integer not null default 0,
  total_bytes bigint not null default 0,
  min_sequence_no integer,
  max_sequence_no integer,
  missing_sequence_numbers integer[] not null default '{}',
  scan_report_path text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index catalog_import_batches_status_idx on public.catalog_import_batches(status, created_at desc);
grant select, insert, update on public.catalog_import_batches to authenticated;
grant all on public.catalog_import_batches to service_role;
alter table public.catalog_import_batches enable row level security;
create trigger catalog_import_batches_updated_at before update on public.catalog_import_batches for each row execute function public.set_updated_at();

create policy "import staff reads batches" on public.catalog_import_batches
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));
create policy "import staff writes batches" on public.catalog_import_batches
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));

create table public.storage_asset_index (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.catalog_import_batches(id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  relative_path text not null default '',
  folder_hint text not null default '',
  file_name text not null,
  original_file_name text not null,
  sequence_no integer,
  mime_type text not null,
  byte_size bigint not null default 0,
  content_hash text,
  etag text,
  scan_status public.asset_scan_status not null default 'pending',
  scan_message text not null default '',
  linked_product_id uuid references public.products(id) on delete set null,
  published boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, storage_path),
  constraint asset_mime_allowed check (mime_type in ('image/jpeg','image/png','image/webp'))
);
create index storage_asset_index_batch_idx on public.storage_asset_index(batch_id, sequence_no);
create index storage_asset_index_seq_idx on public.storage_asset_index(sequence_no);
create index storage_asset_index_hash_idx on public.storage_asset_index(content_hash);
grant select, insert, update on public.storage_asset_index to authenticated;
grant all on public.storage_asset_index to service_role;
alter table public.storage_asset_index enable row level security;
create trigger storage_asset_index_updated_at before update on public.storage_asset_index for each row execute function public.set_updated_at();

create policy "import staff reads assets" on public.storage_asset_index
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));
create policy "import staff writes assets" on public.storage_asset_index
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));

create table public.catalog_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.catalog_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  matched_asset_id uuid references public.storage_asset_index(id) on delete set null,
  created_product_id uuid references public.products(id) on delete set null,
  status text not null default 'pending',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, row_number)
);
create index catalog_import_rows_batch_idx on public.catalog_import_rows(batch_id, status);
grant select, insert, update on public.catalog_import_rows to authenticated;
grant all on public.catalog_import_rows to service_role;
alter table public.catalog_import_rows enable row level security;
create trigger catalog_import_rows_updated_at before update on public.catalog_import_rows for each row execute function public.set_updated_at();

create policy "import staff reads rows" on public.catalog_import_rows
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));
create policy "import staff writes rows" on public.catalog_import_rows
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));

-- =========================================================
-- التشغيل
-- =========================================================
create table public.store_branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  phone text not null default '',
  whatsapp_number text not null default '',
  opening_hours text not null default '',
  pickup_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.store_branches to anon, authenticated;
grant all on public.store_branches to service_role;
alter table public.store_branches enable row level security;
create trigger store_branches_updated_at before update on public.store_branches for each row execute function public.set_updated_at();
create policy "public reads active branches" on public.store_branches for select to anon, authenticated using (active);
create policy "managers write branches" on public.store_branches
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager']::public.app_role[]));

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  governorate text not null default '',
  fee numeric(10,2) not null default 0,
  minimum_order numeric(10,2) not null default 0,
  free_delivery_threshold numeric(10,2),
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_fee_nonneg check (fee >= 0)
);
grant select on public.delivery_zones to anon, authenticated;
grant all on public.delivery_zones to service_role;
alter table public.delivery_zones enable row level security;
create trigger delivery_zones_updated_at before update on public.delivery_zones for each row execute function public.set_updated_at();
create policy "public reads available zones" on public.delivery_zones for select to anon, authenticated using (available);
create policy "staff reads zones" on public.delivery_zones for select to authenticated using (public.is_staff(auth.uid()));
create policy "delivery managers write zones" on public.delivery_zones
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager']::public.app_role[]));

create table public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create trigger app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();
create policy "public reads public settings" on public.app_settings for select to anon, authenticated using (is_public);
create policy "staff reads settings" on public.app_settings for select to authenticated using (public.is_staff(auth.uid()));
create policy "super admin writes settings" on public.app_settings
for all to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager']::public.app_role[]));

insert into public.app_settings (key, value, is_public) values
  ('store', jsonb_build_object(
      'storeName','تِكّة',
      'whatsappNumber','',
      'openingHours','',
      'branchAddress','',
      'acceptingOrders', true,
      'pickupEnabled', false,
      'substitutionPolicyText','لو حاجة مش متوفرة نتصل بك الأول قبل أي بديل.',
      'announcement','',
      'currency','EGP'
    ), true),
  ('catalog_empty_message', jsonb_build_object('text','بنجهز الرفوف دلوقتي — المنتجات هتنزل قريب.'), true);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta integer not null,
  reason text not null default 'manual',
  reference_id text,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements(variant_id, created_at desc);
grant select, insert on public.inventory_movements to authenticated;
grant all on public.inventory_movements to service_role;
alter table public.inventory_movements enable row level security;
create policy "inventory staff reads movements" on public.inventory_movements
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator','ceo_viewer']::public.app_role[]));
create policy "inventory staff writes movements" on public.inventory_movements
for insert to authenticated with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[]));

-- =========================================================
-- السلة المجهولة (خادم فقط)
-- =========================================================
create table public.anonymous_carts (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  zone_id uuid references public.delivery_zones(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index anonymous_carts_expiry_idx on public.anonymous_carts(expires_at);
grant all on public.anonymous_carts to service_role;
alter table public.anonymous_carts enable row level security;
create trigger anonymous_carts_updated_at before update on public.anonymous_carts for each row execute function public.set_updated_at();
create policy "order staff reads carts" on public.anonymous_carts
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager']::public.app_role[]));

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.anonymous_carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null default 1,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id),
  constraint cart_quantity_positive check (quantity > 0 and quantity <= 99)
);
create index cart_items_cart_idx on public.cart_items(cart_id);
grant all on public.cart_items to service_role;
alter table public.cart_items enable row level security;
create trigger cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
create policy "order staff reads cart items" on public.cart_items
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager']::public.app_role[]));

-- =========================================================
-- الطلبات
-- =========================================================
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  order_number text not null unique default ('TK-' || nextval('public.order_number_seq')::text),
  status public.order_status not null default 'awaiting_whatsapp',
  customer_first_name text not null,
  customer_phone text not null,
  customer_whatsapp text not null default '',
  zone_id uuid references public.delivery_zones(id) on delete set null,
  zone_name text not null default '',
  governorate text not null default '',
  street text not null default '',
  building text not null default '',
  landmark text not null default '',
  customer_notes text not null default '',
  fulfillment public.fulfillment_method not null default 'delivery',
  payment public.payment_method not null default 'cod',
  substitution public.substitution_policy not null default 'call_me',
  items_total numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  grand_total numeric(10,2) not null default 0,
  whatsapp_link_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_phone_format check (customer_phone ~ '^[0-9+]{8,20}$')
);
create index orders_status_idx on public.orders(status, created_at desc);
create index orders_created_idx on public.orders(created_at desc);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

create policy "order staff reads orders" on public.orders
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager','order_operator','ceo_viewer']::public.app_role[]));
create policy "order staff updates orders" on public.orders
for update to authenticated
using (public.has_any_role(auth.uid(), array['super_admin','store_manager','order_operator']::public.app_role[]))
with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','order_operator']::public.app_role[]));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_slug text not null default '',
  size_label text not null default '',
  unit public.sell_unit not null default 'piece',
  unit_price numeric(10,2) not null,
  compare_at_price numeric(10,2),
  quantity integer not null,
  line_total numeric(10,2) not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint order_item_qty_positive check (quantity > 0)
);
create index order_items_order_idx on public.order_items(order_id);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "order staff reads order items" on public.order_items
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager','order_operator','ceo_viewer']::public.app_role[]));

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  label text not null,
  actor text not null default 'النظام',
  actor_user_id uuid,
  is_customer_visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, created_at);
grant select, insert on public.order_events to authenticated;
grant all on public.order_events to service_role;
alter table public.order_events enable row level security;
create policy "order staff reads events" on public.order_events
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager','order_operator','ceo_viewer']::public.app_role[]));
create policy "order staff writes events" on public.order_events
for insert to authenticated with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','order_operator']::public.app_role[]));

create table public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  body text not null,
  author_user_id uuid,
  author_name text not null default '',
  created_at timestamptz not null default now()
);
create index order_notes_order_idx on public.order_notes(order_id, created_at desc);
grant select, insert on public.order_notes to authenticated;
grant all on public.order_notes to service_role;
alter table public.order_notes enable row level security;
create policy "order staff reads notes" on public.order_notes
for select to authenticated using (public.has_any_role(auth.uid(), array['super_admin','store_manager','order_operator']::public.app_role[]));
create policy "order staff writes notes" on public.order_notes
for insert to authenticated with check (public.has_any_role(auth.uid(), array['super_admin','store_manager','order_operator']::public.app_role[]));

-- =========================================================
-- تعيين أول مدير نظام (مرة واحدة فقط)
-- =========================================================
create or replace function public.bootstrap_first_super_admin(_user_id uuid, _email text, _full_name text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count from public.admin_profiles where role = 'super_admin' and active;
  if existing_count > 0 then
    return jsonb_build_object('ok', false, 'reason', 'already_bootstrapped');
  end if;

  insert into public.admin_profiles (user_id, email, full_name, role, active)
  values (_user_id, lower(_email), coalesce(nullif(_full_name,''), 'مدير النظام'), 'super_admin', true)
  on conflict (user_id) do update
    set role = 'super_admin', active = true, email = lower(_email);

  insert into public.audit_logs (actor_user_id, actor_email, action, entity_type, entity_id, metadata)
  values (_user_id, lower(_email), 'bootstrap_first_super_admin', 'admin_profiles', _user_id::text, '{}'::jsonb);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.bootstrap_first_super_admin(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_first_super_admin(uuid, text, text) to service_role;

-- عرض عام آمن: هل يوجد كتالوج منشور؟
create or replace function public.has_published_catalog()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.products p
    where p.status = 'published' and p.available and p.is_complete
      and public.product_is_sellable(p.id)
  )
$$;
grant execute on function public.has_published_catalog() to anon, authenticated, service_role;