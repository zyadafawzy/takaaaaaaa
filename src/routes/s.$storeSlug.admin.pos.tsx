import { Outlet, createFileRoute } from "@tanstack/react-router";

import { PosShell } from "@/components/pos/PosShell";

export const Route = createFileRoute("/s/$storeSlug/admin/pos")({
  ssr: false,
  component: StorePosLayout,
  errorComponent: () => (
    <div className="p-10 text-center">
      <h1 className="text-xl font-bold">حصلت مشكلة في شاشة الكاشير</h1>
      <p className="text-muted-foreground">جرّب تحديث الصفحة تاني.</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">الصفحة مش موجودة.</div>,
});

function StorePosLayout() {
  const { storeSlug } = Route.useParams();
  return (
    <PosShell embedded storeSlug={storeSlug} basePath="/s/$storeSlug/admin/pos" linkParams={{ storeSlug }}>
      <Outlet />
    </PosShell>
  );
}
