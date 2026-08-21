import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** قراءة عامة لواجهة كل سوبرماركت — بدون أي حساب. */

export const getStore = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { loadStoreBySlug, loadStoreCategories } = await import("./stores.server");
    const store = await loadStoreBySlug(data.slug);
    if (!store) return { store: null, categories: [] };
    const categories = await loadStoreCategories(store.id);
    return { store, categories };
  });

export const listStoreProducts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: z.string().uuid(),
        categorySlug: z.string().max(64).optional(),
        query: z.string().max(120).optional(),
        offersOnly: z.boolean().optional(),
        offset: z.number().int().min(0).max(5000).optional(),
        limit: z.number().int().min(1).max(48).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { loadStoreProductPage } = await import("./stores.server");
    return loadStoreProductPage(data);
  });

export const getStoreProduct = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ storeId: z.string().uuid(), slug: z.string().min(1).max(160) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { loadStoreProductBySlug } = await import("./stores.server");
    return { product: await loadStoreProductBySlug(data.storeId, data.slug) };
  });
