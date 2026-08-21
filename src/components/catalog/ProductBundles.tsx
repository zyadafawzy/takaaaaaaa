import { ProductCard } from "@/components/catalog/ProductCard";
import { getBundles, type Bundle } from "@/lib/admin-actions.functions";
import { useQuery } from "@tanstack/react-query";

import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ShoppingBasket } from "lucide-react";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
import type { Product } from "@/domain/types";

export function ProductBundles() {
  const { data: bundles = [], isLoading } = useQuery<Bundle[]>({
    queryKey: ["product-bundles"],
    queryFn: () => getBundles(),
  });

  const { addProduct } = useCart();

  if (isLoading || bundles.length === 0) return null;

  const handleAddBundle = (bundle: Bundle) => {
    bundle.bundle_items.forEach((item) => {
      if (item.products) {
        // We map the database product to storefront Product type
        const storefrontProduct: Product = {
          id: item.products.id,
          slug: item.products.slug,
          sku: item.products.sku,
          name: item.products.name,
          brand: "", // Bundles might not have brands explicitly
          description: item.products.description,
          categorySlug: "",
          size: "",
          unit: item.products.unit as any,
          price: Number(item.products.price),
          compareAtPrice: null,
          stock: 20,
          available: true,
          isFresh: item.products.is_fresh,
          isFeatured: false,
          images: item.products.images || [],
          source: "live"

        };
        addProduct(storefrontProduct, item.quantity);
      }
    });
    toast.success(`ضفنا حزمة ${bundle.name} للسلة`);
  };

  return (
    <section className="mt-8 overflow-hidden">
      <h2 className="mb-4 text-xl font-bold px-1">عروض التوفير (Packages)</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {bundles.map((bundle) => (
          <div 
            key={bundle.id} 
            className="min-w-[280px] md:min-w-[320px] rounded-2xl border border-border bg-surface p-4 shadow-soft"
          >
            <div className="mb-3">
              <h3 className="font-bold text-lg">{bundle.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">{bundle.description}</p>
            </div>
            
            <div className="space-y-3 mb-4">
              {bundle.bundle_items.map((item) => (
                <div key={item.product_id} className="flex items-center gap-2 text-sm">
                  <img 
                    src={item.products?.images?.[0] || "/favicon.png"} 
                    alt=""
                    className="size-8 rounded bg-muted flex-shrink-0 object-cover" 
                  />

                  <span className="flex-1 truncate">{item.products?.name}</span>
                  <span className="text-[11px] font-bold text-primary">x{item.quantity}</span>
                </div>
              ))}
            </div>

            <Button 
              className="w-full gap-2" 
              onClick={() => handleAddBundle(bundle)}
            >
              <ShoppingBasket className="size-4" />
              اشتري الحزمة وفر {formatPrice(bundle.discount_amount)}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
