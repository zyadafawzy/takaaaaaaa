import { Outlet, createFileRoute } from "@tanstack/react-router";

import { PosShell } from "@/components/pos/PosShell";

export const Route = createFileRoute("/pos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "نقاط البيع | تِكّة" },
      { name: "description", content: "شاشة كاشير تِكّة: مسح باركود، فواتير، ورديات، مخزون وتقارير للسوبرماركت." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "نقاط البيع | تِكّة" },
      { property: "og:description", content: "نظام كاشير كامل لإدارة البيع والمخزون في السوبرماركت." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PosLayout,
  errorComponent: () => (
    <div className="p-10 text-center">
      <h1 className="text-xl font-bold">حصلت مشكلة في شاشة الكاشير</h1>
      <p className="text-muted-foreground">جرّب تحديث الصفحة تاني.</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">الصفحة مش موجودة.</div>,
});

function PosLayout() {
  return (
    <PosShell>
      <Outlet />
    </PosShell>
  );
}
