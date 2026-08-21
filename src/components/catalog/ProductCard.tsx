import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "./QuantityStepper";
import { ProductImage } from "./ProductImage";

import type { Product } from "@/domain/types";
import { discountPercent, formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";

const unitLabel: Record<Product["unit"], string> = {
  piece: "بالقطعة",
  kg: "بالكيلو",
  pack: "بالعبوة",
  bundle: "بالحزمة",
  liter: "باللتر",
};

export function ProductCard({ product }: { product: Product }) {
  const { addProduct, setQuantity, quantityOf } = useCart();
  const quantity = quantityOf(product.id);
  const outOfStock = !product.available || product.stock <= 0;
  const off = discountPercent(product.price, product.compareAtPrice);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.03] bg-card shadow-soft transition-all duration-500 hover:shadow-premium hover:-translate-y-1.5 hover:border-primary/20">
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="relative block aspect-square overflow-hidden bg-muted/10"
      >
        <ProductImage 
          src={product.images && product.images.length > 0 ? product.images[0] : undefined} 
          alt={product.name} 
          className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />


        {off ? (
          <span className="absolute top-2.5 start-2.5 rounded-lg bg-primary px-2 py-1 text-[10px] font-black text-primary-foreground shadow-lg">
            -{off}%
          </span>
        ) : null}
        
        {outOfStock ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
            <span className="rounded-full bg-surface/90 px-3 py-1 text-[11px] font-bold text-muted-foreground border border-border shadow-sm">
              مش متاح دلوقتي
            </span>
          </div>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <Link 
          to="/product/$slug" 
          params={{ slug: product.slug }} 
          className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-primary transition-colors min-h-[2.5rem]"
        >
          {product.name}
        </Link>
        <p className="text-[11px] text-muted-foreground/70 font-medium">
          {product.size} · {unitLabel[product.unit]}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="flex flex-col gap-0.5">
            {product.compareAtPrice && product.compareAtPrice > product.price ? (
              <p className="price text-[10px] text-muted-foreground line-through opacity-60">
                {formatPrice(product.compareAtPrice)}
              </p>
            ) : null}
            <p className="price text-[17px] font-black text-primary leading-none">{formatPrice(product.price)}</p>
          </div>

          <div className="flex shrink-0 items-center">
            {outOfStock ? (
              <Button size="sm" variant="outline" asChild className="h-9 rounded-xl text-[10px] px-3 font-bold border-border bg-muted/5">
                <Link to="/category/$slug" params={{ slug: product.categorySlug }}>
                  بديل
                </Link>
              </Button>
            ) : quantity > 0 ? (
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
                className="size-9 rounded-xl shadow-md shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                aria-label={`ضيف ${product.name} للسلة`}
                onClick={() => {
                  addProduct(product);
                  toast.success("ضفناها في السلة", { 
                    description: product.name,
                    className: "bg-card border-primary/20",
                  });
                }}
              >
                <Plus className="size-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>


  );
}
