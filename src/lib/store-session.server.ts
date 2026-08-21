/**
 * جلسة إدارة المتجر: الدخول بكلمة سر واحدة بيصدر جلسة Supabase حقيقية
 * لحساب إدارة مخصّص للمتجر، عشان كل نداءات اللوحة تتحقق على الخادم ومعزولة بالمتجر.
 */

const DOMAIN = "store-admin.tekka.local";

function storeAdminEmail(slug: string): string {
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return `store-${safe}@${DOMAIN}`;
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issueStoreAdminSession(
  storeId: string,
  storeSlug: string,
): Promise<{ email: string; password: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = storeAdminEmail(storeSlug);
  const password = randomPassword();

  // 1) تأكد إن حساب إدارة المتجر موجود (وبكلمة مرور مؤقتة متجدّدة كل دخول).
  let userId: string | null = null;
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { store_slug: storeSlug, kind: "store_admin" },
  });

  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    // موجود قبل كده — دوّر عليه وجدّد كلمة المرور المؤقتة.
    for (let page = 1; page <= 20 && !userId; page += 1) {
      const list = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      const match = list.data.users.find((user) => user.email === email);
      if (match) userId = match.id;
      if (list.data.users.length < 200) break;
    }
    if (!userId) return null;
    const updated = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updated.error) return null;
  }

  if (!userId) return null;

  // 2) اربطه بالمتجر كمسؤول (لو مش مربوط).
  const existing = await supabaseAdmin
    .from("store_users")
    .select("id, active, role")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.data) {
    if (!existing.data.active || existing.data.role !== "store_admin") {
      await supabaseAdmin
        .from("store_users")
        .update({ active: true, role: "store_admin" })
        .eq("id", existing.data.id);
    }
  } else {
    await supabaseAdmin.from("store_users").insert({
      store_id: storeId,
      user_id: userId,
      email,
      full_name: "إدارة المتجر",
      role: "store_admin",
      active: true,
    });
  }

  return { email, password };
}
