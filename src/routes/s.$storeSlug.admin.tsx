import { createFileRoute, Outlet, useLoaderData } from "@tanstack/react-router";
import { StoreAdminLogin, StoreAdminShell, useStoreSession } from "@/components/store/StoreAdminShell";

export const Route = createFileRoute("/s/$storeSlug/admin")({
  head: () => ({
    meta: [
      { title: "لوحة إدارة المتجر" },
      { name: "description", content: "إدارة الطلبات والمنتجات والثيم وإعدادات متجرك." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "لوحة إدارة المتجر" },
      { property: "og:description", content: "إدارة الطلبات والمنتجات والثيم والإعدادات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreAdminLayout,
});

function StoreAdminLayout() {
  const { storeSlug } = Route.useParams();
  const { store } = useLoaderData({ from: "/s/$storeSlug" });
  const { isLoggedIn, ready } = useStoreSession(storeSlug);

  if (!ready) {
    return <div className="p-8 text-center text-sm text-muted-foreground">بنجهّز اللوحة...</div>;
  }
  
  if (!isLoggedIn) return <StoreAdminLogin storeSlug={storeSlug} storeName={store?.name ?? "المتجر"} />;

  return (
    <StoreAdminShell storeSlug={storeSlug} storeName={store?.name ?? "المتجر"} email="مسؤول المتجر">
      <Outlet />
    </StoreAdminShell>
  );
}
