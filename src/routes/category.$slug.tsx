import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { catalogRepository } from "@/services/catalog-repository";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { EmptyState, ErrorState, ProductGridSkeleton } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Product } from "@/domain/types";

type SortKey = "relevance" | "price_asc" | "price_desc" | "name";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `قسم ${params.slug} — تِكّة` },
      { name: "description", content: "منتجات القسم بأسعار واضحة وحالة توفر صريحة من تِكّة." },
      { property: "og:title", content: "أقسام تِكّة" },
      { property: "og:description", content: "منتجات القسم بأسعار واضحة وحالة توفر صريحة." },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const [sort, setSort] = useState<SortKey>("relevance");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  const categoryQuery = useQuery({
    queryKey: ["category", slug],
    queryFn: () => catalogRepository.getCategory(slug),
  });

  const productsQuery = useInfiniteQuery({
    queryKey: ["products", "category", slug],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      catalogRepository.listProductsPage({ categorySlug: slug, offset: pageParam, limit: 24 }),
    getNextPageParam: (last) => (last.hasMore ? last.offset + last.limit : undefined),
  });

  const loaded = useMemo(
    () => (productsQuery.data?.pages ?? []).flatMap((page) => page.products),
    [productsQuery.data],
  );
  const total = productsQuery.data?.pages[0]?.total ?? 0;

  const allBrands = useMemo(
    () => Array.from(new Set(loaded.map((p) => p.brand).filter(Boolean))).sort(),
    [loaded],
  );

  /** حدود السعر بتتحسب من أسعار القسم نفسه، مش رقم ثابت. */
  const priceBounds = useMemo(() => {
    const prices = loaded.map((p) => p.price).filter((n) => Number.isFinite(n));
    if (!prices.length) return { min: 0, max: 0 };
    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    return { min, max: max > min ? max : min + 1 };
  }, [loaded]);

  const priceStep = useMemo(() => {
    const span = priceBounds.max - priceBounds.min;
    if (span <= 50) return 1;
    if (span <= 500) return 5;
    return 25;
  }, [priceBounds]);

  const effectiveMaxPrice = maxPrice == null ? priceBounds.max : Math.min(maxPrice, priceBounds.max);

  const products = useMemo(() => {
    let list: Product[] = loaded;
    if (availableOnly) list = list.filter((p) => p.available && p.stock > 0);
    if (offersOnly) list = list.filter((p) => p.compareAtPrice && p.compareAtPrice > p.price);
    if (brands.length) list = list.filter((p) => brands.includes(p.brand));
    list = list.filter((p) => p.price <= effectiveMaxPrice);

    const sorted = [...list];
    if (sort === "price_asc") sorted.sort((a, b) => a.price - b.price);
    if (sort === "price_desc") sorted.sort((a, b) => b.price - a.price);
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return sorted;
  }, [loaded, availableOnly, offersOnly, brands, maxPrice, sort]);


  const filters = (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold">الحالة</p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="available"
            checked={availableOnly}
            onCheckedChange={(v) => setAvailableOnly(v === true)}
          />
          <Label htmlFor="available" className="text-sm">
            متاح الآن بس
          </Label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Checkbox id="offers" checked={offersOnly} onCheckedChange={(v) => setOffersOnly(v === true)} />
          <Label htmlFor="offers" className="text-sm">
            عليه خصم حقيقي
          </Label>
        </div>
      </div>

      {priceBounds.max > priceBounds.min ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">أقصى سعر</p>
            {maxPrice != null ? (
              <button
                type="button"
                onClick={() => setMaxPrice(null)}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                كل الأسعار
              </button>
            ) : null}
          </div>
          <Slider
            value={[effectiveMaxPrice]}
            min={priceBounds.min}
            max={priceBounds.max}
            step={priceStep}
            onValueChange={([v]) => setMaxPrice(v ?? priceBounds.max)}
            aria-label="أقصى سعر"
          />
          <p className="price mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>حتى {effectiveMaxPrice} ج.م</span>
            <span>
              {priceBounds.min} – {priceBounds.max} ج.م
            </span>
          </p>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-semibold">الماركة</p>
        <div className="space-y-2">
          {allBrands.map((brand) => (
            <div key={brand} className="flex items-center gap-2">
              <Checkbox
                id={`brand-${brand}`}
                checked={brands.includes(brand)}
                onCheckedChange={(v) =>
                  setBrands((current) =>
                    v === true ? [...current, brand] : current.filter((b) => b !== brand),
                  )
                }
              />
              <Label htmlFor={`brand-${brand}`} className="text-sm">
                {brand}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 md:px-6">
      <Breadcrumbs items={[{ label: "الأقسام", to: "/categories" }, { label: categoryQuery.data?.name ?? "قسم" }]} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold">{categoryQuery.data?.name ?? "القسم"}</h1>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 md:hidden">
              <SlidersHorizontal className="size-4" /> فلاتر
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>فلاتر</SheetTitle>
            </SheetHeader>
            <div className="p-4">{filters}</div>
          </SheetContent>
        </Sheet>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-44 text-xs" aria-label="ترتيب النتائج">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">الأقرب لبحثك</SelectItem>
            <SelectItem value="price_asc">السعر من الأقل</SelectItem>
            <SelectItem value="price_desc">السعر من الأعلى</SelectItem>
            <SelectItem value="name">الاسم</SelectItem>
          </SelectContent>
        </Select>

        <span className="ms-auto text-xs text-muted-foreground">
          ظاهر {products.length} من {total} منتج
        </span>

      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:block">{filters}</aside>

        <div>
          {productsQuery.isLoading ? (
            <ProductGridSkeleton />
          ) : productsQuery.isError ? (
            <ErrorState onRetry={() => productsQuery.refetch()} />
          ) : products.length === 0 ? (
            <EmptyState
              title="مفيش منتجات بالفلاتر دي"
              description="جرّب توسّع نطاق السعر أو تشيل فلتر الماركة."
              action={
                <Button
                  onClick={() => {
                    setBrands([]);
                    setMaxPrice(null);
                    setAvailableOnly(false);
                    setOffersOnly(false);
                  }}
                >
                  امسح الفلاتر
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {productsQuery.hasNextPage ? (
                <div className="mt-5 flex justify-center">
                  <Button
                    variant="outline"
                    disabled={productsQuery.isFetchingNextPage}
                    onClick={() => void productsQuery.fetchNextPage()}
                  >
                    {productsQuery.isFetchingNextPage ? "بنحمّل..." : "حمّل منتجات أكتر"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

    </div>
  );
}
