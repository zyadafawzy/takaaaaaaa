import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ordersAdapter } from "@/services/orders-adapter";
import type { Order, OrderStatus } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/States";
import { formatDateTimeAr } from "@/lib/format";

export const Route = createFileRoute("/track/$token")({
  head: () => ({
    meta: [
      { title: "متابعة الطلب — تِكّة" },
      { name: "description", content: "تحقق سريع بآخر 4 أرقام من موبايلك عشان تشوف حالة طلبك." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "متابعة الطلب في تِكّة" },
      { property: "og:description", content: "حالة طلبك بعد تحقق بسيط." },
    ],
  }),
  component: TrackPage,
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

function TrackPage() {
  const { token } = Route.useParams();
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
      setError("مالقيناش طلب باللينك ده على الجهاز ده.");
      return;
    }
    if (!found.customer.phone.endsWith(digits.trim()) || digits.trim().length !== 4) {
      setError("الأرقام مش مطابقة. اكتب آخر 4 أرقام من موبايلك.");
      return;
    }
    setOrder(found);
  };

  return (
    <div className="mx-auto max-w-md px-3 py-8 md:px-6">
      <h1 className="mb-1 text-2xl font-extrabold">متابعة الطلب</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        للأمان، بنسأل على آخر 4 أرقام من موبايلك قبل ما نعرض حالة الطلب. التحقق النهائي على الخادم هيتفعّل مع
        ربط النظام السحابي.
      </p>

      {!order ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="digits">آخر 4 أرقام من الموبايل</Label>
            <Input
              id="digits"
              inputMode="numeric"
              maxLength={4}
              value={digits}
              onChange={(event) => setDigits(event.target.value.replace(/\D/g, ""))}
              className="mt-1"
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={verify} disabled={checking || digits.length !== 4}>
            {checking ? "بنتأكد..." : "اعرض حالة الطلب"}
          </Button>
          <EmptyState
            title="مش لاقي طلبك؟"
            description="اللينك بيشتغل على الجهاز اللي عملت منه الطلب. لو محتاج مساعدة كلمنا على واتساب."
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="price font-bold">{order.number}</span>
          </div>
          <p className="text-sm">
            الحالة: <strong>{statusText[order.status]}</strong>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">اتسجل: {formatDateTimeAr(order.createdAt)}</p>
          <Button variant="outline" className="mt-4 w-full" asChild>
            <Link to="/">ارجع للرئيسية</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
