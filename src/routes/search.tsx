import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { z } from "zod";
import { catalogRepository } from "@/services/catalog-repository";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductGridSkeleton, ErrorState, EmptyState } from "@/components/shared/States";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "إيه اللي ناقص البيت؟ — تِكّة" },
      { name: "description", content: "ابحث عن كل اللي محتاجه لبيتك من تِكّة." },
    ],
  }),
  validateSearch: (search) =>
    z
      .object({
        q: z.string().optional().default(""),
      })
      .parse(search),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q);
  const [debouncedTerm, setDebouncedTerm] = useState(q);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(term);
      if (term.trim() !== q) {
        navigate({ 
          to: "/search", 
          search: { q: term.trim() },
          replace: true 
        });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [term, navigate, q]);

  const searchQuery = useQuery({
    queryKey: ["search", debouncedTerm],
    queryFn: () => catalogRepository.search(debouncedTerm),
    enabled: debouncedTerm.length >= 2,
  });

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 md:px-6">
      <div className="mb-8">
        <h1 className="mb-4 text-2xl font-extrabold md:text-3xl text-center">إيه اللي ناقص البيت؟</h1>
        <div className="relative mx-auto max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="اكتب اسم المنتج أو الماركة أو كود الصنف"
            className="h-14 ps-11 text-lg rounded-2xl border-2 border-primary/20 focus-visible:border-primary shadow-soft"
            autoFocus
          />
        </div>
      </div>

      {searchQuery.isLoading ? (
        <ProductGridSkeleton count={8} />
      ) : searchQuery.isError ? (
        <ErrorState onRetry={() => searchQuery.refetch()} />
      ) : debouncedTerm.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Search className="size-16 mb-4 opacity-10" />
          <p className="text-lg">اكتب حرفين على الأقل عشان تبدأ البحث</p>
        </div>
      ) : searchQuery.data?.products.length === 0 ? (
        <EmptyState
          title="ملقيناش المنتج ده"
          description="جرّب اسم الماركة أو كلمة أبسط، أو اتأكد من الحروف."
          action={
            <Button onClick={() => setTerm("")} variant="outline">
              امسح البحث
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {searchQuery.data && searchQuery.data.categories.length > 0 && (
             <div className="flex flex-wrap gap-2">
                {searchQuery.data.categories.map(cat => (
                   <Button key={cat.id} variant="secondary" size="sm" asChild className="rounded-full">
                      <Link to="/category/$slug" params={{ slug: cat.slug }}>
                        {cat.name}
                      </Link>
                   </Button>
                ))}
             </div>
          )}
          
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {searchQuery.data?.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}




