/** حسابات فريق المتجر تستخدم بريدًا داخليًا مشتقًا من المتجر واسم المستخدم. */

const DOMAIN = "store-admin.tekka.local";

export function normalizeStoreUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export function storeMemberEmail(slug: string, username: string): string {
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const safeUsername = normalizeStoreUsername(username);
  return `${safeUsername}.store-${safeSlug}@${DOMAIN}`;
}

export async function provisionStoreMemberAccount(
  storeId: string,
  storeSlug: string,
  input: {
    username: string;
    password: string;
    fullName: string;
    tier: "owner" | "manager" | "cashier";
  },
): Promise<{ userId: string; email: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = storeMemberEmail(storeSlug, input.username);
  const roles = {
    owner: { store: "store_admin" as const, pos: "store_owner" as const },
    manager: { store: "store_admin" as const, pos: "branch_manager" as const },
    cashier: { store: "store_staff" as const, pos: "cashier" as const },
  };
  const role = roles[input.tier];

  let userId: string | null = null;
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      store_slug: storeSlug,
      store_username: normalizeStoreUsername(input.username),
      kind: "store_member",
    },
  });

  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    for (let page = 1; page <= 20 && !userId; page += 1) {
      const list = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      const match = list.data.users.find((user) => user.email === email);
      if (match) userId = match.id;
      if (list.data.users.length < 200) break;
    }
    if (!userId) throw new Error("CREATE_USER_FAILED");
    const updated = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
        store_slug: storeSlug,
        store_username: normalizeStoreUsername(input.username),
        kind: "store_member",
      },
    });
    if (updated.error) throw new Error("CREATE_USER_FAILED");
  }

  if (!userId) throw new Error("CREATE_USER_FAILED");

  const existing = await supabaseAdmin
    .from("store_users")
    .select("id, active, role")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.data) {
    const saved = await supabaseAdmin
      .from("store_users")
      .update({ active: true, role: role.store, email, full_name: input.fullName })
      .eq("id", existing.data.id);
    if (saved.error) throw new Error("SAVE_FAILED");
  } else {
    const saved = await supabaseAdmin.from("store_users").insert({
      store_id: storeId,
      user_id: userId,
      email,
      full_name: input.fullName,
      role: role.store,
      active: true,
    });
    if (saved.error) throw new Error("SAVE_FAILED");
  }

  const posMember = await supabaseAdmin
    .from("pos_members")
    .select("id, is_active, role")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (posMember.data) {
    const saved = await supabaseAdmin
      .from("pos_members")
      .update({ is_active: true, role: role.pos })
      .eq("id", posMember.data.id);
    if (saved.error) throw new Error("SAVE_FAILED");
  } else {
    const saved = await supabaseAdmin.from("pos_members").insert({
      store_id: storeId,
      user_id: userId,
      role: role.pos,
      is_active: true,
    });
    if (saved.error) throw new Error("SAVE_FAILED");
  }

  return { userId, email };
}
