import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { CategoryImage } from "@/components/catalog/CategoryImage";
import heroImage from "@/assets/hero-market.jpg";
import { catalogRepository } from "@/services/catalog-repository";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductGridSkeleton, ErrorState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useZone } from "@/lib/zone";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { ProductBundles } from "@/components/catalog/ProductBundles";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "تِكّة — سوبرماركت البيت أونلاين" },
      {
        name: "description",
        content: "اطلب خضار وفاكهة، مخبوزات، ألبان، مشروبات وأساسيات البيت من تِكّة، وأكّد طلبك على واتساب.",
      },
      { property: "og:title", content: "تِكّة — سوبرماركت البيت أونلاين" },
      { property: "og:description", content: "اطلب خضار وفاكهة، مخبوزات، ألبان، مشروبات وأساسيات البيت من تِكّة، وأكّد طلبك على واتساب." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const { zone } = useZone();
  const { subtotal } = useCart();

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => catalogRepository.listCategories(),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "home"],
    queryFn: () => catalogRepository.listProducts({ limit: 48 }),
  });

  const products = productsQuery.data ?? [];
  const featuredProducts = products.filter(p => p.isFeatured).slice(0, 8);
  const regularProducts = products.filter(p => !p.isFeatured);

  const remaining =
    zone?.freeDeliveryThreshold != null ? Math.max(0, zone.freeDeliveryThreshold - subtotal) : null;

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 md:px-6">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.03] bg-gradient-to-br from-card to-background shadow-premium">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,var(--primary),transparent)] opacity-5" />
        <div className="grid md:grid-cols-2">
          <div className="relative z-10 flex flex-col justify-center gap-6 p-8 md:p-14">
            <h1 className="text-4xl font-black leading-tight tracking-tight md:text-6xl text-balance">
              طلبات البيت اللي ناقصة، <br/>
              <span className="text-primary">في كام تكة.</span>
            </h1>
            <p className="max-w-md text-lg font-medium text-muted-foreground/80 md:text-xl">
              أسرع سوبر ماركت في مصر. جودة فريش، أسعار حقيقية، وتوصيل يشرّف.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Button asChild size="lg" className="h-14 rounded-2xl px-10 text-lg font-black shadow-primary-glow transition-all hover:scale-105 active:scale-95">
                <Link to="/categories">ابدأ التسوق</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="h-14 rounded-2xl px-10 text-lg font-black glass transition-all hover:scale-105 active:scale-95">
                <Link to="/category/$slug" params={{ slug: "offers" }}>
                  شوف العروض
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative order-first h-48 md:order-last md:h-auto">
            <img
              src={heroImage}
              alt="سوبرماركت تكة"
              width={1536}
              height={1024}
              className="size-full object-cover grayscale-[0.2] contrast-[1.1]"
            />
            <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-transparent md:bg-linear-to-r" />
          </div>
        </div>
      </section>

      <div className="sticky top-20 z-30 mt-6 md:static">
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ to: "/search", search: { q: term.trim() } });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 start-4 size-5 -translate-y-1/2 text-primary" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="إيه اللي ناقص البيت؟ اكتب اسم المنتج أو الماركة"
            aria-label="البحث عن منتج"
            className="h-14 rounded-2xl border-white/10 bg-card/80 ps-12 text-lg shadow-xl backdrop-blur-md focus-visible:ring-primary/50"
          />
        </form>
      </div>


      {zone && remaining != null ? (
        <div className="mt-3 rounded-xl border border-border bg-surface p-3">
          <p className="price text-xs text-muted-foreground">
            {remaining > 0
              ? `لسه فاضلك ${formatPrice(remaining)} للتوصيل المجاني في ${zone.name}`
              : `التوصيل مجاني في ${zone.name} على طلبك الحالي`}
          </p>
          <Progress
            className="mt-2"
            value={zone.freeDeliveryThreshold ? Math.min(100, (subtotal / zone.freeDeliveryThreshold) * 100) : 0}
          />
        </div>
      ) : null}

      <ProductBundles />
      
      <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: "✨", title: "جودة ممتازة", desc: "بنختار لك أفضل المنتجات بأعلى جودة" },
          { icon: "⚡", title: "توصيل سريع", desc: "توصيل سريع وآمن لحد باب بيتك" },
          { icon: "🤝", title: "ثقة وأمان", desc: "تسوق بكل سهولة.. رضاك يهمنا" },
        ].map((v) => (
          <div key={v.title} className="flex flex-col items-center text-center p-6 rounded-3xl bg-card border border-white/5 shadow-sm transition-transform hover:-translate-y-1">
            <span className="text-3xl mb-3">{v.icon}</span>
            <h3 className="font-black text-primary mb-1">{v.title}</h3>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">{v.desc}</p>
          </div>
        ))}
      </section>


      
      {featuredProducts.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">عروض وخصومات مميزة</h2>
            <Button variant="ghost" size="sm" asChild>
               <Link to="/category/$slug" params={{ slug: "offers" }}>عرض الكل</Link>
            </Button>
          </div>
          {productsQuery.isLoading ? (
            <ProductGridSkeleton count={4} />
          ) : productsQuery.isError ? (
            <ErrorState onRetry={() => productsQuery.refetch()} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">الأقسام</h2>
        {categoriesQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : categoriesQuery.isError ? (
          <ErrorState onRetry={() => categoriesQuery.refetch()} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {categoriesQuery.data?.map((category) => (
              <li key={category.id}>
                <Link
                  to="/category/$slug"
                  params={{ slug: category.slug }}
                  className="group relative block h-24 overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-colors hover:border-primary"
                >
                  <CategoryImage
                    slug={category.slug}
                    name={category.name}
                    className="absolute inset-0 size-full transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-bold">{category.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-bold">اختيارات البيت</h2>
        </div>
        {productsQuery.isLoading ? (
          <ProductGridSkeleton count={8} />
        ) : productsQuery.isError ? (
          <ErrorState onRetry={() => productsQuery.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {regularProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
