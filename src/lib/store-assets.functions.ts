import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { storeSlugInput } from "./store-admin.schemas";

export const storeAdminLoginByPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    storeSlugInput.extend({ password: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: store, error } = await supabaseAdmin
      .from("stores")
      .select("id, slug, name, admin_password_hash")
      .eq("slug", data.storeSlug)
      .maybeSingle();

    if (error || !store || !store.admin_password_hash) {
      return { ok: false as const, error: "INVALID" };
    }

    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(data.password).digest("hex");
    const matches =
      store.admin_password_hash === data.password || store.admin_password_hash === hash;
    if (!matches) return { ok: false as const, error: "INVALID" };

    // حساب إدارة مخصّص للمتجر — عشان كل نداءات اللوحة تشتغل بجلسة حقيقية ومعزولة.
    const { issueStoreAdminSession } = await import("./store-session.server");
    const session = await issueStoreAdminSession(store.id, store.slug);
    if (!session) return { ok: false as const, error: "SESSION_FAILED" };

    return { ok: true as const, email: session.email, password: session.password };
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
