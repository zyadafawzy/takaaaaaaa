import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { getStoreProduct } from "@/lib/stores.functions";
import { ProductImage } from "@/components/catalog/ProductImage";
import { QuantityStepper } from "@/components/catalog/QuantityStepper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { discountPercent, formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";

const parentRoute = getRouteApi("/s/$storeSlug");

export const Route = createFileRoute("/s/$storeSlug/product/$slug")({
  component: StoreProductPage,
});

function StoreProductPage() {
  const { store } = parentRoute.useLoaderData();
  const { slug } = Route.useParams();
  const { addProduct, setQuantity, quantityOf } = useCart();
  const [imageIndex, setImageIndex] = useState(0);

  const productQuery = useQuery({
    queryKey: ["store-product", store?.id, slug],
    enabled: Boolean(store),
    queryFn: () => getStoreProduct({ data: { storeId: store!.id, slug } }),
  });

  if (!store) return null;
  const product = productQuery.data?.product ?? null;

  if (productQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <Skeleton className="aspect-square w-full rounded-3xl md:w-1/2" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center md:px-6">
        <h1 className="text-xl font-bold">المنتج ده مش متاح في {store.name}</h1>
        <Button asChild className="mt-4">
          <Link to="/s/$storeSlug" params={{ storeSlug: store.slug }}>
            رجوع للمتجر
          </Link>
        </Button>
      </div>
    );
  }

  const quantity = quantityOf(product.id);
  const off = discountPercent(product.price, product.compareAtPrice);
  const outOfStock = !product.available || product.stock <= 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/s/$storeSlug" params={{ storeSlug: store.slug }} className="hover:text-primary">
          {store.name}
        </Link>
        <ChevronRight className="size-3 rotate-180" />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <ProductImage
              src={product.images?.[imageIndex] ?? product.images?.[0]}
              alt={product.name}
              displayWidth={720}
              sizes={[360, 480, 720]}
              priority
              className="aspect-square w-full object-cover"
            />
          </div>
          {product.images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {product.images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`صورة ${index + 1}`}
                  className={`size-16 shrink-0 overflow-hidden rounded-xl border ${
                    index === imageIndex ? "border-primary" : "border-border"
                  }`}
                >
                  <ProductImage src={image} alt={product.name} displayWidth={120} sizes={[120]} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="text-2xl font-black leading-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{product.size}</p>

          <div className="mt-4 flex items-end gap-3">
            <p className="price text-3xl font-black text-primary">{formatPrice(product.price)}</p>
            {product.compareAtPrice && product.compareAtPrice > product.price ? (
              <p className="price text-sm text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice)}
              </p>
            ) : null}
            {off ? (
              <span className="rounded-lg bg-primary px-2 py-1 text-[11px] font-black text-primary-foreground">
                -{off}%
              </span>
            ) : null}
          </div>

          {product.description ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          ) : null}

          <div className="mt-6">
            {outOfStock ? (
              <p className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                المنتج ده مش متاح دلوقتي.
              </p>
            ) : quantity > 0 ? (
              <QuantityStepper
                quantity={quantity}
                max={Math.min(product.stock, 20)}
                label={product.name}
                onChange={(next) => setQuantity(product.id, next)}
              />
            ) : (
              <Button
                size="lg"
                className="w-full gap-2 rounded-2xl"
                onClick={() => {
                  addProduct(product);
                  toast.success("ضفناها في السلة", { description: product.name });
                }}
              >
                <Plus className="size-5" /> ضيف للسلة
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
