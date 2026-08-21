import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { storeAdminReports } from "@/lib/store-admin.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/s/$storeSlug/admin/reports")({
  component: StoreAdminReports,
});

const statusLabels: Record<string, string> = {
  new: "جديد",
  awaiting_whatsapp: "بانتظار واتساب",
  needs_call: "محتاج اتصال",
  preparing: "بيتجهّز",
  out_for_delivery: "في الطريق",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const money = (value: number) =>
  `${value.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`;

function StoreAdminReports() {
  const { storeSlug } = Route.useParams();
  const [days, setDays] = useState(30);
  const query = useQuery({
    queryKey: ["store-admin", storeSlug, "reports", days],
    queryFn: () => storeAdminReports({ data: { storeSlug, days } }),
    retry: false,
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (query.isError) return <p className="text-sm text-destructive">مفيش صلاحية للتقارير.</p>;

  const report = query.data!;
  const maxRevenue = Math.max(1, ...report.daily.map((row) => row.revenue));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold">تقارير المتجر</h2>
        <div className="ms-auto flex gap-1">
          {[7, 30, 90].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={days === value ? "default" : "outline"}
              onClick={() => setDays(value)}
            >
              {value} يوم
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "إجمالي الطلبات", value: report.totals.orders.toString() },
          { label: "تم التسليم", value: report.totals.delivered.toString() },
          { label: "ملغي", value: report.totals.cancelled.toString() },
          { label: "الإيراد", value: money(report.totals.revenue) },
          { label: "متوسط الطلب", value: money(report.totals.averageOrder) },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-extrabold">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="font-extrabold">الإيراد اليومي</h3>
        <div className="mt-4 flex h-40 items-end gap-1">
          {report.daily.length === 0 ? (
            <p className="text-sm text-muted-foreground">مفيش بيانات في المدة دي.</p>
          ) : null}
          {report.daily.map((row) => (
            <div
              key={row.day}
              className="flex-1 rounded-t bg-primary/70"
              style={{ height: `${Math.max(4, (row.revenue / maxRevenue) * 100)}%` }}
              title={`${row.day}: ${money(row.revenue)} — ${row.orders} طلب`}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-extrabold">الطلبات حسب الحالة</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {report.statuses.map((row) => (
              <li key={row.status} className="flex justify-between">
                <span>{statusLabels[row.status] ?? row.status}</span>
                <span className="font-bold">{row.count}</span>
              </li>
            ))}
            {report.statuses.length === 0 ? (
              <li className="text-muted-foreground">مفيش طلبات.</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-extrabold">المناطق الأعلى</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {report.zones.slice(0, 10).map((row) => (
              <li key={row.zone} className="flex justify-between">
                <span>{row.zone}</span>
                <span className="font-bold">
                  {row.orders} طلب — {money(row.revenue)}
                </span>
              </li>
            ))}
            {report.zones.length === 0 ? (
              <li className="text-muted-foreground">مفيش بيانات.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="font-extrabold">أكتر المنتجات مبيعًا</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {report.topProducts.map((row) => (
            <li key={row.name} className="flex justify-between gap-3">
              <span className="truncate">{row.name}</span>
              <span className="shrink-0 font-bold">
                {row.quantity} قطعة — {money(row.revenue)}
              </span>
            </li>
          ))}
          {report.topProducts.length === 0 ? (
            <li className="text-muted-foreground">مفيش مبيعات لسه.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
