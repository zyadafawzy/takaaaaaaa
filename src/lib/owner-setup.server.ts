import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createPublicServerClient } from "./supabase-public.server";

type MasterConfig = {
  owner_email: string;
  passphrase_salt: string;
  passphrase_hash: string;
  failed_attempts: number;
  locked_until: string | null;
};

function hashPassphrase(salt: string, passphrase: string): string {
  return createHash("sha256")
    .update(salt + passphrase, "utf8")
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function loadConfig() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("admin_master_config")
    .select("owner_email, passphrase_salt, passphrase_hash, failed_attempts, locked_until")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) throw new Error("CONFIG_MISSING");
  return { supabaseAdmin, config: data as MasterConfig };
}

export async function ownerEmail(): Promise<string> {
  const { config } = await loadConfig();
  return config.owner_email;
}

export type CreateAdminInput = {
  passphrase: string;
  email: string;
  password: string;
  fullName: string;
  role: "super_admin" | "store_manager" | "inventory_operator" | "order_operator";
};

export async function createAdminAccount(input: CreateAdminInput) {
  const { supabaseAdmin, config } = await loadConfig();

  if (config.locked_until && new Date(config.locked_until).getTime() > Date.now()) {
    return { ok: false as const, error: "LOCKED" };
  }

  const expected = config.passphrase_hash;
  const provided = hashPassphrase(config.passphrase_salt, input.passphrase);

  if (!safeEqualHex(expected, provided)) {
    const attempts = config.failed_attempts + 1;
    await supabaseAdmin
      .from("admin_master_config")
      .update({
        failed_attempts: attempts,
        locked_until: attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
      })
      .eq("id", true);
    await new Promise((r) => setTimeout(r, 600));
    return { ok: false as const, error: attempts >= 5 ? "LOCKED" : "BAD_PASSPHRASE" };
  }

  await supabaseAdmin
    .from("admin_master_config")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("id", true);

  // إنشاء المستخدم في Supabase Auth (أو استخدام الموجود)
  let userId: string | null = null;
  const created = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (created.error) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users.find((u) => (u.email ?? "").toLowerCase() === input.email);
    if (!existing) return { ok: false as const, error: "CREATE_USER_FAILED" };
    userId = existing.id;
    await supabaseAdmin.auth.admin.updateUserById(userId, { password: input.password });
  } else {
    userId = created.data.user?.id ?? null;
  }

  if (!userId) return { ok: false as const, error: "CREATE_USER_FAILED" };

  const { error: profileError } = await supabaseAdmin.from("admin_profiles").upsert(
    {
      user_id: userId,
      email: input.email,
      full_name: input.fullName || input.email.split("@")[0] || "مدير",
      role: input.role,
      active: true,
    },
    { onConflict: "user_id" },
  );
  if (profileError) return { ok: false as const, error: "PROFILE_FAILED" };

  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: userId,
    actor_email: input.email,
    action: "owner_create_admin",
    entity_type: "admin_profiles",
    entity_id: userId,
    metadata: { role: input.role } as never,
  });

  return { ok: true as const };
}

/** يرسل رابط دخول لمرة واحدة لبريد المالك فقط (البريد ثابت من قاعدة البيانات). */
export async function sendOwnerMagicLink(origin: string) {
  const { config } = await loadConfig();
  const supabase = createPublicServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: config.owner_email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/admin/owner` },
  });
  if (error) return { ok: false as const, error: "SEND_FAILED" };
  return { ok: true as const };
}

export async function changeMasterPassphrase(sessionEmail: string, newPassphrase: string) {
  const { supabaseAdmin, config } = await loadConfig();
  if (!sessionEmail || sessionEmail !== config.owner_email.toLowerCase()) {
    return { ok: false as const, error: "FORBIDDEN" };
  }

  const salt = randomBytes(16).toString("hex");
  const { error } = await supabaseAdmin
    .from("admin_master_config")
    .update({
      passphrase_salt: salt,
      passphrase_hash: hashPassphrase(salt, newPassphrase),
      failed_attempts: 0,
      locked_until: null,
    })
    .eq("id", true);
  if (error) return { ok: false as const, error: "UPDATE_FAILED" };

  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: null,
    actor_email: sessionEmail,
    action: "change_master_passphrase",
    entity_type: "admin_master_config",
    entity_id: "master",
    metadata: {} as never,
  });

  return { ok: true as const };
}
