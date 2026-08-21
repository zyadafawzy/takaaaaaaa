import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StaticPage } from "@/components/layout/StaticPage";
import { catalogRepository } from "@/services/catalog-repository";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "سياسة التوصيل — تِكّة" },
      { name: "description", content: "مناطق التوصيل ورسومها والحد الأدنى للطلب كما هي في إعدادات المتجر." },
      { property: "og:title", content: "سياسة التوصيل — تِكّة" },
      { property: "og:description", content: "مناطق التوصيل والرسوم والحد الأدنى." },
    ],
  }),
  component: DeliveryPolicyPage,
});

function DeliveryPolicyPage() {
  const { data, isLoading } = useQuery({ queryKey: ["zones"], queryFn: () => catalogRepository.listZones() });

  return (
    <StaticPage
      title="سياسة التوصيل"
      intro="الرسوم والحد الأدنى تظهر من إعدادات المتجر، ولا نذكر مدة توصيل قبل توفر بيانات حقيقية."
    >
      <div className="flex items-center gap-2">
        <p className="font-semibold">مناطق التوصيل</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data?.map((zone) => (
            <li key={zone.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="font-medium">
                {zone.governorate} — {zone.name}
              </span>
              <span className="price text-xs text-muted-foreground">
                رسوم {formatPrice(zone.fee)} · حد أدنى {formatPrice(zone.minimumOrder)}
                {zone.freeDeliveryThreshold ? ` · توصيل مجاني من ${formatPrice(zone.freeDeliveryThreshold)}` : ""}
              </span>
              {!zone.available ? <span className="text-xs text-destructive">مش متاح دلوقتي</span> : null}
            </li>
          ))}
        </ul>
      )}

      <p>الدفع كاش عند الاستلام في هذا الإصدار. أي وسيلة دفع أخرى ستظهر عند تفعيلها.</p>
      <p>لا يبدأ تجهيز الطلب قبل تأكيده معك على واتساب.</p>
    </StaticPage>
  );
}
