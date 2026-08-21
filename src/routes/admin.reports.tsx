import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ordersAdapter } from "@/services/orders-adapter";
import { adminStore } from "@/services/admin-store";
import { formatCount, formatPrice } from "@/lib/format";
import { useAdminAuth } from "@/lib/auth/admin-auth";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

function AdminReports() {
  const { allowed } = useAdminAuth();
  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", { limit: 500 }],
    queryFn: async () => ordersAdapter.listOrdersForAdmin({ limit: 500 }),
  });

  if (!allowed("reports.view")) {
    return <p className="text-sm text-muted-foreground">دورك مايسمحش بالتقارير.</p>;
  }

  const { orders } = ordersQuery.data ?? { orders: [], total: 0 };
  const delivered = orders.filter((order) => order.status === "delivered");
  const cancelled = orders.filter((order) => order.status === "cancelled");
  const revenue = delivered.reduce((sum, order) => sum + order.totals.grandTotal, 0);
  const average = delivered.length ? revenue / delivered.length : 0;

  const productTally = new Map<string, { name: string; quantity: number }>();
  orders.forEach((order) =>
    order.lines.forEach((line) => {
      const current = productTally.get(line.productId) ?? { name: line.name, quantity: 0 };
      current.quantity += line.quantity;
      productTally.set(line.productId, current);
    }),
  );
  const top = [...productTally.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  const cards = [
    { label: "إجمالي الطلبات", value: formatCount(orders.length) },
    { label: "إيراد مسلّم", value: formatPrice(revenue) },
    { label: "متوسط الطلب", value: formatPrice(average) },
    {
      label: "نسبة الإلغاء",
      value: `${orders.length ? Math.round((cancelled.length / orders.length) * 100) : 0}%`,
    },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">التقارير</h1>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-lg font-bold">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">أعلى 5 أصناف طلبًا</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {top.map((item) => (
            <li key={item.name} className="flex items-center justify-between">
              <span>{item.name}</span>
              <span className="font-semibold">{formatCount(item.quantity)}</span>
            </li>
          ))}
          {top.length === 0 ? <li className="text-muted-foreground">مفيش بيانات لسه.</li> : null}
        </ul>
      </section>
    </div>
  );
}
