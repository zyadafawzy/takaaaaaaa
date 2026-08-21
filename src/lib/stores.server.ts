import type { Category, DeliveryZone, Product } from "@/domain/types";
import { createPublicServerClient } from "./supabase-public.server";
import { defaultBranding, type StoreBranding } from "./store-theme";
import { PRODUCT_SELECT, mapProduct, type ProductRow } from "./catalog.server";

/**
 * طبقة قراءة السوبرماركتات (multi-tenant).
 * كل سوبرماركت له هوية وألوان ومنتجات مختارة من الكتالوج الرئيسي.
 */

export type StorePublic = {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_maintenance: boolean;
  maintenance_message: string | null;
  plan: string;
  features: Record<string, boolean>;
  logoUrl: string | null;
  logoPath: string | null;
  phone: string;
  whatsappNumber: string;
  supportNumber: string;
  address: string;
  governorate: string;
  businessHours: string;
  announcement: string;
  branding: StoreBranding;
  zones: DeliveryZone[];
  settings: StorePublicSettings;
};

export type StorePublicSettings = {
  acceptingOrders: boolean;
  pickupEnabled: boolean;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  contactEmail: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  orderWhatsappTemplate: string;
  substitutionPolicyText: string;
  closedMessage: string;
  privacyText: string;
  termsText: string;
  currency: string;
};

export const defaultStoreSettings: StorePublicSettings = {
  acceptingOrders: true,
  pickupEnabled: false,
  codEnabled: true,
  onlinePaymentEnabled: false,
  contactEmail: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  orderWhatsappTemplate: "",
  substitutionPolicyText: "",
  closedMessage: "المتجر مقفول مؤقتًا، جرّب تاني بعد شويّة.",
  privacyText: "",
  termsText: "",
  currency: "ج.م",
};

export function mapStoreSettings(row: Record<string, unknown> | null): StorePublicSettings {
  if (!row) return defaultStoreSettings;
  return {
    acceptingOrders: row["accepting_orders"] !== false,
    pickupEnabled: row["pickup_enabled"] === true,
    codEnabled: row["cod_enabled"] !== false,
    onlinePaymentEnabled: row["online_payment_enabled"] === true,
    contactEmail: String(row["contact_email"] ?? ""),
    facebookUrl: String(row["facebook_url"] ?? ""),
    instagramUrl: String(row["instagram_url"] ?? ""),
    tiktokUrl: String(row["tiktok_url"] ?? ""),
    orderWhatsappTemplate: String(row["order_whatsapp_template"] ?? ""),
    substitutionPolicyText: String(row["substitution_policy_text"] ?? ""),
    closedMessage: String(row["closed_message"] ?? defaultStoreSettings.closedMessage),
    privacyText: String(row["privacy_text"] ?? ""),
    termsText: String(row["terms_text"] ?? ""),
    currency: String(row["default_currency"] ?? "ج.م"),
  };
}

export const STORE_PAGE_SIZE = 24;

function mapBranding(row: Record<string, unknown> | null): StoreBranding {
  if (!row) return defaultBranding;
  return {
    primaryColor: String(row["primary_color"] ?? defaultBranding.primaryColor),
    secondaryColor: String(row["secondary_color"] ?? defaultBranding.secondaryColor),
    accentColor: String(row["accent_color"] ?? defaultBranding.accentColor),
    backgroundColor: String(row["background_color"] ?? defaultBranding.backgroundColor),
    surfaceColor: String(row["surface_color"] ?? defaultBranding.surfaceColor),
    textColor: String(row["text_color"] ?? defaultBranding.textColor),
    mutedColor: String(row["muted_color"] ?? defaultBranding.mutedColor),
    borderColor: String(row["border_color"] ?? defaultBranding.borderColor),
    successColor: String(row["success_color"] ?? defaultBranding.successColor),
    warningColor: String(row["warning_color"] ?? defaultBranding.warningColor),
    dangerColor: String(row["danger_color"] ?? defaultBranding.dangerColor),
    themePreset: String(row["theme_preset"] ?? "custom"),
    colorMode: (row["color_mode"] === "dark" ? "dark" : "light"),
    fontFamily: String(row["font_family"] ?? "cairo"),
    radiusStyle: String(row["radius_style"] ?? "soft"),
    density: String(row["density"] ?? "comfortable"),
    headerStyle: String(row["header_style"] ?? "classic"),
    productCardStyle: String(row["product_card_style"] ?? "standard"),
    heroImageUrl: row["hero_image_url"] ? String(row["hero_image_url"]) : null,
    heroTitle: String(row["hero_title"] ?? ""),
    heroSubtitle: String(row["hero_subtitle"] ?? ""),
  };
}

export async function loadStoreBySlug(slug: string): Promise<StorePublic | null> {
  const supabase = createPublicServerClient();
  const { data: store } = await supabase
    .from("stores")
    .select(
      "*"
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!store) return null;

  const [brandingRes, zonesRes, announcementRes, settingsRes] = await Promise.all([
    supabase.from("store_branding").select("*").eq("store_id", store.id).maybeSingle(),
    supabase
      .from("store_delivery_zones")
      .select("id, name, governorate, fee, minimum_order, free_delivery_threshold, available")
      .eq("store_id", store.id)
      .eq("available", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_announcements")
      .select("content")
      .eq("store_id", store.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("store_settings").select("*").eq("store_id", store.id).maybeSingle(),
  ]);

  const zones: DeliveryZone[] = (zonesRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    governorate: row.governorate,
    fee: Number(row.fee),
    minimumOrder: Number(row.minimum_order),
    freeDeliveryThreshold:
      row.free_delivery_threshold == null ? null : Number(row.free_delivery_threshold),
    available: row.available,
    source: "live",
  }));

  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    description: store.description ?? "",
    is_maintenance: Boolean((store as any).is_maintenance),
    maintenance_message: (store as any).maintenance_message ?? null,
    plan: String((store as any).plan ?? "basic"),
    features: ((store as any).features ?? {}) as Record<string, boolean>,
    logoUrl: store.logo_url ? `/api/public/store-logo/${store.id}` : null,
    logoPath: store.logo_url ?? null,
    phone: store.phone ?? "",
    whatsappNumber: store.whatsapp_number ?? "",
    supportNumber: store.support_number ?? "",
    address: store.address ?? "",
    governorate: store.governorate ?? "",
    businessHours: store.business_hours ?? "",
    announcement: announcementRes.data?.content ?? "",
    branding: mapBranding(brandingRes.data as Record<string, unknown> | null),
    zones,
    settings: mapStoreSettings(settingsRes.data as Record<string, unknown> | null),
  };
}

export type StoreProductPage = {
  products: Product[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export async function loadStoreProductPage(options: {
  storeId: string;
  categorySlug?: string | undefined;
  query?: string | undefined;
  offersOnly?: boolean | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
}): Promise<StoreProductPage> {
  const supabase = createPublicServerClient();
  const limit = Math.min(Math.max(options.limit ?? STORE_PAGE_SIZE, 1), 48);
  const offset = Math.max(options.offset ?? 0, 0);

  const { data: assignments, count } = await supabase
    .from("store_products")
    .select("product_id, price_override, compare_at_override, stock_override, featured, sort_order", {
      count: "exact",
    })
    .eq("store_id", options.storeId)
    .eq("enabled", true)
    .eq("visible", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .range(offset, offset + limit - 1);

  const rows = assignments ?? [];
  if (rows.length === 0) {
    return { products: [], total: count ?? 0, offset, limit, hasMore: false };
  }

  let request = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in(
      "id",
      rows.map((r) => r.product_id),
    );

  if (options.categorySlug && options.categorySlug !== "offers") {
    request = request.eq("categories.slug", options.categorySlug).not("categories", "is", null);
  }
  const q = (options.query ?? "").replace(/[%_,()"'\\]/g, " ").trim().slice(0, 60);
  if (q) request = request.or(`search_text.ilike.%${q}%,name.ilike.%${q}%`);

  const { data } = await request;
  const overrides = new Map(rows.map((r) => [r.product_id, r]));

  let products = ((data ?? []) as unknown as Array<ProductRow & { id: string }>)
    .map((row) => {
      const mapped = mapProduct(row);
      if (!mapped) return null;
      const override = overrides.get(row.id);
      if (!override) return mapped;
      return {
        ...mapped,
        price: override.price_override == null ? mapped.price : Number(override.price_override),
        compareAtPrice:
          override.compare_at_override == null
            ? mapped.compareAtPrice
            : Number(override.compare_at_override),
        stock: override.stock_override == null ? mapped.stock : Number(override.stock_override),
        isFeatured: override.featured || mapped.isFeatured,
      } satisfies Product;
    })
    .filter((p): p is Product => p !== null);

  if (options.offersOnly || options.categorySlug === "offers") {
    products = products.filter((p) => p.compareAtPrice && p.compareAtPrice > p.price);
  }

  const total = count ?? products.length;
  return { products, total, offset, limit, hasMore: offset + limit < total };
}

/** أقسام هذا السوبرماركت فقط — المشتقة من منتجاته المفعّلة. */
export async function loadStoreCategories(storeId: string): Promise<Category[]> {
  const supabase = createPublicServerClient();
  const [{ data: assignments }, { data: categories }] = await Promise.all([
    supabase
      .from("store_products")
      .select("products ( categories ( slug ) )")
      .eq("store_id", storeId)
      .eq("enabled", true)
      .eq("visible", true)
      .limit(2000),
    supabase
      .from("categories")
      .select("id, slug, name, description, icon, sort_order")
      .eq("published", true)
      .order("sort_order", { ascending: true }),
  ]);

  const used = new Set<string>();
  for (const row of (assignments ?? []) as unknown as Array<{
    products: { categories: { slug: string } | null } | null;
  }>) {
    const slug = row.products?.categories?.slug;
    if (slug) used.add(slug);
  }

  return (categories ?? [])
    .filter((c) => used.has(c.slug))
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      icon: c.icon,
      source: "live" as const,
    }));
}

export async function loadStoreProductBySlug(
  storeId: string,
  slug: string,
): Promise<Product | null> {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as ProductRow & { id: string };
  const { data: assignment } = await supabase
    .from("store_products")
    .select("price_override, compare_at_override, stock_override, featured")
    .eq("store_id", storeId)
    .eq("product_id", row.id)
    .eq("enabled", true)
    .eq("visible", true)
    .maybeSingle();
  if (!assignment) return null;

  const mapped = mapProduct(row);
  if (!mapped) return null;
  return {
    ...mapped,
    price: assignment.price_override == null ? mapped.price : Number(assignment.price_override),
    compareAtPrice:
      assignment.compare_at_override == null
        ? mapped.compareAtPrice
        : Number(assignment.compare_at_override),
    stock: assignment.stock_override == null ? mapped.stock : Number(assignment.stock_override),
    isFeatured: assignment.featured || mapped.isFeatured,
  };
}

/** مسار شعار السوبرماركت داخل المخزن الخاص — للاستخدام على الخادم فقط. */
export async function resolveStoreLogo(
  storeId: string,
): Promise<{ bucket: string; path: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("stores")
    .select("logo_url, status")
    .eq("id", storeId)
    .maybeSingle();
  if (!data?.logo_url) return null;
  return { bucket: "store-assets", path: data.logo_url };
}
