import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Phone, MessageCircle } from "lucide-react";
import { ordersAdapter } from "@/services/orders-adapter";
import { catalogRepository } from "@/services/catalog-repository";
import { adminStore } from "@/services/admin-store";
import { buildOperatorUpdateMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatDateTimeAr, formatPrice } from "@/lib/format";
import { nextActions, orderStatusLabels } from "@/lib/orders";
import { StatusPill } from "@/components/admin/StatusPill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/lib/auth/admin-auth";
import type { Order } from "@/domain/types";

export const Route = createFileRoute("/admin/orders/$token")({
  component: AdminOrderDetail,
});

function AdminOrderDetail() {
  const { token } = Route.useParams();
  const { user, allowed } = useAdminAuth();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<Order | null>(null);
  const [notes, setNotes] = useState("");

  const orderQuery = useQuery({
    queryKey: ["admin", "order", token],
    queryFn: async () => {
      const found = await ordersAdapter.getOrderForAdmin(token);
      return found ? (adminStore.applyPatches([found])[0] ?? null) : null;
    },
  });
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: () => catalogRepository.getSettings() });

  useEffect(() => {
    if (orderQuery.data) {
      setOrder(orderQuery.data);
      setNotes(orderQuery.data.internalNotes ?? "");
    }
  }, [orderQuery.data]);

  if (orderQuery.isLoading) return <p className="text-sm text-muted-foreground">بنحمّل الطلب...</p>;
  if (!order) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-sm">
        <p>الطلب ده مش موجود.</p>
        <Link to="/admin/orders" className="mt-2 inline-block text-primary underline">
          رجوع لمركز الطلبات
        </Link>
      </div>
    );
  }

  const canUpdate = allowed("orders.update");
  const settings = settingsQuery.data;

  const refresh = (updated: Order) => {
    setOrder(updated);
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/admin/orders" className="text-xs text-primary underline">
          مركز الطلبات
        </Link>
        <h1 className="text-xl font-bold">{order.number}</h1>
        <StatusPill status={order.status} />
        <span className="ms-auto text-xs text-muted-foreground">{formatDateTimeAr(order.createdAt)}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-bold">الأصناف</h2>
            <ul className="mt-2 divide-y divide-border text-sm">
              {order.lines.map((line) => (
                <li key={line.productId} className="flex items-center gap-2 py-2">
                  <span className="font-medium">{line.name}</span>
                  <span className="text-xs text-muted-foreground">{line.size}</span>
                  <span className="ms-auto text-xs text-muted-foreground">× {line.quantity}</span>
                  <span className="w-24 text-end font-semibold">{formatPrice(line.unitPrice * line.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <Row label="المنتجات" value={formatPrice(order.totals.itemsTotal)} />
              <Row label="الخصم" value={`- ${formatPrice(order.totals.discountTotal)}`} />
              <Row label="التوصيل" value={formatPrice(order.totals.deliveryFee)} />
              <Row label="الإجمالي" value={formatPrice(order.totals.grandTotal)} strong />
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <h2 className="text-sm font-bold">بيانات التسليم</h2>
            <p className="mt-2">
              {order.customer.firstName} · {order.customer.phone}
            </p>
            <p className="text-muted-foreground">
              {order.fulfillment === "pickup"
                ? "استلام من الفرع"
                : `${order.address.zoneName} — ${order.address.street} ${order.address.building} ${order.address.landmark}`}
            </p>
            {order.address.notes ? <p className="mt-1 text-xs">ملاحظة العميل: {order.address.notes}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              سياسة البديل: {order.substitution === "substitute" ? "بديل قريب" : order.substitution === "call_me" ? "كلّمني" : "احذف الصنف"}
            </p>
            {allowed("orders.contact") ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <a href={`tel:${order.customer.phone}`}>
                    <Phone className="size-4" /> اتصال
                  </a>
                </Button>
                <Button asChild size="sm">
                  <a
                    href={buildWhatsAppUrl(
                      order.customer.whatsapp,
                      buildOperatorUpdateMessage(order, settings?.storeName ?? "تِكّة"),
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="size-4" /> واتساب
                  </a>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-bold">ملاحظات داخلية</h2>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!canUpdate}
              className="mt-2"
              rows={3}
              placeholder="مثلاً: العميل طلب التوصيل بعد 6 م"
            />
            {canUpdate ? (
              <Button size="sm" className="mt-2" onClick={() => refresh(adminStore.saveInternalNotes(order, notes))}>
                حفظ الملاحظة
              </Button>
            ) : null}
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-bold">تحديث الحالة</h2>
            {!canUpdate ? (
              <p className="mt-2 text-xs text-muted-foreground">دورك للقراءة بس.</p>
            ) : nextActions(order.status).length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">الطلب وصل لحالة نهائية.</p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {nextActions(order.status).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === "cancelled" ? "outline" : "default"}
                    onClick={() =>
                      refresh(
                        adminStore.updateStatus(
                          order,
                          status,
                          user?.name ?? "موظف",
                          `الحالة بقت: ${orderStatusLabels[status]}`,
                        ),
                      )
                    }
                  >
                    {orderStatusLabels[status]}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-bold">سجل الطلب</h2>
            <ol className="mt-2 space-y-2 text-xs">
              {order.events.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <p className="font-semibold">{event.label}</p>
                  <p className="text-muted-foreground">
                    {formatDateTimeAr(event.at)} · {event.by}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "font-bold" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
