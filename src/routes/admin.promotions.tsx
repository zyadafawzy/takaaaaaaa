import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { catalogRepository } from "@/services/catalog-repository";
import { formatDateTimeAr, formatPrice, discountPercent } from "@/lib/format";

export const Route = createFileRoute("/admin/promotions")({
  component: AdminPromotions,
});

function AdminPromotions() {
  const promotionsQuery = useQuery({ queryKey: ["promotions"], queryFn: () => catalogRepository.listPromotions() });
  const promotions = promotionsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">العروض</h1>
      <p className="text-xs text-muted-foreground">نسبة الخصم محسوبة من السعرين، مش مكتوبة يدويًا.</p>
      <ul className="space-y-2">
        {promotions.map((promotion) => (
          <li key={promotion.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{promotion.title}</span>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                خصم {discountPercent(promotion.price, promotion.compareAtPrice) ?? 0}%
              </span>
              <span className="ms-auto font-semibold">{formatPrice(promotion.price)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              من {formatDateTimeAr(promotion.startsAt)} إلى {formatDateTimeAr(promotion.endsAt)} ·{" "}
              {promotion.active ? "شغّال" : "موقوف"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
