import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();
const sourceEnum = z.enum(["inplace", "delivery", "all"]);

const filtersSchema = z.object({
  storeSlug: z.string().min(1),
  source: sourceEnum.default("all"),
  dateFrom: dateStr,
  dateTo: dateStr,
  cashierId: uuid.nullish(),
  shiftId: uuid.nullish(),
  customerId: uuid.nullish(),
  paymentStatus: z.enum(["all", "paid", "partial", "unpaid"]).default("all"),
  paymentMethod: z.string().nullish(),
});

export type SalesFilters = z.infer<typeof filtersSchema>;

export type SalesInvoiceRow = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  source: "inplace" | "delivery";
  cashierName: string | null;
  shiftId: string | null;
  customerName: string | null;
  total: number;
  paid: number;
  due: number;
  refunded: number;
  paymentStatus: "paid" | "partial" | "unpaid";
  status: string;
  deliveryOrderId: string | null;
};

export type SalesCenterData = {
  canSeeCost: boolean;
  range: { from: string; to: string; timezone: "Africa/Cairo" };
  totals: {
    gross: number;
    net: number;
    invoices: number;
    averageInvoice: number;
    cash: number;
    credit: number;
    collections: number;
    refunds: number;
    waste: number | null;
    cost: number | null;
    profit: number | null;
    margin: number | null;
    customers: number;
  };
  daily: Array<{ date: string; total: number; invoices: number }>;
  hourly: Array<{ hour: number; total: number; invoices: number }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  invoices: SalesInvoiceRow[];
  cashiers: Array<{ id: string; name: string }>;
};

/** يتحقق من صلاحية المستخدم على المتجر ويحدد إن كان يرى التكلفة/الربح. */
async function resolveAccess(supabase: never, userId: string, storeSlug: string) {
  const { requireStoreAccess } = await import("./store-admin.server");
  const access = await requireStoreAccess(supabase as never, userId, storeSlug);
  const { looseAdmin } = await import("./sales-center.server");
  const db = await looseAdmin();

  const { data: posMember } = await db
    .from("pos_members")
    .select("role")
    .eq("store_id", access.storeId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const posRole = (posMember?.role as string | undefined) ?? null;
  const privileged =
    access.role === "platform_owner" ||
    access.role === "store_admin" ||
    posRole === "store_owner" ||
    posRole === "branch_manager";

  return { access, db, posRole, canSeeCost: privileged, canManage: privileged };
}

/** مركز المبيعات: ملخص + فواتير، بفصل صارم بين مبيعات المكان والديليفري. */
export const salesCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filtersSchema.parse(input))
  .handler(async ({ data, context }): Promise<SalesCenterData> => {
    const { cairoRange, cairoDay, cairoHour, round2 } = await import("./sales-center.server");
    const { access, db, canSeeCost } = await resolveAccess(
      context.supabase as never,
      context.userId,
      data.storeSlug,
    );
    const { from, to } = cairoRange(data.dateFrom, data.dateTo);

    let q = db
      .from("pos_invoices")
      .select(
        "id, invoice_number, created_at, sale_source, delivery_order_id, status, total, paid_amount, shift_id, cashier_id, customer_id, customers(name), invoice_items(product_name_snapshot, qty, line_total, cost_price_snapshot), invoice_payments(amount, payment_methods(type, name))",
      )
      .eq("store_id", access.storeId)
      .gte("created_at", from)
      .lte("created_at", to)
      .in("status", ["confirmed", "voided", "refunded"])
      .order("created_at", { ascending: false })
      .limit(2000);

    if (data.source === "delivery") q = q.eq("sale_source", "delivery");
    if (data.source === "inplace") q = q.neq("sale_source", "delivery");
    if (data.cashierId) q = q.eq("cashier_id", data.cashierId);
    if (data.shiftId) q = q.eq("shift_id", data.shiftId);
    if (data.customerId) q = q.eq("customer_id", data.customerId);

    const [invRes, refundRes, wasteRes, collectionsRes] = await Promise.all([
      q,
      db
        .from("invoice_refunds")
        .select("amount, original_invoice_id, created_at")
        .eq("store_id", access.storeId)
        .gte("created_at", from)
        .lte("created_at", to),
      db
        .from("damaged_items")
        .select("cost_value")
        .eq("store_id", access.storeId)
        .gte("created_at", from)
        .lte("created_at", to),
      db
        .from("customer_ledger_entries")
        .select("credit")
        .eq("store_id", access.storeId)
        .eq("entry_type", "payment")
        .gte("created_at", from)
        .lte("created_at", to),
    ]);

    if (invRes.error) throw new Error("SALES_CENTER_FAILED");

    const rows = (invRes.data ?? []) as any[];
    const refundByInvoice = new Map<string, number>();
    for (const r of (refundRes.data ?? []) as any[]) {
      refundByInvoice.set(
        r.original_invoice_id as string,
        (refundByInvoice.get(r.original_invoice_id as string) ?? 0) + Number(r.amount),
      );
    }

    let gross = 0;
    let cash = 0;
    let credit = 0;
    let cost = 0;
    let costKnown = 0;
    let costMissing = 0;
    const dailyMap = new Map<string, { total: number; invoices: number }>();
    const hourlyMap = new Map<number, { total: number; invoices: number }>();
    const productMap = new Map<string, { qty: number; revenue: number }>();
    const customerIds = new Set<string>();
    const cashierIds = new Set<string>();
    const invoices: SalesInvoiceRow[] = [];

    for (const inv of rows) {
      const total = Number(inv.total ?? 0);
      const payments = (inv.invoice_payments ?? []) as any[];
      const paidFromPayments = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
      const paid = Number(inv.paid_amount ?? 0) || paidFromPayments;
      const refunded = round2(refundByInvoice.get(inv.id as string) ?? 0);
      const active = inv.status === "confirmed";
      if (inv.cashier_id) cashierIds.add(inv.cashier_id as string);

      if (data.paymentMethod && data.paymentMethod !== "all") {
        const has = payments.some((p) => p.payment_methods?.type === data.paymentMethod);
        if (!has) continue;
      }
      const paymentStatus: SalesInvoiceRow["paymentStatus"] =
        paid >= total && total > 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
      if (data.paymentStatus !== "all" && data.paymentStatus !== paymentStatus) continue;

      invoices.push({
        id: inv.id as string,
        invoiceNumber: (inv.invoice_number as string) ?? "—",
        createdAt: inv.created_at as string,
        source: inv.sale_source === "delivery" ? "delivery" : "inplace",
        cashierName: null,
        shiftId: (inv.shift_id as string) ?? null,
        customerName: (inv.customers?.name as string) ?? null,
        total: round2(total),
        paid: round2(paid),
        due: round2(Math.max(total - paid, 0)),
        refunded,
        paymentStatus,
        status: inv.status as string,
        deliveryOrderId: (inv.delivery_order_id as string) ?? null,
      });

      if (!active) continue;

      gross += total;
      if (inv.customer_id) customerIds.add(inv.customer_id as string);

      for (const p of payments) {
        const amount = Number(p.amount ?? 0);
        if (p.payment_methods?.type === "cash") cash += amount;
      }
      if (paid < total) credit += total - paid;

      const day = cairoDay(inv.created_at as string);
      const dayBucket = dailyMap.get(day) ?? { total: 0, invoices: 0 };
      dayBucket.total = round2(dayBucket.total + total);
      dayBucket.invoices += 1;
      dailyMap.set(day, dayBucket);

      const hour = cairoHour(inv.created_at as string);
      const hourBucket = hourlyMap.get(hour) ?? { total: 0, invoices: 0 };
      hourBucket.total = round2(hourBucket.total + total);
      hourBucket.invoices += 1;
      hourlyMap.set(hour, hourBucket);

      for (const item of (inv.invoice_items ?? []) as any[]) {
        const name = (item.product_name_snapshot as string) ?? "منتج";
        const entry = productMap.get(name) ?? { qty: 0, revenue: 0 };
        entry.qty += Number(item.qty ?? 0);
        entry.revenue = round2(entry.revenue + Number(item.line_total ?? 0));
        productMap.set(name, entry);
        if (item.cost_price_snapshot == null) costMissing += 1;
        else {
          costKnown += 1;
          cost += Number(item.cost_price_snapshot) * Number(item.qty ?? 0);
        }
      }
    }

    const refunds = round2(
      ((refundRes.data ?? []) as any[]).reduce((s, r) => s + Number(r.amount ?? 0), 0),
    );
    const net = round2(gross - refunds);
    const confirmedCount = invoices.filter((i) => i.status === "confirmed").length;
    const costReliable = canSeeCost && costKnown > 0 && costMissing === 0;

    return {
      canSeeCost,
      range: { from, to, timezone: "Africa/Cairo" },
      totals: {
        gross: round2(gross),
        net,
        invoices: confirmedCount,
        averageInvoice: confirmedCount > 0 ? round2(net / confirmedCount) : 0,
        cash: round2(cash),
        credit: round2(credit),
        collections: round2(
          ((collectionsRes.data ?? []) as any[]).reduce(
            (s, r) => s + Number(r.credit ?? 0),
            0,
          ),
        ),
        refunds,
        waste: canSeeCost
          ? round2(
              ((wasteRes.data ?? []) as any[]).reduce(
                (s, r) => s + Number(r.cost_value ?? 0),
                0,
              ),
            )
          : null,
        cost: costReliable ? round2(cost) : null,
        profit: costReliable ? round2(net - cost) : null,
        margin: costReliable && net > 0 ? round2(((net - cost) / net) * 100) : null,
        customers: customerIds.size,
      },
      daily: [...dailyMap.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
      hourly: [...hourlyMap.entries()].map(([hour, v]) => ({ hour, ...v })).sort((a, b) => a.hour - b.hour),
      topProducts: [...productMap.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 15),
      invoices,
      cashiers: [...cashierIds].map((id) => ({ id, name: id.slice(0, 8) })),
    };
  });

/** تفاصيل فاتورة + Timeline. التكلفة والربح للأدوار المصرح لها فقط. */
export const salesInvoiceDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeSlug: z.string().min(1), invoiceId: uuid }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { round2 } = await import("./sales-center.server");
    const { access, db, canSeeCost } = await resolveAccess(
      context.supabase as never,
      context.userId,
      data.storeSlug,
    );

    const { data: inv, error } = await db
      .from("pos_invoices")
      .select(
        "id, invoice_number, created_at, confirmed_at, voided_at, void_reason, sale_source, delivery_order_id, status, subtotal, discount_amount, tax_amount, total, paid_amount, shift_id, cashier_id, notes, customers(id, name, phone), invoice_items(id, product_name_snapshot, barcode_scanned, unit_label_snapshot, qty, sell_price_snapshot, discount_amount, line_total, cost_price_snapshot), invoice_payments(id, amount, created_at, payment_methods(name, type))",
      )
      .eq("store_id", access.storeId)
      .eq("id", data.invoiceId)
      .maybeSingle();

    if (error || !inv) throw new Error("INVOICE_NOT_FOUND");

    const [refunds, prints] = await Promise.all([
      db
        .from("invoice_refunds")
        .select("id, amount, reason, created_at")
        .eq("original_invoice_id", data.invoiceId),
      db.from("print_logs").select("id, document_type, printed_at").eq("invoice_id", data.invoiceId).limit(20),
    ]);

    const row = inv as any;
    const items = ((row.invoice_items ?? []) as any[]).map((i) => {
      const lineCost = i.cost_price_snapshot == null ? null : Number(i.cost_price_snapshot) * Number(i.qty);
      return {
        id: i.id as string,
        name: i.product_name_snapshot as string,
        barcode: (i.barcode_scanned as string) ?? null,
        unit: (i.unit_label_snapshot as string) ?? "قطعة",
        qty: Number(i.qty),
        unitPrice: Number(i.sell_price_snapshot ?? 0),
        discount: Number(i.discount_amount ?? 0),
        lineTotal: Number(i.line_total ?? 0),
        unitCost: canSeeCost && i.cost_price_snapshot != null ? Number(i.cost_price_snapshot) : null,
        lineProfit: canSeeCost && lineCost != null ? round2(Number(i.line_total ?? 0) - lineCost) : null,
      };
    });

    const timeline: Array<{ at: string; label: string }> = [
      { at: row.created_at as string, label: "إنشاء الفاتورة" },
    ];
    if (row.confirmed_at) timeline.push({ at: row.confirmed_at as string, label: "اعتماد الفاتورة" });
    for (const p of (row.invoice_payments ?? []) as any[])
      timeline.push({ at: p.created_at as string, label: `دفعة ${Number(p.amount)} ج.م` });
    for (const r of ((refunds.data ?? []) as any[]))
      timeline.push({ at: r.created_at as string, label: `مرتجع/إلغاء ${Number(r.amount)} ج.م — ${r.reason ?? ""}` });
    for (const p of ((prints.data ?? []) as any[]))
      timeline.push({ at: p.printed_at as string, label: `طباعة ${p.document_type}` });
    if (row.voided_at) timeline.push({ at: row.voided_at as string, label: `إلغاء: ${row.void_reason ?? ""}` });
    timeline.sort((a, b) => (a.at < b.at ? -1 : 1));

    return {
      canSeeCost,
      id: row.id as string,
      invoiceNumber: (row.invoice_number as string) ?? "—",
      createdAt: row.created_at as string,
      status: row.status as string,
      source: row.sale_source === "delivery" ? ("delivery" as const) : ("inplace" as const),
      deliveryOrderId: (row.delivery_order_id as string) ?? null,
      shiftId: (row.shift_id as string) ?? null,
      customer: row.customers
        ? { id: row.customers.id as string, name: row.customers.name as string, phone: row.customers.phone as string }
        : null,
      subtotal: Number(row.subtotal ?? 0),
      discount: Number(row.discount_amount ?? 0),
      tax: Number(row.tax_amount ?? 0),
      total: Number(row.total ?? 0),
      paid: Number(row.paid_amount ?? 0),
      due: round2(Math.max(Number(row.total ?? 0) - Number(row.paid_amount ?? 0), 0)),
      items,
      payments: ((row.invoice_payments ?? []) as any[]).map((p) => ({
        id: p.id as string,
        amount: Number(p.amount),
        method: (p.payment_methods?.name as string) ?? "غير محدد",
        at: p.created_at as string,
      })),
      refunds: ((refunds.data ?? []) as any[]).map((r) => ({
        id: r.id as string,
        amount: Number(r.amount),
        reason: (r.reason as string) ?? "",
        at: r.created_at as string,
      })),
      timeline,
    };
  });

/** اعتماد طلب ديليفري كفاتورة مالية — Idempotent عبر دالة قاعدة البيانات. */
export const postDeliveryOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeSlug: z.string().min(1), orderId: uuid }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await resolveAccess(context.supabase as never, context.userId, data.storeSlug);
    const client = context.supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: result, error } = await client.rpc("rpc_post_delivery_order_to_invoice", {
      p_order_id: data.orderId,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; invoice_id: string; created: boolean };
  });

/** إلغاء مالي لفاتورة ديليفري — بدون حذف. */
export const cancelDeliveryInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeSlug: z.string().min(1), invoiceId: uuid, reason: z.string().min(3) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await resolveAccess(context.supabase as never, context.userId, data.storeSlug);
    const client = context.supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { error } = await client.rpc("rpc_cancel_delivery_invoice", {
      p_invoice_id: data.invoiceId,
      p_reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** طلبات ديليفري لسه ما اتعملهاش اعتماد مالي. */
export const unpostedDeliveryOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeSlug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { access, db } = await resolveAccess(context.supabase as never, context.userId, data.storeSlug);
    const { data: rows } = await db
      .from("orders")
      .select("id, order_number, created_at, status, grand_total, customer_first_name, posting_status")
      .eq("store_id", access.storeId)
      .is("financial_invoice_id", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(100);

    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id as string,
      orderNumber: (r.order_number as string) ?? "—",
      createdAt: r.created_at as string,
      status: r.status as string,
      total: Number(r.grand_total ?? 0),
      customerName: (r.customer_first_name as string) ?? "—",
    }));
  });
