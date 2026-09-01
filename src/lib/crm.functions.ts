import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const slug = z.string().min(1);

type Rpc = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** قائمة العملاء + الرصيد والنقاط وحالة موافقة واتساب. */
export const crmCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeSlug: slug, search: z.string().default("") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveStoreAccess } = await import("./sales-center.server");
    const { access, db, canManage } = await resolveStoreAccess(context.supabase, context.userId, data.storeSlug);

    let q = db
      .from("customers")
      .select(
        "id, name, phone, phone_normalized, address, notes, credit_limit, marketing_opt_in, opt_in_at, is_active, created_at",
      )
      .eq("store_id", access.storeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.search.trim()) {
      const term = `%${data.search.trim()}%`;
      q = q.or(`name.ilike.${term},phone.ilike.${term},phone_normalized.ilike.${term}`);
    }

    const [customersRes, balancesRes, loyaltyRes] = await Promise.all([
      q,
      db.from("customer_credit_accounts").select("customer_id, current_balance").eq("store_id", access.storeId),
      db.from("loyalty_accounts").select("customer_id, points_balance").eq("store_id", access.storeId),
    ]);

    const balances = new Map<string, number>(
      ((balancesRes.data ?? []) as any[]).map((r) => [r.customer_id as string, Number(r.current_balance)]),
    );
    const points = new Map<string, number>(
      ((loyaltyRes.data ?? []) as any[]).map((r) => [r.customer_id as string, Number(r.points_balance)]),
    );

    return {
      canManage,
      customers: ((customersRes.data ?? []) as any[]).map((c) => ({
        id: c.id as string,
        name: (c.name as string) ?? "عميل",
        phone: (c.phone_normalized as string) ?? (c.phone as string) ?? "—",
        address: (c.address as string) ?? "",
        notes: (c.notes as string) ?? "",
        creditLimit: Number(c.credit_limit ?? 0),
        balance: balances.get(c.id as string) ?? 0,
        points: points.get(c.id as string) ?? 0,
        marketingOptIn: Boolean(c.marketing_opt_in),
        active: c.is_active !== false,
      })),
    };
  });

/** إنشاء عميل سريع مع تحقق صارم من رقم الهاتف المصري. */
export const crmCreateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeSlug: slug,
        phone: z.string().min(6),
        name: z.string().default(""),
        address: z.string().default(""),
        notes: z.string().default(""),
        marketingOptIn: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveStoreAccess, normalizeEgyptPhone } = await import("./sales-center.server");
    const { access, db } = await resolveStoreAccess(context.supabase, context.userId, data.storeSlug);

    const phone = normalizeEgyptPhone(data.phone);
    if (!phone) throw new Error("INVALID_PHONE");

    const { data: existing } = await db
      .from("customers")
      .select("id, name")
      .eq("store_id", access.storeId)
      .eq("phone_normalized", phone)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) return { ok: false as const, duplicate: true as const, customerId: existing.id as string };

    const { data: created, error } = await db
      .from("customers")
      .insert({
        store_id: access.storeId,
        name: data.name.trim() || "عميل",
        phone: data.phone.trim(),
        phone_normalized: phone,
        address: data.address.trim() || null,
        notes: data.notes.trim() || null,
        marketing_opt_in: data.marketingOptIn,
        opt_in_source: data.marketingOptIn ? "pos" : null,
        opt_in_at: data.marketingOptIn ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) throw new Error("CUSTOMER_CREATE_FAILED");

    if (data.marketingOptIn) {
      await db.from("whatsapp_consent_log").insert({
        store_id: access.storeId,
        customer_id: created.id,
        consent_status: "opt_in",
        channel_source: "pos",
        created_by: context.userId,
      });
    }

    return { ok: true as const, duplicate: false as const, customerId: created.id as string };
  });

/** كشف حساب العميل: قيود غير قابلة للتعديل + رصيد بعد كل قيد. */
export const crmCustomerStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeSlug: slug, customerId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveStoreAccess, round2 } = await import("./sales-center.server");
    const { access, db } = await resolveStoreAccess(context.supabase, context.userId, data.storeSlug);

    const [customerRes, entriesRes, accountRes, loyaltyRes] = await Promise.all([
      db
        .from("customers")
        .select("id, name, phone, phone_normalized, credit_limit, marketing_opt_in")
        .eq("store_id", access.storeId)
        .eq("id", data.customerId)
        .maybeSingle(),
      db
        .from("customer_ledger_entries")
        .select("id, entry_type, debit, credit, balance_after, notes, invoice_id, created_at")
        .eq("store_id", access.storeId)
        .eq("customer_id", data.customerId)
        .order("created_at", { ascending: true })
        .limit(500),
      db
        .from("customer_credit_accounts")
        .select("current_balance")
        .eq("store_id", access.storeId)
        .eq("customer_id", data.customerId)
        .maybeSingle(),
      db
        .from("loyalty_accounts")
        .select("id, points_balance, lifetime_points")
        .eq("store_id", access.storeId)
        .eq("customer_id", data.customerId)
        .maybeSingle(),
    ]);

    if (!customerRes.data) throw new Error("CUSTOMER_NOT_FOUND");

    const entries = ((entriesRes.data ?? []) as any[]).map((e) => ({
      id: e.id as string,
      type: e.entry_type as string,
      debit: Number(e.debit ?? 0),
      credit: Number(e.credit ?? 0),
      balanceAfter: Number(e.balance_after ?? 0),
      note: (e.notes as string) ?? "",
      invoiceId: (e.invoice_id as string) ?? null,
      at: e.created_at as string,
    }));

    const loyaltyTx = loyaltyRes.data
      ? await db
          .from("loyalty_transactions")
          .select("id, transaction_type, points, balance_after, created_at, notes")
          .eq("loyalty_account_id", (loyaltyRes.data as any).id)
          .order("created_at", { ascending: false })
          .limit(100)
      : { data: [] };

    const computed = round2(entries.reduce((sum, e) => sum + e.debit - e.credit, 0));
    const stored = round2(Number((accountRes.data as any)?.current_balance ?? 0));

    return {
      customer: {
        id: (customerRes.data as any).id as string,
        name: (customerRes.data as any).name as string,
        phone: ((customerRes.data as any).phone_normalized ?? (customerRes.data as any).phone) as string,
        creditLimit: Number((customerRes.data as any).credit_limit ?? 0),
        marketingOptIn: Boolean((customerRes.data as any).marketing_opt_in),
      },
      entries,
      balance: stored,
      computedBalance: computed,
      balanced: Math.abs(computed - stored) < 0.01,
      points: Number((loyaltyRes.data as any)?.points_balance ?? 0),
      loyalty: ((loyaltyTx.data ?? []) as any[]).map((t) => ({
        id: t.id as string,
        type: t.transaction_type as string,
        points: Number(t.points),
        balanceAfter: Number(t.balance_after),
        at: t.created_at as string,
      })),
    };
  });

/** تسجيل تحصيل من العميل — قيد دائن عبر دالة قاعدة البيانات. */
export const crmRecordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ storeSlug: slug, customerId: uuid, amount: z.number().positive(), notes: z.string().default("") })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveStoreAccess } = await import("./sales-center.server");
    await resolveStoreAccess(context.supabase, context.userId, data.storeSlug);
    const { error } = await (context.supabase as unknown as Rpc).rpc("rpc_customer_payment", {
      p_customer_id: data.customerId,
      p_amount: data.amount,
      p_notes: data.notes || "تحصيل نقدي",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** تحديث موافقة العميل على رسائل العروض مع تسجيلها. */
export const crmSetConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeSlug: slug, customerId: uuid, optIn: z.boolean(), notes: z.string().default("") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveStoreAccess } = await import("./sales-center.server");
    await resolveStoreAccess(context.supabase, context.userId, data.storeSlug);
    const { error } = await (context.supabase as unknown as Rpc).rpc("rpc_set_marketing_consent", {
      p_customer_id: data.customerId,
      p_opt_in: data.optIn,
      p_source: "manual",
      p_notes: data.notes || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** إعدادات نقاط الولاء للمتجر. */
export const loyaltySettingsGet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeSlug: slug }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveStoreAccess } = await import("./sales-center.server");
    const { access, db, canManage } = await resolveStoreAccess(context.supabase, context.userId, data.storeSlug);
    const { data: row } = await db.from("loyalty_settings").select("*").eq("store_id", access.storeId).maybeSingle();
    const s = (row ?? {}) as any;
    return {
      canManage,
      enabled: s.enabled ?? true,
      earnAmountPerPoint: Number(s.earn_amount_per_point ?? 10),
      pointValue: Number(s.point_value ?? 1),
      minimumRedeemPoints: Number(s.minimum_redeem_points ?? 50),
      maxDiscountCap: s.max_discount_cap == null ? null : Number(s.max_discount_cap),
      allowRedemption: s.allow_redemption ?? true,
    };
  });

export const loyaltySettingsSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeSlug: slug,
        enabled: z.boolean(),
        earnAmountPerPoint: z.number().positive(),
        pointValue: z.number().positive(),
        minimumRedeemPoints: z.number().int().nonnegative(),
        maxDiscountCap: z.number().nonnegative().nullable(),
        allowRedemption: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveStoreAccess } = await import("./sales-center.server");
    const { access, db, canManage } = await resolveStoreAccess(context.supabase, context.userId, data.storeSlug);
    if (!canManage) throw new Error("FORBIDDEN");
    const { error } = await db.from("loyalty_settings").upsert({
      store_id: access.storeId,
      enabled: data.enabled,
      earn_amount_per_point: data.earnAmountPerPoint,
      point_value: data.pointValue,
      minimum_redeem_points: data.minimumRedeemPoints,
      max_discount_cap: data.maxDiscountCap,
      allow_redemption: data.allowRedemption,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("LOYALTY_SAVE_FAILED");
    return { ok: true };
  });

const segmentEnum = z.enum(["marketing_opt_in", "purchased_today", "repeat", "has_balance"]);
export type SegmentType = z.infer<typeof segmentEnum>;

async function segmentRecipients(db: any, storeId: string, segment: SegmentType) {
  const { cairoRange } = await import("./sales-center.server");
  const { data: customers } = await db
    .from("customers")
    .select("id, name, phone, phone_normalized, marketing_opt_in")
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .limit(2000);

  let list = ((customers ?? []) as any[]).filter((c) => c.phone_normalized);

  if (segment === "marketing_opt_in") list = list.filter((c) => c.marketing_opt_in === true);

  if (segment === "purchased_today") {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
    const { from, to } = cairoRange(today, today);
    const { data: invs } = await db
      .from("pos_invoices")
      .select("customer_id")
      .eq("store_id", storeId)
      .eq("status", "confirmed")
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(2000);
    const ids = new Set(((invs ?? []) as any[]).map((i) => i.customer_id));
    list = list.filter((c) => ids.has(c.id));
  }

  if (segment === "repeat") {
    const { data: invs } = await db
      .from("pos_invoices")
      .select("customer_id")
      .eq("store_id", storeId)
      .eq("status", "confirmed")
      .limit(5000);
    const counts = new Map<string, number>();
    for (const i of (invs ?? []) as any[]) {
      if (!i.customer_id) continue;
      counts.set(i.customer_id, (counts.get(i.customer_id) ?? 0) + 1);
    }
    list = list.filter((c) => (counts.get(c.id) ?? 0) >= 2);
  }

  if (segment === "has_balance") {
    const { data: accounts } = await db
      .from("customer_credit_accounts")
      .select("customer_id, current_balance")
      .eq("store_id", storeId)
      .gt("current_balance", 0);
    const ids = new Set(((accounts ?? []) as any[]).map((a) => a.customer_id));
    list = list.filter((c) => ids.has(c.id));
  }

  return list.map((c) => ({
    id: c.id as string,
    name: (c.name as string) ?? "عميل",
    phone: c.phone_normalized as string,
    optIn: Boolean(c.marketing_opt_in),
  }));
}

/** معاينة شريحة — شرائح العروض تستبعد غير الموافقين تلقائيًا. */
export const whatsappSegmentPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeSlug: slug, segment: segmentEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveStoreAccess } = await import("./sales-center.server");
    const { access, db, canManage } = await resolveStoreAccess(context.supabase, context.userId, data.storeSlug);
    const recipients = await segmentRecipients(db, access.storeId, data.segment);
    return { canManage, count: recipients.length, recipients: recipients.slice(0, 200) };
  });

/**
 * تجهيز حملة واتساب: الحالة `prepared` فقط — مفيش provider فعلي،
 * فمفيش أي ادعاء بإرسال. الرسائل تُفتح يدويًا بروابط فردية.
 */
export const whatsappCampaignPrepare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ storeSlug: slug, name: z.string().min(2), segment: segmentEnum, message: z.string().min(4) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveStoreAccess } = await import("./sales-center.server");
    const { access, db, canManage } = await resolveStoreAccess(context.supabase, context.userId, data.storeSlug);
    if (!canManage) throw new Error("FORBIDDEN");

    const all = await segmentRecipients(db, access.storeId, data.segment);
    // موافقة صريحة شرط أساسي لأي رسالة عروض.
    const recipients = all.filter((r) => r.optIn);

    const { data: campaign, error } = await db
      .from("whatsapp_campaigns")
      .insert({
        store_id: access.storeId,
        name: data.name.trim(),
        message_template: data.message,
        segment_type: data.segment,
        status: "prepared",
        provider: "manual_links",
        recipient_count: recipients.length,
        created_by: context.userId,
        prepared_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error("CAMPAIGN_FAILED");

    const messages = recipients.map((r) => ({
      campaign_id: campaign.id,
      store_id: access.storeId,
      customer_id: r.id,
      phone_normalized: r.phone,
      message_text: data.message.replace(/\{\{name\}\}/g, r.name),
      status: "prepared",
    }));
    if (messages.length > 0) await db.from("whatsapp_campaign_messages").insert(messages);

    await db.from("export_logs").insert({
      store_id: access.storeId,
      export_type: "whatsapp_campaign_prepare",
      filters: { segment: data.segment },
      row_count: messages.length,
      created_by: context.userId,
    });

    return {
      campaignId: campaign.id as string,
      status: "prepared" as const,
      excluded: all.length - recipients.length,
      recipients: messages.map((m) => ({
        phone: m.phone_normalized,
        text: m.message_text,
        link: `https://wa.me/${m.phone_normalized.replace("+", "")}?text=${encodeURIComponent(m.message_text)}`,
      })),
    };
  });

/** حملات المتجر. */
export const whatsappCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeSlug: slug }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveStoreAccess } = await import("./sales-center.server");
    const { access, db } = await resolveStoreAccess(context.supabase, context.userId, data.storeSlug);
    const { data: rows } = await db
      .from("whatsapp_campaigns")
      .select("id, name, segment_type, status, provider, recipient_count, created_at")
      .eq("store_id", access.storeId)
      .order("created_at", { ascending: false })
      .limit(50);
    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      segment: r.segment_type as string,
      status: r.status as string,
      provider: r.provider as string,
      recipients: Number(r.recipient_count ?? 0),
      createdAt: r.created_at as string,
    }));
  });
