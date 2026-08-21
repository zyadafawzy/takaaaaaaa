import type { Category, DeliveryZone, Product, Promotion, StoreSettings } from "@/domain/types";
import { matchesQuery, normalizeArabic } from "@/lib/arabic";
import {
  getStoreMeta,
  getStorefrontProduct,
  listStorefrontProducts,
  searchStorefrontProducts,
} from "@/lib/catalog.functions";

/**
 * طبقة المستودع: الواجهة لا تعرف مصدر البيانات.
 * المصدر Supabase حقيقي، وكل قوائم المنتجات مقسّمة على الخادم —
 * مفيش أي شاشة بتحمّل الكتالوج كله.
 */

type Meta = Awaited<ReturnType<typeof getStoreMeta>>;
export type ProductQuery = {
  categorySlug?: string | undefined;
  query?: string | undefined;
  offersOnly?: boolean | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
};

let metaCache: { at: number; data: Meta } | null = null;
const CACHE_MS = 30_000;

async function meta(): Promise<Meta> {
  if (metaCache && Date.now() - metaCache.at < CACHE_MS) return metaCache.data;
  const data = await getStoreMeta();
  metaCache = { at: Date.now(), data };
  return data;
}

export function invalidateCatalogCache(): void {
  metaCache = null;
}

export const catalogRepository = {
  async listCategories(): Promise<Category[]> {
    return (await meta()).categories;
  },

  async getCategory(slug: string): Promise<Category | null> {
    return (await meta()).categories.find((c) => c.slug === slug) ?? null;
  },

  async listProductsPage(options: ProductQuery = {}) {
    return listStorefrontProducts({ data: options });
  },

  async listProducts(options: ProductQuery = {}): Promise<Product[]> {
    return (await listStorefrontProducts({ data: options })).products;
  },

  async getProduct(slug: string): Promise<Product | null> {
    return (await getStorefrontProduct({ data: { slug } })).product;
  },

  async getProductWithRelated(slug: string) {
    return getStorefrontProduct({ data: { slug } });
  },

  async search(query: string): Promise<{
    products: Product[];
    categories: Category[];
    brands: string[];
    suggestion: string | null;
  }> {
    const q = normalizeArabic(query);
    if (!q) return { products: [], categories: [], brands: [], suggestion: null };

    const [products, info] = await Promise.all([
      searchStorefrontProducts({ data: { query, limit: 24 } }),
      meta(),
    ]);
    const categories = info.categories.filter((c) => matchesQuery([c.name, c.description], query));
    const brands = Array.from(
      new Set(products.map((p) => p.brand).filter((name): name is string => Boolean(name))),
    );

    return { products, categories, brands, suggestion: null };
  },

  async listBrands(): Promise<string[]> {
    return [];
  },

  async listZones(): Promise<DeliveryZone[]> {
    return (await meta()).zones;
  },

  async getSettings(): Promise<StoreSettings> {
    return (await meta()).settings;
  },

  async listPromotions(): Promise<Promotion[]> {
    const { products } = await listStorefrontProducts({ data: { offersOnly: true, limit: 24 } });
    return products.map((p) => ({
      id: `promo_${p.id}`,
      title: p.name,
      productId: p.id,
      price: p.price,
      compareAtPrice: p.compareAtPrice ?? p.price,
      startsAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
      active: true,
      source: "live" as const,
    }));
  },

  async getCatalogState(): Promise<{ hasCatalog: boolean; emptyMessage: string }> {
    const { hasCatalog, emptyMessage } = await meta();
    return { hasCatalog, emptyMessage };
  },
};

export const IS_DEMO_DATA = false;
