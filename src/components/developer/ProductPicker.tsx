import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Search, CheckCircle2, Circle, Loader2, X } from "lucide-react";

import { developerListMasterProducts } from "@/lib/developer.functions";
import { catalogRepository } from "@/services/catalog-repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 60;

/** استوديو ربط المنتجات: كل الكتالوج في قائمة واحدة بالتمرير اللانهائي، بالصور والوصف. */
export function ProductPicker({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  // بحث فوري مع تهدئة نص قصيرة — من غير ما تدوس Enter.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  const categoriesQuery = useQuery({
    queryKey: ["developer-picker-categories"],
    queryFn: () => catalogRepository.listCategories(),
    staleTime: 5 * 60_000,
  });

  const productsQuery = useInfiniteQuery({
    queryKey: ["developer-master-products", query, category],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      developerListMasterProducts({
        data: {
          ...(query ? { query } : {}),
          ...(category ? { categorySlug: category } : {}),
          limit: PAGE_SIZE,
          offset: pageParam as number,
        },
      }),
    getNextPageParam: (lastPage) => {
      const next = lastPage.offset + lastPage.limit;
      return next < lastPage.total ? next : undefined;
    },
  });

  const rows = useMemo(
    () => (productsQuery.data?.pages ?? []).flatMap((page) => page.products),
    [productsQuery.data],
  );
  const total = productsQuery.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && productsQuery.hasNextPage && !productsQuery.isFetchingNextPage) {
          void productsQuery.fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [productsQuery]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <form className="relative" onSubmit={(event) => event.preventDefault()}>
        <Search className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="ابحث بالاسم أو الكود — النتائج بتتحدّث وانت بتكتب"
          className="h-12 rounded-2xl border-2 border-border ps-10 pe-10 shadow-sm focus-visible:border-primary"
          aria-label="بحث في المنتجات"
        />
        {term ? (
          <button
            type="button"
            onClick={() => setTerm("")}
            aria-label="امسح البحث"
            className="absolute top-1/2 end-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={category === null ? "default" : "outline"}
          className="h-8 rounded-full text-xs"
          onClick={() => setCategory(null)}
        >
          كل الأقسام
        </Button>
        {(categoriesQuery.data ?? []).map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={category === item.slug ? "default" : "outline"}
            className="h-8 rounded-full text-xs"
            onClick={() => setCategory(category === item.slug ? null : item.slug)}
          >
            {item.name}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary-soft px-3 py-1 font-bold text-primary">
          محدد: {selected.size}
        </span>
        <span className="text-muted-foreground">إجمالي المنتجات: {total}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ms-auto"
          onClick={() => {
            const next = new Set(selected);
            rows.forEach((row) => next.add(row.id));
            onChange(next);
          }}
        >
          أضف المحمّل ({rows.length})
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(new Set())}>
          امسح التحديد
        </Button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-surface p-3">
        {productsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-56 w-full rounded-2xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">مفيش نتائج.</p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((row) => {
                const active = selected.has(row.id);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => toggle(row.id)}
                      className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border text-start transition-all ${
                        active
                          ? "border-primary bg-primary-soft shadow-md"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-muted">
                        <img
                          src={row.thumbnailUrl ?? "/product-placeholder.jpg"}
                          alt={row.name}
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <span className="absolute top-2 end-2">
                          {active ? (
                            <CheckCircle2 className="size-6 rounded-full bg-background text-primary" />
                          ) : (
                            <Circle className="size-6 rounded-full bg-background/80 text-muted-foreground" />
                          )}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <p className="line-clamp-2 text-xs font-bold leading-snug">{row.name}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                          {row.description || row.categoryName || "—"}
                        </p>
                        <div className="mt-auto flex items-center gap-2 pt-2 text-[11px]">
                          {row.price != null ? (
                            <span className="price font-black text-primary">{row.price}</span>
                          ) : null}
                          <span className="ms-auto text-muted-foreground">{row.sku}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div ref={sentinel} className="h-10" />
            {productsQuery.isFetchingNextPage ? (
              <p className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> بنحمّل باقي المنتجات...
              </p>
            ) : !productsQuery.hasNextPage ? (
              <p className="py-4 text-center text-xs text-muted-foreground">خلصنا الكتالوج كله ✅</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
