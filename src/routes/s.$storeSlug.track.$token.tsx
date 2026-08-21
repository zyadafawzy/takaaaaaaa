import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ordersAdapter } from "@/services/orders-adapter";
import type { Order, OrderStatus } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/States";
import { formatDateTimeAr, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/s/$storeSlug/track/$token")({
  head: () => ({
    meta: [
      { title: "متابعة الطلب" },
      { name: "description", content: "تحقق سريع بآخر 4 أرقام من موبايلك عشان تشوف حالة طلبك." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "متابعة الطلب" },
      { property: "og:description", content: "حالة طلبك بعد تحقق بسيط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreTrackPage,
});

const statusText: Record<OrderStatus, string> = {
  new: "استلمنا الطلب وبنراجعه",
  awaiting_whatsapp: "بانتظار رسالة واتساب",
  needs_call: "محتاجين نكلمك",
  preparing: "بنجهّز الطلب",
  out_for_delivery: "خارج للتوصيل",
  delivered: "اتسلّم",
  cancelled: "اتلغى",
};

function StoreTrackPage() {
  const { storeSlug, token } = Route.useParams();
  const [digits, setDigits] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const verify = async () => {
    setChecking(true);
    setError("");
    const found = await ordersAdapter.getOrderByToken(token);
    setChecking(false);
    if (!found) {
      setError("مالقيناش طلب باللينك ده.");
      return;
    }
    if (digits.trim().length !== 4 || !found.customer.phone.endsWith(digits.trim())) {
      setError("الأرقام مش مطابقة لرقم الطلب.");
      return;
    }
    setOrder(found);
  };

  if (!order) {
    return (
      <div className="mx-auto max-w-md px-3 py-8 md:px-6">
        <h1 className="text-2xl font-extrabold">متابعة الطلب</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          اكتب آخر 4 أرقام من موبايلك عشان نتأكد إنك صاحب الطلب.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="digits">آخر 4 أرقام</Label>
            <Input
              id="digits"
              inputMode="numeric"
              maxLength={4}
              value={digits}
              onChange={(e) => setDigits(e.target.value)}
              className="mt-1 text-center text-lg tracking-widest"
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={verify} disabled={checking}>
            {checking ? "بنتأكد..." : "اعرض حالة الطلب"}
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/s/$storeSlug" params={{ storeSlug }}>
              الرجوع للمتجر
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-3 py-6 md:px-6">
      <h1 className="text-2xl font-extrabold">طلب {order.number}</h1>
      <p className="mt-1 text-sm font-bold text-primary">{statusText[order.status]}</p>

      <ul className="mt-4 space-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
        {order.lines.map((line) => (
          <li key={`${line.name}-${line.size}`} className="flex justify-between gap-2">
            <span>
              {line.name} × {line.quantity}
            </span>
            <span className="price font-semibold">{formatPrice(line.unitPrice * line.quantity)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-border pt-2 text-base font-bold">
          <span>الإجمالي</span>
          <span className="price text-primary">{formatPrice(order.totals.grandTotal)}</span>
        </li>
      </ul>

      <ol className="mt-4 space-y-2 text-sm">
        {order.events.map((event) => (
          <li key={`${event.at}-${event.label}`} className="rounded-lg border border-border bg-surface p-3">
            <p className="font-semibold">{event.label}</p>
            <p className="text-xs text-muted-foreground">{formatDateTimeAr(event.at)}</p>
          </li>
        ))}
      </ol>

      <Button variant="ghost" className="mt-4 w-full" asChild>
        <Link to="/s/$storeSlug" params={{ storeSlug }}>
          الرجوع للمتجر
        </Link>
      </Button>
    </div>
  );
}
