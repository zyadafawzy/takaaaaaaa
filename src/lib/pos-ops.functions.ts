import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { unknownLineSchema } from "@/lib/pos.functions";
import type { PosCartLine, PosHeldInvoice, PosUnknownGroup } from "@/types/pos";

const uuid = z.string().uuid();

/* ==================== الفواتير المعلّقة (Hold) ==================== */

export const posHoldCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        branchId: uuid.nullable().optional(),
        shiftId: uuid,
        customerId: uuid.nullable().optional(),
        discountAmount: z.number().min(0).max(1_000_000).default(0),
        notes: z.string().max(300).optional(),
        lines: z
          .array(
            z.object({
              variantId: uuid,
              productId: uuid,
              productName: z.string().min(1).max(200),
              unitLabel: z.string().max(40).default("قطعة"),
              sellPrice: z.number().min(0).max(1_000_000),
              costPrice: z.number().min(0).max(1_000_000).nullable().optional(),
              qty: z.number().gt(0).max(100_000),
              discountPct: z.number().min(0).max(100).default(0),
              barcode: z.string().max(64).nullable().optional(),
            }),
          )
          .max(200)
          .default([]),
        unknownLines: z.array(unknownLineSchema).max(50).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_WRITE, round2 } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_WRITE);
    if (data.lines.length === 0 && data.unknownLines.length === 0) throw new Error("CART_EMPTY");

    const { data: numberResult, error: numberError } = await context.supabase.rpc("generate_invoice_number", {
      p_store_id: data.storeId,
      ...(data.branchId ? { p_branch_id: data.branchId } : {}),
    });
    if (numberError) throw new Error("INVOICE_NUMBER_FAILED");

    const { data: invoice, error: invoiceError } = await context.supabase
      .from("pos_invoices")
      .insert({
        store_id: data.storeId,
        branch_id: data.branchId ?? null,
        shift_id: data.shiftId,
        invoice_number: String(numberResult),
        customer_id: data.customerId ?? null,
        cashier_id: context.userId,
        discount_amount: data.discountAmount,
        notes: data.notes ?? null,
      })
      .select("id, invoice_number")
      .single();
    if (invoiceError || !invoice) throw new Error("INVOICE_CREATE_FAILED");

    const rows = [
      ...data.lines.map((line) => ({
        invoice_id: invoice.id,
        variant_id: line.variantId,
        product_id: line.productId,
        barcode_scanned: line.barcode ?? null,
        product_name_snapshot: line.productName,
        unit_label_snapshot: line.unitLabel || "قطعة",
        sell_price_snapshot: line.sellPrice,
        cost_price_snapshot: line.costPrice ?? null,
        qty: line.qty,
        discount_pct: line.discountPct,
        line_total: round2(line.sellPrice * line.qty * (1 - line.discountPct / 100)),
        is_unknown_product: false,
      })),
      ...data.unknownLines.map((line) => ({
        invoice_id: invoice.id,
        variant_id: null,
        product_id: null,
        barcode_scanned: line.barcode,
        product_name_snapshot: line.name,
        unit_label_snapshot: line.unitLabel || "قطعة",
        sell_price_snapshot: line.sellPrice,
        cost_price_snapshot: null,
        qty: line.qty,
        discount_pct: 0,
        line_total: round2(line.sellPrice * line.qty),
        is_unknown_product: true,
      })),
    ];

    const { error: itemsError } = await context.supabase
      .from("invoice_items")
      .insert(rows as never);
    if (itemsError) {
      await context.supabase.from("pos_invoices").delete().eq("id", invoice.id);
      throw new Error("INVOICE_ITEMS_FAILED");
    }

    const { error: holdError } = await context.supabase.rpc("rpc_hold_invoice", { p_invoice_id: invoice.id });
    if (holdError) {
      await context.supabase.from("pos_invoices").delete().eq("id", invoice.id);
      throw new Error(holdError.message);
    }

    return { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number };
  });

export const posListHeldInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: uuid }).parse(input))
  .handler(async ({ data, context }): Promise<PosHeldInvoice[]> => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const { data: rows, error } = await context.supabase
      .from("pos_invoices")
      .select("id, invoice_number, created_at, discount_amount, customer_id, invoice_items(id, line_total)")
      .eq("store_id", data.storeId)
      .eq("status", "hold")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("HOLD_LIST_FAILED");

    return (rows ?? []).map((r) => {
      const items = (r.invoice_items as unknown as Array<{ id: string; line_total: number }>) ?? [];
      return {
        id: r.id,
        invoiceNumber: r.invoice_number,
        createdAt: r.created_at,
        itemsCount: items.length,
        total: Math.round((items.reduce((s, i) => s + Number(i.line_total), 0) - Number(r.discount_amount)) * 100) / 100,
        customerId: r.customer_id,
      };
    });
  });

/** استرجاع فاتورة معلّقة للسلة: بنرجّع الأسطر وبنحذف الفاتورة المعلّقة عشان مفيش تكرار. */
export const posResumeHeldInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ invoiceId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: invoice, error } = await context.supabase
      .from("pos_invoices")
      .select("id, store_id, status, discount_amount, customer_id")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (error || !invoice) throw new Error("INVOICE_NOT_FOUND");
    if (invoice.status !== "hold") throw new Error("INVOICE_NOT_HELD");

    const { requireStoreRole, ROLE_WRITE } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, invoice.store_id, ROLE_WRITE);

    const { data: items } = await context.supabase
      .from("invoice_items")
      .select(
        "variant_id, product_id, product_name_snapshot, unit_label_snapshot, sell_price_snapshot, cost_price_snapshot, qty, discount_pct, barcode_scanned, is_unknown_product",
      )
      .eq("invoice_id", data.invoiceId);

    const lines: PosCartLine[] = [];
    const unknownLines: Array<{ barcode: string; name: string; sellPrice: number; qty: number; unitLabel: string }> = [];

    for (const item of items ?? []) {
      const row = item as unknown as Record<string, unknown>;
      if (row["is_unknown_product"] || !row["variant_id"]) {
        unknownLines.push({
          barcode: String(row["barcode_scanned"] ?? ""),
          name: String(row["product_name_snapshot"]),
          sellPrice: Number(row["sell_price_snapshot"]),
          qty: Number(row["qty"]),
          unitLabel: String(row["unit_label_snapshot"] ?? "قطعة"),
        });
        continue;
      }
      lines.push({
        variantId: String(row["variant_id"]),
        productId: String(row["product_id"]),
        productName: String(row["product_name_snapshot"]),
        unitLabel: String(row["unit_label_snapshot"] ?? "قطعة"),
        sellPrice: Number(row["sell_price_snapshot"]),
        costPrice: row["cost_price_snapshot"] == null ? null : Number(row["cost_price_snapshot"]),
        qty: Number(row["qty"]),
        discountPct: Number(row["discount_pct"] ?? 0),
        barcode: row["barcode_scanned"] == null ? null : String(row["barcode_scanned"]),
        stock: 0,
      });
    }

    // نرجّعها مسودة ثم نحذفها — الحذف مسموح للمسودات فقط.
    await context.supabase.rpc("rpc_resume_invoice", { p_invoice_id: data.invoiceId });
    await context.supabase.from("invoice_items").delete().eq("invoice_id", data.invoiceId);
    await context.supabase.from("pos_invoices").delete().eq("id", data.invoiceId);

    return {
      lines,
      unknownLines,
      discountAmount: Number(invoice.discount_amount),
      customerId: invoice.customer_id,
    };
  });

/* ==================== الأصناف غير المسجّلة ==================== */

export const posListUnknownScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: uuid, includeResolved: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PosUnknownGroup[]> => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    let query = context.supabase
      .from("unknown_scan_items")
      .select("id, barcode, temp_name, manual_price, qty, unit_label, scanned_at, resolved, invoice_id")
      .eq("store_id", data.storeId)
      .order("scanned_at", { ascending: false })
      .limit(500);
    if (!data.includeResolved) query = query.eq("resolved", false);

    const { data: rows, error } = await query;
    if (error) throw new Error("UNKNOWN_LIST_FAILED");

    const groups = new Map<string, PosUnknownGroup>();
    for (const raw of rows ?? []) {
      const row = raw as unknown as Record<string, unknown>;
      const barcode = String(row["barcode"]);
      const price = row["manual_price"] == null ? null : Number(row["manual_price"]);
      const qty = Number(row["qty"] ?? 1);
      const current = groups.get(barcode);
      if (current) {
        current.times += 1;
        current.totalQty += qty;
        current.totalValue = Math.round((current.totalValue + (price ?? 0) * qty) * 100) / 100;
        if (!current.names.includes(String(row["temp_name"]))) current.names.push(String(row["temp_name"]));
        if (row["invoice_id"]) current.invoicesCount += 1;
      } else {
        groups.set(barcode, {
          barcode,
          times: 1,
          totalQty: qty,
          totalValue: Math.round((price ?? 0) * qty * 100) / 100,
          lastPrice: price,
          names: [String(row["temp_name"])],
          lastScannedAt: String(row["scanned_at"]),
          invoicesCount: row["invoice_id"] ? 1 : 0,
          resolved: Boolean(row["resolved"]),
          unitLabel: String(row["unit_label"] ?? "قطعة"),
        });
      }
    }
    return [...groups.values()];
  });

export const posResolveUnknownBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        branchId: uuid.nullable().optional(),
        barcode: z.string().trim().min(3).max(64),
        name: z.string().trim().min(2).max(200),
        sellPrice: z.number().min(0).max(1_000_000),
        costPrice: z.number().min(0).max(1_000_000).nullable().optional(),
        unitLabel: z.string().trim().max(40).default("قطعة"),
        initialQty: z.number().min(0).max(1_000_000).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("rpc_resolve_unknown_barcode", {
      p_store_id: data.storeId,
      p_barcode: data.barcode,
      p_name: data.name,
      p_sell_price: data.sellPrice,
      p_unit_label: data.unitLabel || "قطعة",
      p_initial_qty: data.initialQty,
      ...(data.costPrice == null ? {} : { p_cost_price: data.costPrice }),
      ...(data.branchId ? { p_branch_id: data.branchId } : {}),
    });
    if (error) throw new Error(error.message);
    return result as unknown as { ok: boolean; variant_id: string };
  });

/* ==================== الهوالك والتالف والمنتهي ==================== */

export const posRecordDamage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        branchId: uuid.nullable().optional(),
        variantId: uuid,
        qty: z.number().gt(0).max(1_000_000),
        reason: z.string().trim().max(300).optional(),
        kind: z.enum(["damage", "expiry"]).default("damage"),
        expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("rpc_record_damage", {
      p_store_id: data.storeId,
      p_variant_id: data.variantId,
      p_qty: data.qty,
      p_kind: data.kind,
      ...(data.reason ? { p_reason: data.reason } : {}),
      ...(data.branchId ? { p_branch_id: data.branchId } : {}),
      ...(data.expiryDate ? { p_expiry_date: data.expiryDate } : {}),
    });
    if (error) throw new Error(error.message);
    return result as unknown as { ok: boolean; cost_value: number };
  });

export const posListDamaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const [damaged, expired] = await Promise.all([
      context.supabase
        .from("damaged_items")
        .select("id, qty, reason, created_at, product_variants!inner(products!inner(name))")
        .eq("store_id", data.storeId)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("expired_items")
        .select("id, qty, expiry_date, disposed_at, product_variants!inner(products!inner(name))")
        .eq("store_id", data.storeId)
        .order("disposed_at", { ascending: false })
        .limit(100),
    ]);

    const name = (row: unknown) =>
      (row as { products?: { name?: string } } | null)?.products?.name ?? "منتج";

    return [
      ...(damaged.data ?? []).map((r) => ({
        id: r.id,
        kind: "damage" as const,
        productName: name(r.product_variants),
        qty: Number(r.qty),
        costValue: Number((r as unknown as { cost_value?: number }).cost_value ?? 0),
        reason: r.reason,
        at: r.created_at,
      })),
      ...(expired.data ?? []).map((r) => ({
        id: r.id,
        kind: "expiry" as const,
        productName: name(r.product_variants),
        qty: Number(r.qty),
        costValue: Number((r as unknown as { cost_value?: number }).cost_value ?? 0),
        reason: r.expiry_date ? `انتهت ${r.expiry_date}` : null,
        at: r.disposed_at,
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));
  });

/* ==================== تنبيهات النواقص ==================== */

export const posMarkAlertOrdered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: uuid, alertId: uuid, ordered: z.boolean().default(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_STOCK } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_STOCK);

    const { error } = await context.supabase
      .from("stock_alerts")
      .update({ is_ordered: data.ordered } as never)
      .eq("id", data.alertId)
      .eq("store_id", data.storeId);
    if (error) throw new Error("ALERT_UPDATE_FAILED");
    return { ok: true };
  });

/* ==================== سجل الطباعة ==================== */

export const posLogPrint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        invoiceId: uuid.nullable().optional(),
        documentType: z.enum(["invoice", "reprint", "shift_report", "daily_report"]).default("invoice"),
        paperSize: z.enum(["80mm", "58mm", "A4"]).default("80mm"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("print_logs").insert({
      store_id: data.storeId,
      invoice_id: data.invoiceId ?? null,
      document_type: data.documentType,
      printed_by: context.userId,
      paper_size: data.paperSize,
    } as never);
    if (error) return { ok: false };
    return { ok: true };
  });
