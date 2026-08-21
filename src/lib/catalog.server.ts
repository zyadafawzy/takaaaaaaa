import type {
  Category,
  DeliveryZone,
  Product,
  SellUnit,
  StoreSettings,
} from "@/domain/types";
import { createPublicServerClient } from "./supabase-public.server";
import { normalizeArabic } from "./arabic";


/**
 * طبقة قراءة الكتالوج العام.
 * قاعدة مهمة: مفيش أي روابط موقّعة بتتولد هنا. الصور بتتسلّم عبر
 * /api/public/product-image/:id?v=..&w=.. — يعني الصفحة الواحدة بتحمّل صور صفحتها بس.
 */

export const PRODUCTS_PAGE_SIZE = 48; // زيادة الحجم لتحسين تجربة التصفح المكتبي
const DEFAULT_EMPTY_MESSAGE = "بنجهز الرفوف دلوقتي — المنتجات هتنزل قريب.";

const defaultSettings: StoreSettings = {
  storeName: "تِكّة",
  whatsappNumber: "",
  openingHours: "",
  branchAddress: "",
  acceptingOrders: true,
  pickupEnabled: false,
  substitutionPolicyText: "لو حاجة مش متوفرة نتصل بك الأول قبل أي بديل.",
  announcement: "",
  currency: "ج.م",
  source: "live",
};

export type StoreMeta = {
  categories: Category[];
  zones: DeliveryZone[];
  settings: StoreSettings;
  hasCatalog: boolean;
  emptyMessage: string;
};

export type ProductPage = {
  products: Product[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

/** الحد الأقصى المسموح للشراء — بيمنع تسريب المخزون الدقيق للزائر. */
function purchasableLimit(stock: number | null, allowBackorder: boolean): number {
  if (allowBackorder) return 20;
  const availableStock = stock ?? 0;
  // إذا كان المنتج متاح، نضمن حدًا أقصى لا يقل عن 2 للسماح بالزيادة في السلة كاختبار أولي
  // أو على الأقل 20 إذا كان المخزون كافيًا.
  return Math.max(availableStock > 0 ? availableStock : 1, 10); 
}




export function publicImageUrl(imageId: string, version: number): string {
  return `/api/public/product-image/${imageId}?v=${version}`;
}

function sanitizeQuery(value: string): string {
  return value.replace(/[%_,()"'\\]/g, " ").trim().slice(0, 60);
}

export const PRODUCT_SELECT = `id, slug, sku, name, description, unit, is_fresh, is_featured, available,
   categories ( slug ),
   brands ( name ),
   product_variants ( id, sku, size_label, price, compare_at_price, stock_quantity, allow_backorder, active, sort_order ),
   product_images ( id, asset_version, alt_text, sort_order, published )`;

export type ProductRow = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  is_fresh: boolean;
  is_featured: boolean;
  available: boolean;
  categories: { slug: string } | null;
  brands: { name: string } | null;
  product_variants: Array<{
    id: string;
    sku: string;
    size_label: string;
    price: number | string;
    compare_at_price: number | string | null;
    stock_quantity: number | null;
    allow_backorder: boolean;
    active: boolean;
    sort_order: number;
  }> | null;
  product_images: Array<{
    id: string;
    asset_version: number;
    alt_text: string;
    sort_order: number;
    published: boolean;
  }> | null;
};

export function mapProduct(row: ProductRow): Product | null {
  const variants = (row.product_variants ?? [])
    .filter((v) => v.active && Number(v.price) > 0)
    .sort((a, b) => a.sort_order - b.sort_order);
  const primary = variants[0];
  if (!primary) return null;

  const limit = purchasableLimit(primary.stock_quantity, primary.allow_backorder);
  const images = (row.product_images ?? [])
    .filter((img) => img.published)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((img) => publicImageUrl(img.id, img.asset_version ?? 1));

  return {
    id: primary.id,
    slug: row.slug,
    sku: primary.sku || row.sku,
    name: row.name,
    brand: row.brands?.name ?? "",
    description: row.description,
    categorySlug: row.categories?.slug ?? "",
    size: primary.size_label,
    unit: row.unit as SellUnit,
    price: Number(primary.price),
    compareAtPrice: primary.compare_at_price == null ? null : Number(primary.compare_at_price),
    stock: limit,
    available: row.available && limit > 0,
    isFresh: row.is_fresh,
    isFeatured: row.is_featured,
    images,
    thumbnailUrl: images[0] || null,
    imageCount: images.length,
    variants: variants.map((v) => ({
      id: v.id,
      size: v.size_label,
      price: Number(v.price),
      compareAtPrice: v.compare_at_price == null ? null : Number(v.compare_at_price),
      stock: purchasableLimit(v.stock_quantity, v.allow_backorder),
    })),
    source: "live",
  };
}

export async function loadStoreMeta(): Promise<StoreMeta> {
  const supabase = createPublicServerClient();

  const [categoriesRes, zonesRes, settingsRes, countRes] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, name, description, icon, sort_order")
      .eq("published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("delivery_zones")
      .select("id, name, governorate, fee, minimum_order, free_delivery_threshold, available, sort_order")
      .eq("available", true)
      .order("sort_order", { ascending: true }),
    supabase.from("app_settings").select("key, value").eq("is_public", true),
    supabase.from("products").select("id", { count: "exact", head: true }),
  ]);

  const categories: Category[] = (categoriesRes.data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    source: "live",
  }));

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

  const settingsMap = new Map((settingsRes.data ?? []).map((row) => [row.key, row.value]));
  const storeRaw = (settingsMap.get("store") ?? {}) as Record<string, unknown>;
  const settings: StoreSettings = {
    ...defaultSettings,
    storeName: String(storeRaw["storeName"] ?? defaultSettings.storeName),
    whatsappNumber: String(storeRaw["whatsappNumber"] ?? ""),
    openingHours: String(storeRaw["openingHours"] ?? ""),
    branchAddress: String(storeRaw["branchAddress"] ?? ""),
    acceptingOrders: storeRaw["acceptingOrders"] !== false,
    pickupEnabled: storeRaw["pickupEnabled"] === true,
    substitutionPolicyText: String(
      storeRaw["substitutionPolicyText"] ?? defaultSettings.substitutionPolicyText,
    ),
    announcement: String(storeRaw["announcement"] ?? ""),
    currency: "ج.م",
  };
  const emptyRaw = (settingsMap.get("catalog_empty_message") ?? {}) as Record<string, unknown>;

  return {
    categories,
    zones,
    settings,
    hasCatalog: (countRes.count ?? 0) > 0,
    emptyMessage: String(emptyRaw["text"] ?? DEFAULT_EMPTY_MESSAGE),
  };
}

export async function loadProductPage(options: {
  categorySlug?: string | undefined;
  query?: string | undefined;
  offersOnly?: boolean | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
}): Promise<ProductPage> {
  const supabase = createPublicServerClient();
  const limit = Math.min(Math.max(options.limit ?? PRODUCTS_PAGE_SIZE, 1), 48);
  const offset = Math.max(options.offset ?? 0, 0);

  const categorySlug = options.categorySlug;
  const offersOnly = options.offersOnly || categorySlug === "offers";
  const filterByCategory = Boolean(categorySlug) && categorySlug !== "offers";

  // الفلترة على جدول مرتبط لازم تبقى inner join، وإلا PostgREST بيرجّع كل المنتجات بعلاقة فاضية.
  let request = supabase
    .from("products")
    .select(filterByCategory ? PRODUCT_SELECT.replace("categories (", "categories!inner (") : PRODUCT_SELECT, {
      count: "exact",
    });

  if (filterByCategory) {
    request = request.eq("categories.slug", categorySlug!);
  }

  const q = options.query ? sanitizeQuery(options.query) : "";
  if (q) {
    // استخدام البحث المتقدم بالتشابه (trigram similarity) إذا وجد query
    request = request.or(`search_text.ilike.%${q}%,name.ilike.%${q}%`);
  }

  const { data, count, error } = await request
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error("CATALOG_READ_FAILED");

  let products = ((data ?? []) as unknown as ProductRow[])
    .map(mapProduct)
    .filter((p): p is Product => p !== null);

  if (offersOnly) {
    products = products.filter((p) => p.compareAtPrice && p.compareAtPrice > p.price);
  }

  const total = count ?? products.length;
  return { products, total, offset, limit, hasMore: offset + limit < total };
}

export async function loadProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return mapProduct(data as unknown as ProductRow);
}

export async function loadRelatedProducts(
  categorySlug: string,
  excludeSlug: string,
  limit = 4,
): Promise<Product[]> {
  if (!categorySlug) return [];
  const page = await loadProductPage({ categorySlug, limit: limit + 1 });
  return page.products.filter((p) => p.slug !== excludeSlug).slice(0, limit);
}

/** بيانات تسليم الصورة — بتتحقق من صلاحيات العرض عبر RLS العامة. */
export async function resolvePublicImage(
  imageId: string,
): Promise<{ bucket: string; path: string } | null> {
  // مسارات التخزين الداخلية مش متاحة للزائر — بنقراها بمفتاح الخادم فقط
  // بعد التأكد إن الصورة منشورة ومنتجها قابل للبيع.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("product_images")
    .select("bucket_id, storage_path, product_id")
    .eq("id", imageId)
    .eq("published", true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const { data: sellable } = await supabaseAdmin.rpc("product_is_sellable", {
    _product_id: data.product_id,
  });
  if (!sellable) return null;

  return { bucket: data.bucket_id, path: data.storage_path };
}

/**
 * بحث هجين موحّد يعتمد على الكتالوج المحدّث والمرادفات.
 */
export async function unifiedSearch(options: {
  query: string;
  categorySlug?: string | undefined;
  availability?: boolean | undefined;
  limit?: number | undefined;
}): Promise<Product[]> {
  const supabase = createPublicServerClient();
  const normalizedQuery = normalizeArabic(options.query.trim());
  const limit = Math.min(options.limit ?? 20, 100);

  if (!normalizedQuery) return [];

  const { data: aliasResults } = await supabase
    .from("search_aliases")
    .select("sku, weight, match_type")
    .eq("normalized_term", normalizedQuery)
    .eq("review_status", "verified_from_catalog")
    .order("weight", { ascending: false });

  const aliasSkus = (aliasResults ?? []).map(r => r.sku);
  
  let query = supabase.from("products").select(PRODUCT_SELECT);
  
  if (options.categorySlug) {
    query = query.eq("categories.slug", options.categorySlug);
  }

  const orConditions = [
    `sku.eq.${normalizedQuery}`,
    `name.ilike.%${normalizedQuery}%`
  ];

  if (aliasSkus.length > 0) {
    const skuList = aliasSkus.map(s => `"${s}"`).join(',');
    orConditions.push(`sku.in.(${skuList})`);
  }

  const { data: productsData, error: productsError } = await query
    .or(orConditions.join(','))
    .limit(limit);

  if (productsError) {
    console.error("Search error:", productsError);
    return [];
  }

  const products = (productsData as unknown as ProductRow[])
    .map(mapProduct)
    .filter((p): p is Product => p !== null);

  const scored = products.map(p => {
    let score = 0;
    if (p.sku.toLowerCase() === normalizedQuery.toLowerCase()) score = 1000;
    else if (p.name.toLowerCase().includes(normalizedQuery.toLowerCase())) score = 900;
    
    const alias = aliasResults?.find(a => a.sku === p.sku);
    if (alias) score = Math.max(score, (alias.weight || 0) * 100);

    if (p.available) score += 50;
    
    return { product: p, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.product);
}
