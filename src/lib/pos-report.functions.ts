import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type PosReport = {
  range: { from: string; to: string };
  totals: {
    sales: number;
    refunds: number;
    net: number;
    invoices: number;
    averageBasket: number;
    cash: number;
    card: number;
    credit: number;
    grossProfit: number;
  };
  daily: Array<{ date: string; sales: number; invoices: number }>;
  topProducts: Array<{ productName: string; qty: number; revenue: number }>;
  customerBalances: Array<{ name: string; balance: number }>;
  stockMovement: Array<{ productName: string; movementType: string; qtyChange: number; createdAt: string }>;
  unknownScans: number;
};

/** تقرير نقاط البيع — كل حسابات التاريخ بتوقيت القاهرة (Africa/Cairo). */
export const posReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        branchId: uuid.nullable().optional(),
        dateFrom: dateStr,
        dateTo: dateStr,
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PosReport> => {
    const { requireStoreRole, ROLE_ANY, cairoDayRange, round2 } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const { from, to } = cairoDayRange(data.dateFrom, data.dateTo);

    let invoicesQuery = context.supabase
      .from("pos_invoices")
      .select(
        "id, total, paid_amount, status, created_at, branch_id, customers(name), invoice_items(product_name_snapshot, qty, line_total, cost_price_snapshot), invoice_payments(amount, payment_methods(type))",
      )
      .eq("store_id", data.storeId)
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(2000);

    if (data.branchId) invoicesQuery = invoicesQuery.eq("branch_id", data.branchId);

    const [invoicesRes, balancesRes, movementRes, unknownRes] = await Promise.all([
      invoicesQuery,
      context.supabase
        .from("customer_credit_accounts")
        .select("current_balance, customers(name)")
        .eq("store_id", data.storeId)
        .gt("current_balance", 0)
        .order("current_balance", { ascending: false })
        .limit(50),
      context.supabase
        .from("pos_inventory_movements")
        .select("movement_type, qty_change, created_at, product_variants(products(name))")
        .eq("store_id", data.storeId)
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("unknown_scan_items")
        .select("id", { count: "exact", head: true })
        .eq("store_id", data.storeId)
        .eq("resolved", false),
    ]);

    if (invoicesRes.error) throw new Error("REPORT_FAILED");

    const invoices = invoicesRes.data ?? [];
    const confirmed = invoices.filter((i) => i.status === "confirmed");
    const voided = invoices.filter((i) => i.status === "voided" || i.status === "refunded");

    let cash = 0;
    let card = 0;
    let credit = 0;
    let grossProfit = 0;
    const dailyMap = new Map<string, { sales: number; invoices: number }>();
    const productMap = new Map<string, { qty: number; revenue: number }>();

    for (const inv of confirmed) {
      const total = Number(inv.total);
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(inv.created_at));
      const bucket = dailyMap.get(day) ?? { sales: 0, invoices: 0 };
      bucket.sales = round2(bucket.sales + total);
      bucket.invoices += 1;
      dailyMap.set(day, bucket);

      const payments = (inv.invoice_payments as unknown as Array<{ amount: number; payment_methods: { type: string } | null }>) ?? [];
      let paid = 0;
      for (const p of payments) {
        const amount = Number(p.amount);
        paid += amount;
        if (p.payment_methods?.type === "cash") cash += amount;
        else if (p.payment_methods?.type === "card") card += amount;
      }
      if (paid < total) credit += total - paid;

      const items = (inv.invoice_items as unknown as Array<{ product_name_snapshot: string; qty: number; line_total: number; cost_price_snapshot: number | null }>) ?? [];
      for (const item of items) {
        const entry = productMap.get(item.product_name_snapshot) ?? { qty: 0, revenue: 0 };
        entry.qty += Number(item.qty);
        entry.revenue = round2(entry.revenue + Number(item.line_total));
        productMap.set(item.product_name_snapshot, entry);
        if (item.cost_price_snapshot != null) {
          grossProfit += Number(item.line_total) - Number(item.cost_price_snapshot) * Number(item.qty);
        }
      }
    }

    const sales = round2(confirmed.reduce((sum, i) => sum + Number(i.total), 0));
    const refunds = round2(voided.reduce((sum, i) => sum + Number(i.total), 0));

    return {
      range: { from: data.dateFrom, to: data.dateTo },
      totals: {
        sales,
        refunds,
        net: round2(sales - refunds),
        invoices: confirmed.length,
        averageBasket: confirmed.length > 0 ? round2(sales / confirmed.length) : 0,
        cash: round2(cash),
        card: round2(card),
        credit: round2(credit),
        grossProfit: round2(grossProfit),
      },
      daily: [...dailyMap.entries()]
        .map(([date, v]) => ({ date, sales: v.sales, invoices: v.invoices }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
      topProducts: [...productMap.entries()]
        .map(([productName, v]) => ({ productName, qty: v.qty, revenue: v.revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20),
      customerBalances: (balancesRes.data ?? []).map((r) => ({
        name: (r.customers as unknown as { name: string } | null)?.name ?? "عميل",
        balance: Number(r.current_balance),
      })),
      stockMovement: (movementRes.data ?? []).map((r) => ({
        productName:
          (r.product_variants as unknown as { products: { name: string } } | null)?.products?.name ?? "منتج",
        movementType: r.movement_type,
        qtyChange: Number(r.qty_change),
        createdAt: r.created_at,
      })),
      unknownScans: unknownRes.count ?? 0,
    };
  });

/** إغلاقات يومية سابقة. */
export const posDailyClosings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const { data: rows, error } = await context.supabase
      .from("daily_closings")
      .select("id, closing_date, total_sales, total_refunds, net_sales, total_cash, total_card, invoices_count, closed_at")
      .eq("store_id", data.storeId)
      .order("closing_date", { ascending: false })
      .limit(60);

    if (error) throw new Error("CLOSINGS_FAILED");

    return (rows ?? []).map((r) => ({
      id: r.id,
      closingDate: r.closing_date,
      totalSales: Number(r.total_sales),
      totalRefunds: Number(r.total_refunds),
      netSales: Number(r.net_sales),
      totalCash: Number(r.total_cash),
      totalCard: Number(r.total_card),
      invoicesCount: r.invoices_count,
      closedAt: r.closed_at,
    }));
  });
