import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { catalogRepository } from "@/services/catalog-repository";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductImage } from "@/components/catalog/ProductImage";

import { QuantityStepper } from "@/components/catalog/QuantityStepper";
import { EmptyState, ErrorState } from "@/components/shared/States";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { discountPercent, formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/product/$slug")({
  head: () => ({
    meta: [
      { title: "منتج — تِكّة" },
      { name: "description", content: "تفاصيل المنتج: السعر، الحجم، وحدة البيع، وحالة التوفر." },
      { property: "og:title", content: "منتج من تِكّة" },
      { property: "og:description", content: "السعر، الحجم، وحدة البيع، وحالة التوفر بوضوح." },
    ],
  }),
  component: ProductPage,
});

const unitLabel = {
  piece: "بالقطعة",
  kg: "بالكيلو",
  pack: "بالعبوة",
  bundle: "بالحزمة",
  liter: "باللتر",
} as const;

function ProductPage() {
  const { slug } = Route.useParams();
  const { addProduct, setQuantity, quantityOf } = useCart();
  const [activeImage, setActiveImage] = useState(0);

  const {
    data: result,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => catalogRepository.getProductWithRelated(slug),
  });

  const data = result?.product ?? null;
  const related = result?.related ?? [];


  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-4 md:px-6">
        <Skeleton className="mb-4 h-64 w-full rounded-xl" />
        <Skeleton className="mb-2 h-6 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-8 md:px-6">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-8 md:px-6">
        <EmptyState
          title="المنتج ده مش موجود"
          description="يمكن يكون اتشال من الكتالوج. جرّب تدوّر عليه بالاسم."
          action={
            <Button asChild>
              <Link to="/search" search={{ q: "" }}>روح للبحث</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const quantity = quantityOf(data.id);
  const outOfStock = !data.available || data.stock <= 0;
  const off = discountPercent(data.price, data.compareAtPrice);

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 md:px-6">
      <Breadcrumbs
        items={[
          { label: "الأقسام", to: "/categories" },
          { label: data.name },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-card shadow-lifted group">
            <ProductImage
              src={data.images[activeImage] ?? data.images[0]}
              alt={data.name}
              priority
              displayWidth={720}
              sizes={[360, 480, 720]}
              className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>

          {data.images.length > 1 ? (
            <div className="mt-2 flex gap-2">
              {data.images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`صورة ${index + 1}`}
                  className="size-16 overflow-hidden rounded-lg border border-border"
                >
                  <ProductImage src={image} alt="" displayWidth={120} sizes={[120, 160]} />
                </button>
              ))}

            </div>
          ) : null}
        </div>

        <div className="flex flex-col">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black text-primary uppercase tracking-wider">
              {data.brand || "تِكّة"}
            </span>
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-tight md:text-4xl">{data.name}</h1>
          <p className="mt-2 text-base font-medium text-muted-foreground/80">
            {data.size} · {unitLabel[data.unit]}
          </p>

          <div className="mt-6 flex items-baseline gap-4">
            <span className="price text-4xl font-black text-primary">{formatPrice(data.price)}</span>
            {data.compareAtPrice && data.compareAtPrice > data.price ? (
              <div className="flex flex-col">
                <span className="price text-sm text-muted-foreground/60 line-through decoration-destructive/50">
                  {formatPrice(data.compareAtPrice)}
                </span>
                <span className="mt-0.5 rounded-lg bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground">
                  وفرت {off}%
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className={`size-2 rounded-full ${outOfStock ? 'bg-destructive animate-pulse' : 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]'}`} />
            <span className={`text-xs font-bold ${outOfStock ? 'text-destructive' : 'text-success'}`}>
              {outOfStock ? "مش متاح دلوقتي" : "متاح وجاهز للتوصيل"}
            </span>
          </div>

          <p className="mt-6 text-sm leading-8 text-muted-foreground/90 font-medium whitespace-pre-wrap">{data.description}</p>


          <div className="mt-8 flex items-center gap-4">
            {outOfStock ? (
              <Button disabled size="lg" className="flex-1 rounded-2xl font-black h-14">
                مش متاح دلوقتي
              </Button>

            ) : quantity > 0 ? (
              <div className="flex-1">
                <QuantityStepper
                  quantity={quantity}
                  max={Math.min(data.stock, 20)}
                  label={data.name}
                  onChange={(next) => setQuantity(data.id, next)}
                />
              </div>
            ) : (
              <Button
                size="lg"
                className="flex-1 rounded-2xl font-black h-14 shadow-lg shadow-primary/20 transition-all active:scale-95"

                onClick={() => {
                  addProduct(data);
                  toast.success("ضفناها في السلة", { 
                    description: data.name,
                    className: "bg-card border-primary/20"
                  });
                }}
              >
                ضيف للسلة
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              className="size-14 shrink-0 rounded-2xl border-white/10 hover:bg-primary/5 active:scale-90 transition-all"
              aria-label="مشاركة المنتج"
              onClick={async () => {
                const url = window.location.href;
                if (navigator.share) {
                  try {
                    await navigator.share({ title: data.name, url });
                    return;
                  } catch {
                    /* المستخدم قفل المشاركة */
                  }
                }
                await navigator.clipboard.writeText(url);
                toast.success("نسخنا لينك المنتج");
              }}
            >
              <Share2 className="size-6" />
            </Button>
          </div>


          <Accordion type="single" collapsible className="mt-6">
            <AccordionItem value="info">
              <AccordionTrigger>معلومات مهمة</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  السعر للوحدة: <span className="price">{formatPrice(data.price)}</span> / {data.size}
                </p>
                {data.isFresh ? (
                  <p>
                    منتج فريش: لو مش موجود وقت التجهيز، تقدر تختار في صفحة إنهاء الطلب: بديل مناسب، أو نتصل
                    بيك، أو نشيله من الطلب.
                  </p>
                ) : null}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="details">
              <AccordionTrigger>تفاصيل</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  كود الصنف: <span className="price">{data.sku}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="نسخ كود الصنف"
                    onClick={() => {
                      navigator.clipboard.writeText(data.sku);
                      toast.success("نسخنا الكود");
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                </p>
                <p>الماركة: {data.brand}</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {related.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">منتجات من نفس القسم</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {related.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}

          </div>
        </section>
      ) : null}
    </div>
  );
}
