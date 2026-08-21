import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { catalogRepository } from "@/services/catalog-repository";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/delivery")({
  component: AdminDelivery,
});

function AdminDelivery() {
  const zonesQuery = useQuery({ queryKey: ["zones"], queryFn: () => catalogRepository.listZones() });
  const zones = zonesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">مناطق التوصيل</h1>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs">
            <tr>
              <th className="p-3 text-start">المنطقة</th>
              <th className="p-3 text-start">المحافظة</th>
              <th className="p-3 text-start">رسوم</th>
              <th className="p-3 text-start">حد أدنى</th>
              <th className="p-3 text-start">توصيل مجاني من</th>
              <th className="p-3 text-start">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {zones.map((zone) => (
              <tr key={zone.id}>
                <td className="p-3 font-medium">{zone.name}</td>
                <td className="p-3 text-muted-foreground">{zone.governorate}</td>
                <td className="p-3">{formatPrice(zone.fee)}</td>
                <td className="p-3">{formatPrice(zone.minimumOrder)}</td>
                <td className="p-3">{zone.freeDeliveryThreshold ? formatPrice(zone.freeDeliveryThreshold) : "—"}</td>
                <td className="p-3">{zone.available ? "متاحة" : "موقوفة"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
