import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { ordersAdapter } from "@/services/orders-adapter";
import { catalogRepository } from "@/services/catalog-repository";
import { getOrderWhatsapp } from "@/lib/orders.functions";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/States";

export const Route = createFileRoute("/order/pending/$token")({
  head: () => ({
    meta: [
      { title: "طلبك اتسجل مبدئيًا — تِكّة" },
      { name: "description", content: "ملخص طلبك وخطوة التأكيد على واتساب." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "تأكيد الطلب في تِكّة" },
      { property: "og:description", content: "ملخص طلبك وخطوة التأكيد على واتساب." },
    ],
  }),
  component: PendingOrderPage,
});

import { useState } from "react";

function PendingOrderPage() {
  const [showPreview, setShowPreview] = useState(false);
  const { token } = Route.useParams();

  const orderQuery = useQuery({
    queryKey: ["order", token],
    queryFn: () => ordersAdapter.getOrderByToken(token),
  });
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: () => catalogRepository.getSettings() });
  const waQuery = useQuery({
    queryKey: ["order", token, "whatsapp"],
    queryFn: () => getOrderWhatsapp({ data: { token } }),
  });

  if (orderQuery.isLoading || settingsQuery.isLoading || waQuery.isLoading) {
    return (
      <div className="mx-auto max-w-xl px-3 py-8 md:px-6">
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const order = orderQuery.data;
  const settings = settingsQuery.data;

  if (!order || !settings) {
    return (
      <div className="mx-auto max-w-xl px-3 py-8 md:px-6">
        <EmptyState
          title="مالقيناش الطلب ده"
          description="اللينك ممكن يكون قديم أو من جهاز تاني. ابدأ طلب جديد أو كلمنا."
          action={
            <Button asChild>
              <Link to="/">الرئيسية</Link>
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
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-2xl font-extrabold">طلبك اتسجل عندنا مبدئيًا</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        ابعت الرسالة على واتساب عشان نأكد معاك. الطلب لسه <strong>مش مؤكد</strong> لحد ما نستلم رسالتك.
      </p>

      <div className="mt-5 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">رقم الطلب</span>
          <span className="price font-bold">{order.number}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">الحالة</span>
          <span className="font-semibold text-accent-foreground">بانتظار رسالة واتساب</span>
        </div>
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          {order.lines.map((line) => (
            <li key={line.productId} className="flex justify-between gap-2">
              <span className="truncate">
                {line.name} × {line.quantity}
              </span>
              <span className="price">{formatPrice(line.unitPrice * line.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-bold">
          <span>الإجمالي</span>
          <span className="price text-primary">{formatPrice(order.totals.grandTotal)}</span>
        </div>
      </div>

      <Button
        size="lg"
        className="mt-5 w-full gap-2"
        asChild
        onClick={() => void ordersAdapter.markWhatsappOpened(order.token)}
      >
        <a href={waUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="size-5" />
          كمّل تأكيدك على واتساب
        </a>
      </Button>

      <Button
        variant="outline"
        className="mt-2 w-full gap-2"
        onClick={async () => {
          await navigator.clipboard.writeText(message);
          toast.success("نسخنا الرسالة");
        }}
      >
        <Copy className="size-4" />
        نسخ الرسالة
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full gap-2 text-muted-foreground"
        onClick={() => setShowPreview(!showPreview)}
      >
        <Eye className="size-4" />
        {showPreview ? "إخفاء معاينة الرسالة" : "معاينة الرسالة كما ستظهر في واتساب"}
      </Button>

      {showPreview && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-[#E4DCD4] shadow-inner">
          <div className="bg-[#075E54] px-4 py-2 text-white text-xs font-bold">
            معاينة WhatsApp
          </div>
          <div className="p-4">
            <div className="relative max-w-[85%] rounded-lg bg-white p-3 text-[13px] leading-relaxed text-black shadow-sm after:absolute after:top-0 after:right-[-8px] after:h-0 after:w-0 after:border-t-[10px] after:border-l-[10px] after:border-t-white after:border-l-transparent">
              <pre className="whitespace-pre-wrap font-sans">
                {message.split('\n').map((line, i) => {
                  let formatted = line;
                  // Handle Bold
                  formatted = formatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
                  // Handle Monospace
                  formatted = formatted.replace(/```(.*?)```/g, '<code class="bg-muted px-1 rounded font-mono text-[12px]">$1</code>');
                  return (
                    <span 
                      key={i} 
                      dangerouslySetInnerHTML={{ __html: formatted + (i < message.split('\n').length - 1 ? '<br/>' : '') }}
                    />
                  );
                })}
              </pre>
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        لو قفلت واتساب قبل ما تبعت الرسالة، الطلب لسه مش مؤكد. تقدر ترجع للصفحة دي من نفس اللينك.
      </p>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        <Link to="/track/$token" params={{ token: order.token }} className="text-primary underline">
          متابعة الطلب
        </Link>
      </p>
    </div>
  );
}
