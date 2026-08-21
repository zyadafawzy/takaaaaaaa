import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * قراءة الكتالوج المنشور للعامة (بدون أي حساب).
 * الأسعار والمخزون تُقرأ من الخادم دايمًا، والصفحات مقسّمة على الخادم.
 */

export const getStoreMeta = createServerFn({ method: "GET" }).handler(async () => {
  const { loadStoreMeta } = await import("./catalog.server");
  return loadStoreMeta();
});

export const listStorefrontProducts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        categorySlug: z.string().max(64).optional(),
        query: z.string().max(120).optional(),
        offersOnly: z.boolean().optional(),
        offset: z.number().int().min(0).max(5000).optional(),
        limit: z.number().int().min(1).max(48).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { loadProductPage } = await import("./catalog.server");
    return loadProductPage(data);
  });

export const searchStorefrontProducts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().max(120),
        categorySlug: z.string().optional(),
        limit: z.number().int().min(1).max(48).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { unifiedSearch } = await import("./catalog.server");
    return unifiedSearch(data);
  });

export const getStorefrontProduct = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(160) }).parse(input))
  .handler(async ({ data }) => {
    const { loadProductBySlug, loadRelatedProducts } = await import("./catalog.server");
    const product = await loadProductBySlug(data.slug);
    if (!product) return { product: null, related: [] };
    const related = await loadRelatedProducts(product.categorySlug, product.slug, 4);
    return { product, related };
  });

