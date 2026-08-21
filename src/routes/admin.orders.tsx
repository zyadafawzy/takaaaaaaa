import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ordersAdapter } from "@/services/orders-adapter";
import { adminStore } from "@/services/admin-store";
import { orderStatusLabels, orderStatusOrder, needsCall } from "@/lib/orders";
import { formatDateTimeAr, formatPrice } from "@/lib/format";
import { StatusPill } from "@/components/admin/StatusPill";
import { Input } from "@/components/ui/input";
import type { OrderStatus } from "@/domain/types";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrdersLayout,
});

function AdminOrdersLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/admin/orders") return <Outlet />;
  return <OrdersList />;
}

function OrdersList() {
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", { status, query, page }],
    queryFn: async () => ordersAdapter.listOrdersForAdmin({ 
      status, 
      query, 
      offset: page * limit, 
      limit 
    }),
  });

  const { orders, total } = ordersQuery.data ?? { orders: [], total: 0 };
  const hasMore = (page + 1) * limit < total;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">مركز الطلبات</h1>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="دوّر برقم الطلب أو التليفون"
          className="max-w-xs"
          aria-label="بحث في الطلبات"
        />
        <div className="flex flex-wrap gap-1">
          {(["all", ...orderStatusOrder] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                status === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {value === "all" ? "الكل" : orderStatusLabels[value]}
            </button>
          ))}
        </div>
      </div>

      {ordersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">بنحمّل الطلبات...</p>
      ) : (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground text-center">
              مفيش طلبات مطابقة للفلتر ده.
            </p>
          ) : (
            <ul className="space-y-2">
              {orders.map((order) => (
                <li key={order.token} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      to="/admin/orders/$token"
                      params={{ token: order.token }}
                      className="font-bold text-primary underline"
                    >
                      {order.number}
                    </Link>
                    <StatusPill status={order.status} />
                    {needsCall(order) ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                        محتاج اتصال
                      </span>
                    ) : null}
                    <span className="ms-auto font-semibold">{formatPrice(order.totals.grandTotal)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.customer.firstName} · {order.customer.phone} · {order.address.zoneName} ·{" "}
                    {formatDateTimeAr(order.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {total > limit && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-sm font-semibold disabled:opacity-50"
              >
                السابق
              </button>
              <span className="text-xs text-muted-foreground">
                صفحة {page + 1} من {Math.ceil(total / limit)}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="text-sm font-semibold disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
