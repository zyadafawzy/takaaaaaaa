import { createFileRoute } from "@tanstack/react-router";

/** تسليم شعار السوبرماركت من مخزن خاص — من غير كشف مسار التخزين. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/store-logo/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!UUID.test(params.id)) return new Response("bad request", { status: 400 });

        const { resolveStoreLogo } = await import("@/lib/stores.server");
        const logo = await resolveStoreLogo(params.id);
        if (!logo) return new Response("not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.storage
          .from(logo.bucket)
          .createSignedUrl(logo.path, 120);
        if (!data?.signedUrl) return new Response("not found", { status: 404 });

        const upstream = await fetch(data.signedUrl);
        if (!upstream.ok) return new Response("not found", { status: 404 });

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "image/png",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
