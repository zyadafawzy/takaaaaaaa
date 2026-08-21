import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Loader2, Sparkles, Zap, ShieldCheck } from "lucide-react";

import { listStoreProducts } from "@/lib/stores.functions";
import { ErrorState } from "@/components/shared/States";
import { CategoryImage } from "@/components/catalog/CategoryImage";
import { isFeatureOn } from "@/lib/store-features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

const parentRoute = getRouteApi("/s/$storeSlug");
const PAGE = 48;

export const Route = createFileRoute("/s/$storeSlug/")({
  component: StoreHome,
});

const VALUE_CARDS = [
  { icon: Sparkles, title: "جودة ممتازة", desc: "بنختار لك أفضل المنتجات بأعلى جودة" },
  { icon: Zap, title: "توصيل سريع", desc: "توصيل سريع وآمن لحد باب بيتك" },
  { icon: ShieldCheck, title: "ثقة وأمان", desc: "تسوق بكل سهولة.. رضاك يهمنا" },
];

function StoreHome() {
  const { store, categories } = parentRoute.useLoaderData();
  const { addProduct } = useCart();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const features = store?.features;
  const showSearch = isFeatureOn(features, "search");
  const showCategories = isFeatureOn(features, "categories") && categories.length > 0;

  const productsQuery = useInfiniteQuery({
    queryKey: ["store-products", store?.id, category, query],
    enabled: Boolean(store),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listStoreProducts({
        data: {
          storeId: store!.id,
          ...(category ? { categorySlug: category } : {}),
          ...(query ? { query } : {}),
          limit: PAGE,
          offset: pageParam as number,
        },
      }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.reduce((sum, page) => sum + page.products.length, 0) : undefined,
  });

  const products = useMemo(
    () => (productsQuery.data?.pages ?? []).flatMap((page) => page.products),
    [productsQuery.data],
  );

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && productsQuery.hasNextPage && !productsQuery.isFetchingNextPage) {
          void productsQuery.fetchNextPage();
        }
      },
      { rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [productsQuery]);

  if (!store) return null;

  const heroTitle = store.branding.heroTitle || "طلبات البيت اللي ناقصة، في كام تكة.";
  const heroSubtitle =
    store.branding.heroSubtitle || store.description || "جودة فريش، أسعار حقيقية، وتوصيل يشرّف.";
  const heroImage = store.branding.heroImageUrl || "/assets/store-heroes/fresh-produce.jpg";

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 md:px-6">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-border bg-gradient-to-br from-surface to-background shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,var(--primary),transparent)] opacity-10" />
        <div className="grid md:grid-cols-2">
          <div className="relative z-10 flex flex-col justify-center gap-6 p-8 md:p-14">
            <h1 className="text-balance text-4xl font-black leading-tight tracking-tight md:text-6xl">
              {heroTitle}
            </h1>
            <p className="max-w-md text-lg font-medium text-muted-foreground md:text-xl">{heroSubtitle}</p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Button
                size="lg"
                className="h-14 rounded-2xl px-10 text-lg font-black transition-all hover:scale-105 active:scale-95"
                onClick={() => {
                  setCategory(null);
                  document.getElementById("store-products")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                ابدأ التسوق
              </Button>
              {isFeatureOn(features, "offers") ? (
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-14 rounded-2xl px-10 text-lg font-black transition-all hover:scale-105 active:scale-95"
                  asChild
                >
                  <Link to="/s/$storeSlug/cart" params={{ storeSlug: store.slug }}>
                    شوف السلة
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="relative order-first h-48 md:order-last md:h-auto">
            <img
              src={heroImage}
              alt={store.name}
              width={1536}
              height={1024}
              className="size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent md:bg-gradient-to-r" />
          </div>
        </div>
      </section>

      {showSearch ? (
        <div className="sticky top-20 z-30 mt-6 md:static">
          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(term.trim());
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 start-4 size-5 -translate-y-1/2 text-primary" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="إيه اللي ناقص البيت؟ اكتب اسم المنتج أو الماركة"
              aria-label="البحث عن منتج"
              className="h-14 rounded-2xl border-border bg-surface/80 ps-12 text-lg shadow-xl backdrop-blur-md"
            />
          </form>
        </div>
      ) : null}

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {VALUE_CARDS.map((value) => (
          <div
            key={value.title}
            className="flex flex-col items-center rounded-3xl border border-border bg-surface p-6 text-center shadow-sm transition-transform hover:-translate-y-1"
          >
            <value.icon className="mb-3 size-7 text-primary" />
            <h2 className="mb-1 font-black text-primary">{value.title}</h2>
            <p className="text-xs font-medium leading-relaxed text-muted-foreground">{value.desc}</p>
          </div>
        ))}
      </section>

      {showCategories ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">الأقسام</h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <li>
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`h-24 w-full rounded-xl border text-sm font-bold transition-colors ${
                  category === null ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface"
                }`}
              >
                كل المنتجات
              </button>
            </li>
            {categories.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setCategory(item.slug)}
                  className={`group relative block h-24 w-full overflow-hidden rounded-xl border bg-surface text-start shadow-sm transition-colors ${
                    category === item.slug ? "border-primary" : "border-border hover:border-primary"
                  }`}
                >
                  <CategoryImage
                    slug={item.slug}
                    name={item.name}
                    className="absolute inset-0 size-full transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-bold">{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="store-products" className="mt-10 min-h-[60vh]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{query ? `نتائج «${query}»` : "كل المنتجات"}</h2>
          {query ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setTerm("");
              }}
            >
              امسح البحث
            </Button>
          ) : null}
        </div>

        {productsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : productsQuery.isError ? (
          <ErrorState onRetry={() => void productsQuery.refetch()} />
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-16 text-center">
            <h3 className="text-lg font-black">مفيش منتجات بالشكل ده</h3>
            <p className="mt-2 text-sm text-muted-foreground">جرب كلمة تانية أو قسم مختلف.</p>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <Link
                    to="/s/$storeSlug/product/$slug"
                    params={{ storeSlug: store.slug, slug: product.slug }}
                    className="relative block aspect-square overflow-hidden bg-muted"
                  >
                    <img
                      src={product.thumbnailUrl || "/product-placeholder.jpg"}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {product.compareAtPrice && product.compareAtPrice > product.price ? (
                      <span className="absolute top-2 start-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-black text-destructive-foreground">
                        وفر {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%
                      </span>
                    ) : null}
                  </Link>
                  <div className="flex flex-1 flex-col p-3">
                    <Link
                      to="/s/$storeSlug/product/$slug"
                      params={{ storeSlug: store.slug, slug: product.slug }}
                      className="line-clamp-2 text-xs font-bold leading-snug hover:text-primary"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {product.description || product.size || ""}
                    </p>
                    <div className="mt-auto flex items-center gap-2 pt-2">
                      <span className="price text-sm font-black text-primary">{formatPrice(product.price)}</span>
                      <Button
                        size="sm"
                        className="ms-auto size-9 rounded-xl p-0"
                        aria-label={`إضافة ${product.name} للسلة`}
                        onClick={() => addProduct(product)}
                      >
                        <Plus className="size-4" strokeWidth={3} />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div ref={sentinel} className="h-10" />
            {productsQuery.isFetchingNextPage ? (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> بنجيب باقي المنتجات...
              </p>
            ) : !productsQuery.hasNextPage ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                عرضنا كل المنتجات المتاحة ({products.length})
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
