import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, MapPin, Phone, MessageCircle, Package } from "lucide-react";
import { storeAdminOrders, storeAdminUpdateOrderStatus } from "@/lib/store-admin.functions";
import { formatDateTimeAr, formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/s/$storeSlug/admin/orders")({
  component: StoreAdminOrders,
});

const statuses = [
  { value: "new", label: "جديد" },
  { value: "awaiting_whatsapp", label: "بانتظار واتساب" },
  { value: "needs_call", label: "محتاج مكالمة" },
  { value: "preparing", label: "بيتجهّز" },
  { value: "out_for_delivery", label: "خارج للتوصيل" },
  { value: "delivered", label: "اتسلّم" },
  { value: "cancelled", label: "ملغي" },
] as const;

type StatusValue = (typeof statuses)[number]["value"];

type OrderItem = {
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note: string;
};

const statusTone: Record<StatusValue, string> = {
  new: "bg-primary/10 text-primary",
  awaiting_whatsapp: "bg-amber-500/15 text-amber-600",
  needs_call: "bg-destructive/10 text-destructive",
  preparing: "bg-muted text-foreground",
  out_for_delivery: "bg-blue-500/15 text-blue-600",
  delivered: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-muted text-muted-foreground line-through",
};

function digits(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function StoreAdminOrders() {
  const { storeSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusValue | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["store-admin", storeSlug, "orders", filter],
    queryFn: () =>
      storeAdminOrders({
        data: { storeSlug, ...(filter === "all" ? {} : { status: filter }), limit: 50 },
      }),
    retry: false,
    refetchInterval: 45_000,
  });

  const update = useMutation({
    mutationFn: (input: { token: string; status: StatusValue }) =>
      storeAdminUpdateOrderStatus({ data: { storeSlug, ...input } }),
    onSuccess: () => {
      toast.success("حدّثنا حالة الطلب");
      void queryClient.invalidateQueries({ queryKey: ["store-admin", storeSlug] });
    },
    onError: () => toast.error("مش مسموح بالتعديل ده"),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">طلبات المتجر</h1>
        <div className="ms-auto w-44">
          <Select value={filter} onValueChange={(value) => setFilter(value as StatusValue | "all")}>
            <SelectTrigger aria-label="تصفية بالحالة">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {query.isLoading ? (
        <Skeleton className="mt-5 h-40 w-full rounded-2xl" />
      ) : query.isError ? (
        <p className="mt-5 rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          مش عندك صلاحية على طلبات المتجر ده.
        </p>
      ) : (query.data?.orders.length ?? 0) === 0 ? (
        <p className="mt-5 rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          مفيش طلبات في الحالة دي.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {query.data?.orders.map((order) => {
            const open = openId === order.id;
            const address = [order.street, order.building, order.landmark, order.zone]
              .filter(Boolean)
              .join(" — ");
            return (
              <li
                key={order.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-lifted"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : order.id)}
                  className="flex w-full flex-wrap items-center gap-2 p-4 text-start"
                >
                  <p className="font-extrabold">{order.number}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusTone[order.status as StatusValue]}`}
                  >
                    {statuses.find((s) => s.value === order.status)?.label ?? order.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTimeAr(order.createdAt)}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {order.items.length} صنف
                  </span>
                  <span className="price ms-auto font-extrabold text-primary">
                    {formatPrice(order.total)}
                  </span>
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-4 border-t border-border p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-muted/20 p-3 text-sm">
                          <p className="font-bold">{order.customer}</p>
                          <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                            <Phone className="size-3.5" />
                            <span dir="ltr">{order.phone}</span>
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <a href={`tel:${digits(order.phone)}`}>اتصال</a>
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={`https://wa.me/2${digits(order.whatsapp || order.phone)}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MessageCircle className="size-3.5" /> واتساب
                              </a>
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-xl bg-muted/20 p-3 text-sm">
                          <p className="flex items-center gap-2 font-bold">
                            <MapPin className="size-3.5" />
                            {order.fulfillment === "pickup" ? "استلام من الفرع" : "توصيل"}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {order.fulfillment === "pickup" ? "العميل هيستلم بنفسه" : address || "—"}
                          </p>
                          {order.notes ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              ملاحظات: {order.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-xl border border-border">
                        <p className="flex items-center gap-2 border-b border-border p-3 text-sm font-bold">
                          <Package className="size-4" /> المنتجات المطلوبة
                        </p>
                        <ul className="divide-y divide-border">
                          {(order.items as OrderItem[]).map((item, index: number) => (
                            <li
                              key={`${order.id}-${index}`}
                              className="flex items-center gap-3 p-3 text-sm"
                            >
                              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-black text-primary">
                                {item.quantity}×
                              </span>
                              <span className="flex-1">
                                <span className="font-semibold">{item.name}</span>
                                {item.size ? (
                                  <span className="text-muted-foreground"> · {item.size}</span>
                                ) : null}
                                {item.note ? (
                                  <span className="block text-xs text-muted-foreground">
                                    {item.note}
                                  </span>
                                ) : null}
                              </span>
                              <span className="price font-bold">{formatPrice(item.lineTotal)}</span>
                            </li>
                          ))}
                        </ul>
                        <dl className="space-y-1 border-t border-border p-3 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <dt>إجمالي المنتجات</dt>
                            <dd className="price">{formatPrice(order.itemsTotal)}</dd>
                          </div>
                          {order.discountTotal > 0 ? (
                            <div className="flex justify-between text-muted-foreground">
                              <dt>الخصم</dt>
                              <dd className="price">-{formatPrice(order.discountTotal)}</dd>
                            </div>
                          ) : null}
                          <div className="flex justify-between text-muted-foreground">
                            <dt>التوصيل</dt>
                            <dd className="price">{formatPrice(order.deliveryFee)}</dd>
                          </div>
                          <div className="flex justify-between text-base font-extrabold">
                            <dt>الإجمالي</dt>
                            <dd className="price text-primary">{formatPrice(order.total)}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {statuses.map((status) => (
                          <Button
                            key={status.value}
                            size="sm"
                            variant={order.status === status.value ? "default" : "outline"}
                            disabled={update.isPending}
                            onClick={() =>
                              update.mutate({ token: order.token, status: status.value })
                            }
                          >
                            {status.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
