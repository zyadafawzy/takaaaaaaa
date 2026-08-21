# Teka Developer Dashboard — Multi-Store Platform

Turn Teka into a master commerce engine that powers multiple independent, branded supermarkets, controlled from one premium `/developer` dashboard. The existing Teka storefront, cart, checkout and admin stay exactly as they are — each new supermarket is the same experience with its own brand, link, WhatsApp number, products and data.

## Architecture decision (important)

Lovable Cloud cannot provision a brand-new physical database per supermarket. So we implement **strict tenant isolation inside one database**: every operational row carries a `store_id`, and isolation is enforced at the database level (RLS policies + server-side store context), never by filtering in the browser. The data model is shaped so a store can later be exported to its own database without redesign. The dashboard will show the real state of each integration — no fake "database created" messaging.

## Data model

Shared master catalog (unchanged): `products`, `product_variants`, `product_images`, `categories`, `brands`.

New tables (all with grants + RLS):
- `stores` — name, slug, owner, logo, contact info, business hours, status, timestamps
- `store_branding` — primary/secondary/accent/background/surface/text/muted/border/success/warning/danger, logo + favicon
- `store_products` — store_id + master product/variant, enabled, visible, store price, store stock, featured, sort
- `store_users` — links a Supabase auth user to a store with a role (`store_admin`, `staff`)
- `store_delivery_zones`, `store_announcements`, `store_activity_log`
- Existing operational tables (`orders`, `order_items`, `cart_items`, `anonymous_carts`, `promotions`) gain a `store_id` column; existing rows are assigned to the default Teka store.

Isolation helpers: `current_store_id()` and `user_can_access_store(store_id)` security-definer functions used by every RLS policy. Platform-owner role (`platform_owner`) sits above all store admins.

## Storefront

- New route segment `/s/$storeSlug/...` mirroring the current storefront routes, reusing the exact same components — no UI duplication.
- A `StoreContext` provider resolves the store from the slug in the route loader and injects its branding as CSS variables over the existing design tokens, so all Teka components restyle automatically.
- Catalog reads filter by `store_products`; prices/stock come from the store row with master values as fallback.
- WhatsApp order messages use the store's own number — resolved from the store record, never hardcoded.

## Developer dashboard (`/developer`, platform-owner only)

- **Overview** — real counts (stores, active/inactive, shared products, connected products, orders across stores), recent creations, activity feed, stores needing attention.
- **Supermarkets** — polished list with logo, name, status, owner, link, product count, WhatsApp, admin status, dates; search + filters; open storefront / open admin / activate / deactivate.
- **Create Supermarket wizard** — 7 steps: Identity → Branding → Products → Contact → Admin → Review → Create, with progress, validation, and resumable draft state.
  - Branding step includes a live preview rendering real Teka components (header, search, category strip, product card, offer card, cart summary, CTA, footer) that recolor instantly, plus a contrast-safety check on chosen colors.
  - Product step is an assignment studio: search, category/brand/status filters, multi-select, select-all-visible, bulk add/remove.
  - Creation runs as an audited server transaction that creates the store, branding, product links, admin user (password set through Supabase auth — never stored in our tables), and writes activity entries; failures roll back and are reported honestly.
- **Store detail page** — tabs for identity, branding, products, delivery, announcements, admins, activity, launch readiness checklist.
- **Master Products** — read-only view of the Teka catalog with per-store usage counts.
- **Activity** — platform-wide audit trail.

## Store admin

The existing `/admin` screens are reused and scoped to the signed-in user's store, branded with that store's colors. Platform owner can enter any store's admin; store admins only their own.

## Security

- All store scoping enforced by RLS + server functions; no service-role key ever reaches the browser.
- Store admin passwords go through Supabase auth only.
- Every privileged action written to the activity log.

## Build order

1. Migration: stores + branding + store_products + store_users + isolation functions and RLS; backfill Teka as store #1.
2. Store context, theming layer, `/s/$storeSlug` storefront routes.
3. Developer dashboard shell, overview, store list.
4. Create wizard incl. branding preview and product studio.
5. Store detail management, delivery/announcements/admins, activity.
6. Store-scoped admin + WhatsApp routing + launch-readiness checks.

This is a large build; I'll ship it in the order above so you can review each stage as it lands.
