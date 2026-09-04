import { createFileRoute } from "@tanstack/react-router";

/**
 * مانيفست PWA خاص بكل سوبرماركت.
 * لما العميل يسطّب التطبيق وهو جوا /s/<slug> بيتسطّب على المتجر ده بس:
 * start_url و scope و id كلهم على مسار المتجر، فالأيقونة بتفتح المتجر
 * مباشرة مش صفحة تِكّة الرئيسية.
 */

const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/i;

function safeColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

export const Route = createFileRoute("/api/public/store-manifest/$storeSlug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params.storeSlug;
        if (!SLUG.test(slug)) return new Response("bad request", { status: 400 });

        const { loadStoreBySlug } = await import("@/lib/stores.server");
        const store = await loadStoreBySlug(slug);
        if (!store) return new Response("not found", { status: 404 });

        const base = `/s/${store.slug}`;
        const themeColor = safeColor(store.branding?.primaryColor, "#1f6b3b");
        const backgroundColor = safeColor(store.branding?.backgroundColor, "#faf8f2");

        const icons: Array<Record<string, string>> = [];
        if (store.logoPath || store.logoUrl) {
          icons.push({
            src: `/api/public/store-logo/${store.id}`,
            sizes: "any",
            type: "image/png",
            purpose: "any",
          });
        }
        icons.push(
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        );

        const manifest = {
          id: base,
          name: store.name,
          short_name: store.name.slice(0, 12),
          description: store.description || `اطلب من ${store.name} أونلاين.`,
          lang: "ar-EG",
          dir: "rtl",
          start_url: `${base}?source=pwa`,
          scope: base,
          display: "standalone",
          orientation: "portrait",
          theme_color: themeColor,
          background_color: backgroundColor,
          categories: ["shopping", "food"],
          icons,
          shortcuts: [
            { name: "المنتجات", url: base },
            { name: "السلة", url: `${base}/cart` },
            { name: "طلباتي", url: `${base}/orders` },
          ],
        };

        return new Response(JSON.stringify(manifest), {
          status: 200,
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
