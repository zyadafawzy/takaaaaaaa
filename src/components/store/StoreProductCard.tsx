import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/catalog/QuantityStepper";
import { ProductImage } from "@/components/catalog/ProductImage";
import type { Product } from "@/domain/types";
import { discountPercent, formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";

/** نفس بطاقة تِكّة، بس روابطها جوّه السوبرماركت وألوانها من هويته. */
export function StoreProductCard({ product, storeSlug }: { product: Product; storeSlug: string }) {
  const { addProduct, setQuantity, quantityOf } = useCart();
  const quantity = quantityOf(product.id);
  const outOfStock = !product.available || product.stock <= 0;
  const off = discountPercent(product.price, product.compareAtPrice);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted">
      <Link
        to="/s/$storeSlug/product/$slug"
        params={{ storeSlug, slug: product.slug }}
        className="relative block aspect-square overflow-hidden bg-muted/20"
      >
        <ProductImage
          src={product.images?.[0]}
          alt={product.name}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {off ? (
          <span className="absolute top-2.5 start-2.5 rounded-lg bg-primary px-2 py-1 text-[10px] font-black text-primary-foreground">
            -{off}%
          </span>
        ) : null}
        {outOfStock ? (
          <div className="absolute inset-0 grid place-items-center bg-background/60">
            <span className="rounded-full border border-border bg-surface/90 px-3 py-1 text-[11px] font-bold text-muted-foreground">
              مش متاح دلوقتي
            </span>
          </div>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <Link
          to="/s/$storeSlug/product/$slug"
          params={{ storeSlug, slug: product.slug }}
          className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug transition-colors group-hover:text-primary"
        >
          {product.name}
        </Link>
        <p className="line-clamp-2 min-h-[2.5rem] text-[11px] text-muted-foreground">
          {product.description || product.size}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="flex flex-col gap-0.5">
            {product.compareAtPrice && product.compareAtPrice > product.price ? (
              <p className="price text-[10px] text-muted-foreground line-through opacity-70">
                {formatPrice(product.compareAtPrice)}
              </p>
            ) : null}
            <p className="price text-[17px] font-black leading-none text-primary">
              {formatPrice(product.price)}
            </p>
          </div>

          {outOfStock ? null : quantity > 0 ? (
            <div className="scale-[0.85] origin-bottom-right">
              <QuantityStepper
                quantity={quantity}
                max={Math.min(product.stock, 20)}
                label={product.name}
                onChange={(next) => setQuantity(product.id, next)}
              />
            </div>
          ) : (
            <Button
              size="icon"
              className="size-9 rounded-xl shadow-md shadow-primary/20 transition-all duration-200 hover:scale-110 active:scale-90"
              aria-label={`ضيف ${product.name} للسلة`}
              onClick={(event) => {
                const button = event.currentTarget;
                button.classList.remove("animate-add-pop");
                void button.offsetWidth;
                button.classList.add("animate-add-pop");
                addProduct(product);
                toast.success("ضفناها في السلة", { description: product.name });
              }}
            >
              <Plus className="size-5" strokeWidth={3} />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
