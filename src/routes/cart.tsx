import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useZone } from "@/lib/zone";
import { computeTotals, meetsMinimum } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";
import { QuantityStepper } from "@/components/catalog/QuantityStepper";
import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ZonePicker } from "@/components/layout/ZonePicker";
import { Skeleton } from "@/components/ui/skeleton";
import { catalogRepository } from "@/services/catalog-repository";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "سلتك — تِكّة" },
      { name: "description", content: "راجع منتجاتك، الكميات، ورسوم التوصيل قبل ما تكمّل الطلب." },
      { property: "og:title", content: "سلة تِكّة" },
      { property: "og:description", content: "ملخص شفاف لطلبك قبل التأكيد." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { cart, ready, setQuantity, removeLine, restoreLine, setNote } = useCart();
  const { zone } = useZone();
  const totals = computeTotals(cart.lines, zone);
  const enoughForMinimum = meetsMinimum(totals.itemsTotal, zone);
  const allOut = cart.lines.length > 0 && cart.lines.every((line) => line.maxQuantity <= 0);

  const suggestions = useQuery({
    queryKey: ["cart-suggestions"],
    queryFn: () => catalogRepository.listProducts({ limit: 3 }),
    enabled: cart.lines.length > 0,
  });


  if (!ready) {
    return (
      <div className="mx-auto max-w-4xl px-3 py-6 md:px-6">
        <Skeleton className="mb-3 h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-3 py-8 md:px-6">
        <h1 className="mb-4 text-2xl font-extrabold">سلتك</h1>
        <EmptyState
          title="السلة فاضية"
          description="ابدأ من الأقسام أو دوّر على اللي ناقص البيت."
          action={
            <Button asChild>
              <Link to="/categories">شوف الأقسام</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-3 py-6 md:px-6 mb-24">
      <h1 className="mb-6 text-3xl font-black tracking-tight">سلتك</h1>

      <ul className="space-y-4">
        {cart.lines.map((line) => (
          <li key={line.productId} className="group overflow-hidden rounded-2xl border border-white/5 bg-card shadow-sm transition-all hover:border-primary/20">
            <div className="flex gap-4 p-3.5">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted/30">
                <img
                  src={line.image || "/favicon.png"}
                  alt={line.name}
                  loading="lazy"
                  className="size-full object-cover transition-transform group-hover:scale-110"
                />
              </div>
              <div className="min-w-0 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black leading-tight group-hover:text-primary transition-colors">{line.name}</p>
                    <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{line.size}</p>
                    <p className="price mt-2 text-xs font-bold text-primary">
                      {formatPrice(line.unitPrice)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`حذف ${line.name}`}
                    onClick={() => {
                      removeLine(line.productId);
                      toast("شيلنا المنتج", {
                        description: line.name,
                        action: { label: "تراجع", onClick: () => restoreLine(line) },
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <div className="scale-90 origin-left">
                    <QuantityStepper
                      quantity={line.quantity}
                      max={line.maxQuantity}
                      label={line.name}
                      onChange={(next) =>
                        next <= 0 ? removeLine(line.productId) : setQuantity(line.productId, next)
                      }
                    />
                  </div>
                  <span className="price text-base font-black">
                    {formatPrice(line.unitPrice * line.quantity)}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-3.5 pb-3.5 pt-0">
              <Input
                value={line.note ?? ""}
                onChange={(event) => setNote(line.productId, event.target.value)}
                placeholder="ملاحظة اختيارية (مثلاً: حجم أصغر)"
                aria-label={`ملاحظة على ${line.name}`}
                className="h-9 rounded-xl border-white/5 bg-background/50 text-[11px] font-medium focus-visible:ring-primary/30"
              />
            </div>
          </li>
        ))}
      </ul>


      <section className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-base font-bold">ملخص الطلب</h2>

        <div className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">منطقة التوصيل</p>
          <ZonePicker />
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>إجمالي المنتجات</dt>
            <dd className="price font-semibold">{formatPrice(totals.itemsTotal)}</dd>
          </div>
          {totals.discountTotal > 0 ? (
            <div className="flex justify-between text-success">
              <dt>وفّرت</dt>
              <dd className="price font-semibold">{formatPrice(totals.discountTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>رسوم التوصيل</dt>
            <dd className="price font-semibold">
              {zone ? (totals.deliveryFee > 0 ? formatPrice(totals.deliveryFee) : "مجانًا") : "اختار منطقتك الأول"}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base">
            <dt className="font-bold">الإجمالي</dt>
            <dd className="price font-extrabold text-primary">{formatPrice(totals.grandTotal)}</dd>
          </div>
        </dl>

        {zone && totals.freeDeliveryRemaining != null && totals.freeDeliveryRemaining > 0 ? (
          <div className="mt-3">
            <p className="price text-xs text-muted-foreground">
              لسه فاضلك {formatPrice(totals.freeDeliveryRemaining)} للتوصيل المجاني
            </p>
            <Progress
              className="mt-1"
              value={
                zone.freeDeliveryThreshold
                  ? Math.min(100, (totals.itemsTotal / zone.freeDeliveryThreshold) * 100)
                  : 0
              }
            />
          </div>
        ) : null}

        {zone && !enoughForMinimum ? (
          <p className="price mt-3 rounded-lg bg-accent-soft p-2 text-xs text-accent-foreground">
            الحد الأدنى للطلب في {zone.name} هو {formatPrice(zone.minimumOrder)}.
          </p>
        ) : null}

        <Button className="mt-4 w-full" size="lg" disabled={allOut || !enoughForMinimum} asChild={!allOut && enoughForMinimum}>
          {!allOut && enoughForMinimum ? <Link to="/checkout">كمّل الطلب</Link> : <span>كمّل الطلب</span>}
        </Button>
        {allOut ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            كل المنتجات اللي في السلة مش متاحة دلوقتي.
          </p>
        ) : null}
      </section>

      {suggestions.data?.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">ممكن تكون محتاجها كمان</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {suggestions.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
