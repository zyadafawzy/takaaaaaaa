import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Phone, MessageCircle, Navigation, PackageCheck, Truck, Clock } from "lucide-react";

import { storeAdminOrders, storeAdminUpdateOrderStatus } from "@/lib/store-admin.functions";
import { formatDateTimeAr, formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/s/$storeSlug/admin/delivery")({
  head: () => ({
    meta: [
      { title: "شاشة مسؤول التوصيل" },
      { name: "description", content: "قائمة الطلبات الجاهزة والخارجة للتوصيل بعناوين وأرقام العملاء." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "شاشة مسؤول التوصيل" },
      { property: "og:description", content: "تابع الطلبات الخارجة للتوصيل وسلّمها في ضغطة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreDeliveryBoard,
});

const lanes = [
  { key: "preparing", label: "بيتجهّز", icon: Clock },
  { key: "out_for_delivery", label: "خارج للتوصيل", icon: Truck },
  { key: "delivered", label: "اتسلّم", icon: PackageCheck },
] as const;

type Lane = (typeof lanes)[number]["key"];

function digits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function StoreDeliveryBoard() {
  const { storeSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const [lane, setLane] = useState<Lane>("preparing");

  const query = useQuery({
    queryKey: ["store-admin", storeSlug, "delivery", lane],
    queryFn: () => storeAdminOrders({ data: { storeSlug, status: lane, limit: 50 } }),
    retry: false,
    refetchInterval: 30_000,
  });

  const update = useMutation({
    mutationFn: (input: { token: string; status: Lane }) =>
      storeAdminUpdateOrderStatus({ data: { storeSlug, ...input } }),
    onSuccess: () => {
      toast.success("حدّثنا حالة التوصيل");
      void queryClient.invalidateQueries({ queryKey: ["store-admin", storeSlug] });
    },
    onError: () => toast.error("مقدرناش نحدّث الطلب"),
  });

  const orders = query.data?.orders ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">شاشة مسؤول التوصيل</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          الطلبات دي بتظهر هنا بس — العميل بيشوف تتبّع طلبه هو فقط.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {lanes.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={lane === item.key ? "default" : "outline"}
            className="gap-1.5 rounded-full"
            onClick={() => setLane(item.key)}
          >
            <item.icon className="size-4" />
            {item.label}
          </Button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          مش عندك صلاحية على طلبات المتجر ده.
        </p>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          مفيش طلبات في المرحلة دي دلوقتي.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {orders.map((order) => {
            const address = [order.street, order.building, order.landmark]
              .filter((part) => Boolean(part && String(part).trim()))
              .join(" — ");
            const mapQuery = encodeURIComponent(
              [address, order.zone, order.governorate].filter(Boolean).join(" "),
            );
            const wa = digits(order.whatsapp) || digits(order.phone);
            return (
              <li
                key={order.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{order.number}</p>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTimeAr(order.createdAt)}
                  </span>
                  <span className="price ms-auto font-extrabold text-primary">
                    {formatPrice(order.total)}
                  </span>
                </div>

                <p className="mt-2 text-sm font-bold">{order.customer}</p>
                <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    {order.fulfillment === "pickup"
                      ? "استلام من الفرع"
                      : [address, order.zone, order.governorate].filter(Boolean).join(" • ") || "—"}
                  </span>
                </p>
                {order.notes ? (
                  <p className="mt-1 rounded-xl bg-muted/50 p-2 text-xs text-muted-foreground">
                    ملاحظة العميل: {order.notes}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  التوصيل: <span className="price">{formatPrice(order.deliveryFee)}</span>
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" asChild>
                    <a href={`tel:${order.phone}`}>
                      <Phone className="size-4" /> اتصل
                    </a>
                  </Button>
                  {wa ? (
                    <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" asChild>
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-4" /> واتساب
                      </a>
                    </Button>
                  ) : null}
                  {order.fulfillment !== "pickup" ? (
                    <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" asChild>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Navigation className="size-4" /> الخريطة
                      </a>
                    </Button>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  {lane !== "out_for_delivery" ? (
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-xl"
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({ token: order.token, status: "out_for_delivery" })
                      }
                    >
                      <Truck className="size-4" /> خرج للتوصيل
                    </Button>
                  ) : null}
                  {lane !== "delivered" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 rounded-xl"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ token: order.token, status: "delivered" })}
                    >
                      <PackageCheck className="size-4" /> اتسلّم
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
