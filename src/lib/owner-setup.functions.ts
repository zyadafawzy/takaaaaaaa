import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  changeMasterPassphrase,
  createAdminAccount,
  ownerEmail,
  sendOwnerMagicLink,
} from "./owner-setup.server";
import { getRequest } from "@tanstack/react-start/server";

const createStoreSchema = z.object({
  passphrase: z.string(),
  name: z.string().min(2),
  slug: z.string().min(2),
  ownerName: z.string(),
  governorate: z.string(),
  region: z.string(),
  adminUsername: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,31}$/),
  adminPassword: z.string().min(8),
  logoUrl: z.string().optional(),
});

export const ownerCreateStore = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createStoreSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Verify master passphrase
    const { data: config } = await supabaseAdmin
      .from("admin_master_config")
      .select("passphrase_salt, passphrase_hash, failed_attempts, locked_until")
      .eq("id", true)
      .maybeSingle();

    if (!config) return { ok: false, error: "CONFIG_MISSING" };
    
    if (config.locked_until && new Date(config.locked_until).getTime() > Date.now()) {
      return { ok: false, error: "LOCKED" };
    }

    const { createHash, timingSafeEqual } = await import("node:crypto");
    const providedHash = createHash("sha256")
      .update(config.passphrase_salt + data.passphrase, "utf8")
      .digest("hex");

    const expectedBuf = Buffer.from(config.passphrase_hash, "utf8");
    const providedBuf = Buffer.from(providedHash, "utf8");

    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      const attempts = (config.failed_attempts || 0) + 1;
      await supabaseAdmin
        .from("admin_master_config")
        .update({
          failed_attempts: attempts,
          locked_until: attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
        })
        .eq("id", true);
      return { ok: false, error: "BAD_PASSPHRASE" };
    }

    // Reset failed attempts on success
    await supabaseAdmin
      .from("admin_master_config")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("id", true);

    const { data: store, error } = await supabaseAdmin
      .from("stores")
      .insert({
        name: data.name,
        slug: data.slug,
        logo_url: data.logoUrl ?? null,
        governorate: data.governorate,
        owner_name: data.ownerName,
        status: 'active',
        address: data.region,
        description: `طلبات البيت اللي ناقصة في كم تكة.. أسرع سوبر ماركت في مصر جودة فريش وأسعار حقيقية.`,
        support_number: '01000000000',
        whatsapp_number: '01000000000',
        phone: '01000000000',
        business_hours: '24/7',
        is_maintenance: false, // Added by migration
        maintenance_message: 'المتجر في وضع الصيانة حالياً. نعتذر عن الإزعاج.',
      } as any)
      .select()
      .single();

    if (error) return { ok: false, error: error.message };
    const { provisionStoreMemberAccount } = await import("./store-session.server");
    await provisionStoreMemberAccount(store.id, store.slug, {
      username: data.adminUsername,
      password: data.adminPassword,
      fullName: data.ownerName || "صاحب المتجر",
      tier: "owner",
    });
    return { ok: true, store };
  });

export const ownerCreateAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        passphrase: z.string().min(4).max(200),
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(8).max(200),
        fullName: z.string().trim().max(80).default(""),
        role: z.enum(["super_admin", "store_manager", "inventory_operator", "order_operator"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => createAdminAccount(data));

export const ownerRequestPassphraseLink = createServerFn({ method: "POST" }).handler(async () => {
  const origin = new URL(getRequest().url).origin;
  return sendOwnerMagicLink(origin);
});

export const ownerChangePassphrase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ newPassphrase: z.string().min(8).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | null)?.email?.toLowerCase() ?? "";
    return changeMasterPassphrase(email, data.newPassphrase);
  });

export const ownerSetupInfo = createServerFn({ method: "GET" }).handler(async () => {
  const email = await ownerEmail();
  const [name, domain] = email.split("@");
  const masked = `${(name ?? "").slice(0, 2)}${"*".repeat(Math.max((name ?? "").length - 2, 0))}@${domain ?? ""}`;
  return { maskedOwnerEmail: masked };
});
