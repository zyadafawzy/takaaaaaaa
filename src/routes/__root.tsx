import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "@/lib/theme";
import { CartProvider } from "@/lib/cart";
import { ZoneProvider } from "@/lib/zone";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { BottomNav } from "@/components/layout/BottomNav";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-extrabold text-primary">٤٠٤</h1>
        <h2 className="mt-4 text-xl font-bold">الصفحة دي مش موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          يمكن اللينك قديم أو فيه حرف ناقص. ارجع للرئيسية أو دوّر على اللي محتاجه.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            الرئيسية
          </Link>
          <Link
            to="/search"
            search={{ q: "" }}
            className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium"
          >
            دوّر على منتج
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold">الصفحة دي مافتحتش</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          حصلت مشكلة عندنا. جرّب تحدّث الصفحة أو ارجع للرئيسية.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            جرّب تاني
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium"
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "تِكّة — سوبرماركت البيت أونلاين" },
      { name: "description", content: "اطلب خضار وفاكهة، مخبوزات، ألبان، مشروبات وأساسيات البيت من تِكّة، وأكّد طلبك على واتساب." },
      { name: "theme-color", content: "#1f6b3b" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "تِكّة" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "تِكّة — سوبرماركت البيت أونلاين" },
      { name: "twitter:title", content: "تِكّة — سوبرماركت البيت أونلاين" },
      { property: "og:description", content: "اطلب خضار وفاكهة، مخبوزات، ألبان، مشروبات وأساسيات البيت من تِكّة، وأكّد طلبك على واتساب." },
      { name: "twitter:description", content: "اطلب خضار وفاكهة، مخبوزات، ألبان، مشروبات وأساسيات البيت من تِكّة، وأكّد طلبك على واتساب." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/af146932422782a62cbd418b1e675130/id-preview-97ff49bf--fe31c636-ee2a-4f67-998e-cc2729ea4a11.lovable.app-1786600494059.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/af146932422782a62cbd418b1e675130/id-preview-97ff49bf--fe31c636-ee2a-4f67-998e-cc2729ea4a11.lovable.app-1786600494059.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700;800&family=Almarai:wght@400;700;800&family=Rubik:wght@400;500;700;800&family=Noto+Kufi+Arabic:wght@400;600;700&family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // واجهات المتاجر ولوحاتها ولوحة المطوّر مستقلة تمامًا عن هوية المنصّة الأم.
  const isStandalone =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/developer") ||
    pathname.startsWith("/pos") ||
    pathname.startsWith("/s/");

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ZoneProvider>
          <CartProvider>
            {isStandalone ? (
              <Outlet />
            ) : (
              <div className="flex min-h-screen flex-col pb-16 md:pb-0">
                <SiteHeader />
                <main className="flex-1">
                  <Outlet />
                </main>
                <SiteFooter />
                <BottomNav />
                <PwaProvider />
              </div>
            )}
            <Toaster position="top-center" richColors />
          </CartProvider>
        </ZoneProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
