import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, MessageCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { ordersAdapter } from "@/services/orders-adapter";
import { getOrderWhatsapp } from "@/lib/orders.functions";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/States";

export const Route = createFileRoute("/s/$storeSlug/order/$token")({
  head: () => ({
    meta: [
      { title: "طلبك اتسجل مبدئيًا" },
      { name: "description", content: "ملخص طلبك وخطوة التأكيد على واتساب." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "تأكيد الطلب" },
      { property: "og:description", content: "ملخص طلبك وخطوة التأكيد على واتساب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorePendingOrderPage,
});

function StorePendingOrderPage() {
  const { storeSlug, token } = Route.useParams();
  const { store } = useLoaderData({ from: "/s/$storeSlug" });
  const [showPreview, setShowPreview] = useState(false);

  const orderQuery = useQuery({
    queryKey: ["store-order", token],
    queryFn: () => ordersAdapter.getOrderByToken(token),
  });
  const waQuery = useQuery({
    queryKey: ["store-order", token, "whatsapp"],
    queryFn: () => getOrderWhatsapp({ data: { token } }),
  });

  if (orderQuery.isLoading || waQuery.isLoading) {
    return (
      <div className="mx-auto max-w-xl px-3 py-8 md:px-6">
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const order = orderQuery.data;
  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-3 py-8 md:px-6">
        <EmptyState
          title="مالقيناش الطلب ده"
          description="اللينك ممكن يكون قديم أو من جهاز تاني."
          action={
            <Button asChild>
              <Link to="/s/$storeSlug" params={{ storeSlug }}>
                الرجوع للمتجر
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const message = waQuery.data?.message ?? "";
  const waUrl = waQuery.data?.url ?? "";

  return (
    <div className="mx-auto max-w-xl px-3 py-6 md:px-6">
      <h1 className="text-2xl font-extrabold">طلبك اتسجل مبدئيًا</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ابعت الرسالة على واتساب عشان {store?.name ?? "المتجر"} يأكد معاك. الطلب لسه{" "}
        <strong>مش مؤكد</strong> لحد ما نستلم رسالتك.
      </p>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">رقم الطلب</span>
          <span className="font-bold">{order.number}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-muted-foreground">الإجمالي</span>
          <span className="price font-extrabold text-primary">{formatPrice(order.totals.grandTotal)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {waUrl ? (
          <Button
            className="w-full gap-2"
            size="lg"
            asChild
            onClick={() => void ordersAdapter.markWhatsappOpened(token)}
          >
            <a href={waUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="size-5" /> أكّد على واتساب
            </a>
          </Button>
        ) : null}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={async () => {
            await navigator.clipboard.writeText(message);
            toast.success("نسخنا الرسالة");
          }}
        >
          <Copy className="size-4" /> انسخ الرسالة
        </Button>

        <Button variant="ghost" className="w-full gap-2" onClick={() => setShowPreview((v) => !v)}>
          <Eye className="size-4" /> {showPreview ? "إخفاء" : "عرض"} نص الرسالة
        </Button>

        {showPreview ? (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-surface p-3 text-xs">
            {message}
          </pre>
        ) : null}

        <Button variant="secondary" className="w-full" asChild>
          <Link to="/s/$storeSlug/track/$token" params={{ storeSlug, token }}>
            متابعة الطلب
          </Link>
        </Button>
      </div>
    </div>
  );
}
