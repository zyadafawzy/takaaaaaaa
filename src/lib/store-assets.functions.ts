import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { storeSlugInput } from "./store-admin.schemas";

export const storeAdminLoginByPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    storeSlugInput.extend({ username: z.string().regex(/^[a-zA-Z0-9_-]{3,32}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { storeMemberEmail } = await import("./store-session.server");

    const { data: store, error } = await supabaseAdmin
      .from("stores")
      .select("id, slug")
      .eq("slug", data.storeSlug)
      .maybeSingle();

    if (error || !store) {
      return { ok: false as const, error: "INVALID" };
    }

    const email = storeMemberEmail(store.slug, data.username);
    const { data: member } = await supabaseAdmin
      .from("store_users")
      .select("id")
      .eq("store_id", store.id)
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();
    if (!member) return { ok: false as const, error: "INVALID" };

    return { ok: true as const, email };
  });

export const generateStoreAIAsset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ prompt: z.string().min(3).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    // Return multiple samples for the user to choose from
    const samples = [
      { id: "1", url: "https://images.unsplash.com/photo-1583258292688-d5ec279a0b13?w=800&q=80", label: "شعار حديث" },
      { id: "2", url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80", label: "واجهة المتجر" },
      { id: "3", url: "https://images.unsplash.com/photo-1543168256-418811576931?w=800&q=80", label: "منتجات فريش" },
      { id: "4", url: "https://images.unsplash.com/photo-1550989460-0adc9a5ff50b?w=800&q=80", label: "سلة تسوق" },
      { id: "5", url: "https://images.unsplash.com/photo-1604719312563-861ac4c153b0?w=800&q=80", label: "أجواء المتجر" },
      { id: "6", url: "https://images.unsplash.com/photo-1608686209041-7248b804791e?w=800&q=80", label: "قسم المخبوزات" },
      { id: "7", url: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&q=80", label: "قسم العروض" },
      { id: "8", url: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80", label: "خدمة التوصيل" },
    ];
    
    return { samples };
  });
