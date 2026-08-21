import { createFileRoute } from "@tanstack/react-router";

/**
 * تسليم صور المنتجات المنشورة فقط، بالحجم المطلوب، من مخزن خاص.
 * الصور نفسها مش عامة — الرابط ده بيتحقق من قواعد العرض قبل أي تسليم،
 * وبيرجع صورة بحجم واحد من قائمة مسموحة عشان الموبايل ميحمّلش صور ضخمة.
 */

const ALLOWED_WIDTHS = [120, 160, 240, 360, 480, 720, 960];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pickWidth(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 360;
  return ALLOWED_WIDTHS.find((w) => w >= value) ?? ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]!;
}

export const Route = createFileRoute("/api/public/product-image/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = params.id;
        if (!UUID.test(id)) return new Response("bad request", { status: 400 });

        const url = new URL(request.url);
        const width = pickWidth(url.searchParams.get("w"));

        const { resolvePublicImage } = await import("@/lib/catalog.server");
        const image = await resolvePublicImage(id);
        if (!image) return new Response("not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const storage = supabaseAdmin.storage.from(image.bucket);

        async function fetchVariant(transform: boolean): Promise<Response | null> {
          const { data } = await storage.createSignedUrl(
            image!.path,
            120,
            transform ? { transform: { width, quality: 72, resize: "contain" } } : {},
          );
          if (!data?.signedUrl) return null;
          const res = await fetch(data.signedUrl);
          return res.ok ? res : null;
        }

        const response = (await fetchVariant(true)) ?? (await fetchVariant(false));
        if (!response) return new Response("not found", { status: 404 });

        return new Response(response.body, {
          status: 200,
          headers: {
            "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
            // الرابط بيحمل رقم نسخة الصورة، فالتخزين المؤقت الطويل آمن.
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
