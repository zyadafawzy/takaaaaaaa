import { createFileRoute } from "@tanstack/react-router";

import { PendingSyncPanel } from "@/components/pos/PendingSyncPanel";

export const Route = createFileRoute("/pos/pending")({
  head: () => ({
    meta: [
      { title: "المعلّقة للرفع | تِكّة" },
      {
        name: "description",
        content: "مراجعة فواتير وعمليات الكاشير المتأخرة عن الرفع مع إعادة المحاولة أو الحذف اليدوي.",
      },
      { property: "og:title", content: "المعلّقة للرفع | تِكّة" },
      { property: "og:description", content: "طابور الفواتير والعمليات الأوفلاين وحالة رفعها على السيرفر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PendingPage,
});

export function PendingPage() {
  return <PendingSyncPanel />;
}
