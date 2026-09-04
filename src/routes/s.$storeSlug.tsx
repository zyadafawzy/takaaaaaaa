import { createFileRoute, Link, Outlet, notFound, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingBasket, Phone, MapPin, Clock, Moon, Sun, SearchX, TriangleAlert } from "lucide-react";

import { getStore } from "@/lib/stores.functions";
import { brandingCssVars } from "@/lib/store-theme";
import { isFeatureOn } from "@/lib/store-features";
import { Button } from "@/components/ui/button";
import { StoreMaintenance } from "@/components/store/StoreMaintenance";
import { useCart } from "@/lib/cart";
import { ZoneProvider } from "@/lib/zone";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/s/$storeSlug")({
  loader: async ({ params }) => {
    const result = await getStore({ data: { slug: params.storeSlug } });
    if (!result.store) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    const store = loaderData?.store;
    const title = store ? `${store.name} — طلبات أونلاين` : "سوبرماركت غير متاح";
    const description =
      store?.description || "اطلب احتياجات بيتك أونلاين وأكّد طلبك على واتساب في دقيقة.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(store
          ? [
              { name: "theme-color", content: store.branding?.primaryColor || "#1f6b3b" },
              { name: "apple-mobile-web-app-capable", content: "yes" },
              { name: "apple-mobile-web-app-title", content: store.name.slice(0, 12) },
            ]
          : [{ name: "robots", content: "noindex" }]),
      ],
      // تسطيب PWA خاص بالسوبرماركت ده: الأيقونة بتفتح /s/<slug> مش الصفحة الرئيسية.
      links: store
        ? [
            { rel: "manifest", href: `/api/public/store-manifest/${store.slug}` },
            ...(store.logoPath || store.logoUrl
              ? [{ rel: "apple-touch-icon", href: `/api/public/store-logo/${store.id}` }]
              : []),
          ]
        : [],

    };
  },

  errorComponent: () => (
    <StoreMessage
      icon="error"
      title="حصلت مشكلة"
      body="مقدرناش نفتح السوبرماركت ده دلوقتي. جرّب تحدّث الصفحة."
      showRetry
    />
  ),
  notFoundComponent: () => (
    <StoreMessage
      icon="missing"
      title="السوبرماركت مش موجود"
      body="الرابط ده مش مربوط بأي سوبرماركت نشط. اتأكد من الرابط أو ارجع للصفحة الرئيسية."
    />
  ),
  component: StoreLayout,
});

function StoreMessage({
  title,
  body,
  icon = "missing",
  showRetry = false,
}: {
  title: string;
  body: string;
  icon?: "missing" | "error";
  showRetry?: boolean;
}) {
  const Icon = icon === "error" ? TriangleAlert : SearchX;
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden p-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 start-1/2 size-[26rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-surface/70 p-8 shadow-xl backdrop-blur-xl">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10">
          <Icon className="size-8 text-primary" />
        </span>
        <h1 className="mt-5 text-xl font-black">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {showRetry ? (
            <Button className="rounded-xl" onClick={() => window.location.reload()}>
              حدّث الصفحة
            </Button>
          ) : null}
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/">الرئيسية</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function StoreLayout() {
  const { store } = Route.useLoaderData();
  if (!store) return null;
  if (store.is_maintenance) {
    return <StoreMaintenance store={store} />;
  }
  return (
    <ZoneProvider zones={store.zones} scope={`store-${store.slug}`}>
      <StoreShell />
    </ZoneProvider>
  );
}

function StoreShell() {
  const { store } = Route.useLoaderData();
  const { count, subtotal } = useCart();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const storeSlug = store?.slug ?? "";
  const preferredMode = store?.branding.colorMode ?? "light";
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAdminArea = pathname.includes(`/s/${storeSlug}/admin`);

  useEffect(() => {
    const saved = window.localStorage.getItem(`store-mode-${storeSlug}`);
    if (saved === "light" || saved === "dark") {
      setMode(saved);
      return;
    }
    if (preferredMode === "dark") setMode("dark");
    else if (preferredMode === "system") {
      setMode(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, [storeSlug, preferredMode]);

  if (!store) return null;
  const darkModeOn = isFeatureOn(store.features, "darkMode");

  const headerStyle = store.branding.headerStyle ?? "classic";
  const headerClass =
    headerStyle === "bold"
      ? "sticky top-0 z-40 border-b border-border bg-primary text-primary-foreground"
      : headerStyle === "minimal"
        ? "sticky top-0 z-40 bg-background"
        : "sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-xl";

  if (isAdminArea) {
    return (
      <div
        style={brandingCssVars(store.branding, mode) as React.CSSProperties}
        className={`min-h-screen bg-background text-foreground ${mode === "dark" ? "dark" : ""}`}
      >
        <Outlet />
      </div>
    );
  }

  return (
    <div
      style={brandingCssVars(store.branding, mode) as React.CSSProperties}
      className={`min-h-screen bg-background text-foreground ${mode === "dark" ? "dark" : ""}`}
    >
      {store.announcement ? (
        <div className="bg-primary px-4 py-2 text-center text-xs font-bold text-primary-foreground">
          {store.announcement}
        </div>
      ) : null}

      <header className={headerClass}>
        <div
          className={`mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6 ${
            headerStyle === "centered" ? "justify-center text-center" : ""
          }`}
        >
          <Link
            to="/s/$storeSlug"
            params={{ storeSlug: store.slug }}
            className="flex items-center gap-2.5"
          >
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={store.name}
                width={40}
                height={40}
                className="size-10 rounded-xl object-cover"
              />
            ) : (
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground">
                {store.name.slice(0, 1)}
              </span>
            )}
            <span className="text-base font-black leading-tight">{store.name}</span>
          </Link>

          <div className="ms-auto flex items-center gap-2">
            {darkModeOn ? (
              <Button
                variant="ghost"
                size="sm"
                className="size-10 rounded-xl p-0"
                aria-label={mode === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
                onClick={() => {
                  const next = mode === "dark" ? "light" : "dark";
                  setMode(next);
                  window.localStorage.setItem(`store-mode-${store.slug}`, next);
                }}
              >
                {mode === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </Button>
            ) : null}
            {store.whatsappNumber ? (
              <Button variant="ghost" size="sm" asChild className="hidden gap-1.5 sm:flex">
                <a
                  href={`https://wa.me/${store.whatsappNumber.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Phone className="size-4" /> تواصل
                </a>
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" asChild className="h-10 gap-2 rounded-xl px-3">
              <Link
                to="/s/$storeSlug/cart"
                params={{ storeSlug: store.slug }}
                aria-label={`السلة، ${count} عنصر`}
              >
                <ShoppingBasket className="size-5 text-primary" />
                <span className="price text-xs font-bold">{formatPrice(subtotal)}</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-10 border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-8 text-sm text-muted-foreground md:grid-cols-3 md:px-6">
          <div>
            <p className="font-bold text-foreground">{store.name}</p>
            <p className="mt-1 leading-relaxed">{store.description}</p>
          </div>
          {store.address ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              {store.address}
              {store.governorate ? ` — ${store.governorate}` : ""}
            </p>
          ) : null}
          {store.businessHours ? (
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              {store.businessHours}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 md:col-span-3">
            {store.phone ? <a href={`tel:${store.phone}`} className="hover:text-primary">{store.phone}</a> : null}
            {store.settings.contactEmail ? (
              <a href={`mailto:${store.settings.contactEmail}`} className="hover:text-primary">
                {store.settings.contactEmail}
              </a>
            ) : null}
            {store.settings.facebookUrl ? (
              <a href={store.settings.facebookUrl} target="_blank" rel="noreferrer" className="hover:text-primary">
                فيسبوك
              </a>
            ) : null}
            {store.settings.instagramUrl ? (
              <a href={store.settings.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-primary">
                إنستجرام
              </a>
            ) : null}
            {store.settings.tiktokUrl ? (
              <a href={store.settings.tiktokUrl} target="_blank" rel="noreferrer" className="hover:text-primary">
                تيك توك
              </a>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
