import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  PosBranch,
  PosCustomer,
  PosInvoiceFull,
  PosInvoiceSummary,
  PosMembership,
  PosPaymentMethod,
  PosScanResult,
  PosShift,
} from "@/types/pos";

const uuid = z.string().uuid();

/* ============================ 1. التهيئة ============================ */

export type PosBootstrap = {
  memberships: PosMembership[];
  branches: PosBranch[];
  paymentMethods: PosPaymentMethod[];
  openShift: PosShift | null;
  role: string | null;
};

export const posBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: uuid.optional() }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<PosBootstrap> => {
    const { listMemberships } = await import("./pos.server");
    const memberships = await listMemberships(context.supabase, context.userId);

    if (memberships.length === 0) {
      return { memberships: [], branches: [], paymentMethods: [], openShift: null, role: null };
    }

    const active = memberships.find((m) => m.storeId === data.storeId) ?? memberships[0]!;

    const [branchesRes, methodsRes, shiftRes] = await Promise.all([
      context.supabase
        .from("branches")
        .select("id, store_id, name, address, phone, allow_negative_stock, is_active")
        .eq("store_id", active.storeId)
        .order("name"),
      context.supabase
        .from("payment_methods")
        .select("id, name, type, is_active, sort_order")
        .eq("store_id", active.storeId)
        .eq("is_active", true)
        .order("sort_order"),
      context.supabase
        .from("cash_shifts")
        .select("id, store_id, branch_id, opened_at, opening_amount, status")
        .eq("store_id", active.storeId)
        .eq("cashier_id", context.userId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      memberships,
      branches: (branchesRes.data ?? []).map((b) => ({
        id: b.id,
        storeId: b.store_id,
        name: b.name,
        address: b.address,
        phone: b.phone,
        allowNegativeStock: b.allow_negative_stock,
        isActive: b.is_active,
      })),
      paymentMethods: (methodsRes.data ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type as PosPaymentMethod["type"],
      })),
      openShift: shiftRes.data
        ? {
            id: shiftRes.data.id,
            storeId: shiftRes.data.store_id,
            branchId: shiftRes.data.branch_id,
            openedAt: shiftRes.data.opened_at,
            openingAmount: Number(shiftRes.data.opening_amount),
            status: shiftRes.data.status as PosShift["status"],
          }
        : null,
      role: active.role,
    };
  });

/** تهيئة أولية للمتجر: فرع رئيسي + طرق دفع افتراضية + تسجيل المستخدم كصاحب متجر. */
export const posSetupStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: uuid, branchName: z.string().min(2).max(80).default("الفرع الرئيسي") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("pos_is_superadmin", { _user_id: context.userId });
    if (!isOwner) {
      const { requireStoreRole, ROLE_MANAGE } = await import("./pos.server");
      await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_MANAGE);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingBranch } = await supabaseAdmin
      .from("branches")
      .select("id")
      .eq("store_id", data.storeId)
      .limit(1)
      .maybeSingle();

    let branchId = existingBranch?.id ?? null;
    if (!branchId) {
      const { data: created, error } = await supabaseAdmin
        .from("branches")
        .insert({ store_id: data.storeId, name: data.branchName })
        .select("id")
        .single();
      if (error) throw new Error("BRANCH_CREATE_FAILED");
      branchId = created.id;
    }

    const defaults = [
      { name: "نقدي", type: "cash", sort_order: 1 },
      { name: "بطاقة", type: "card", sort_order: 2 },
      { name: "محفظة إلكترونية", type: "wallet", sort_order: 3 },
      { name: "آجل", type: "credit", sort_order: 4 },
    ];
    for (const m of defaults) {
      await supabaseAdmin
        .from("payment_methods")
        .upsert({ store_id: data.storeId, ...m }, { onConflict: "store_id,name" });
    }

    await supabaseAdmin.from("pos_members").upsert(
      {
        store_id: data.storeId,
        branch_id: branchId,
        user_id: context.userId,
        email: context.claims?.email ?? "",
        role: "store_owner",
        is_active: true,
      },
      { onConflict: "store_id,user_id" },
    );

    return { ok: true, branchId };
  });

/* ============================ 2. الورديات ============================ */

export const posOpenShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        branchId: uuid.nullable().optional(),
        openingAmount: z.number().min(0).max(1_000_000).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PosShift> => {
    const { requireStoreRole, ROLE_WRITE } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_WRITE);

    const { data: open } = await context.supabase
      .from("cash_shifts")
      .select("id")
      .eq("store_id", data.storeId)
      .eq("cashier_id", context.userId)
      .eq("status", "open")
      .maybeSingle();

    if (open) throw new Error("SHIFT_ALREADY_OPEN");

    const { data: created, error } = await context.supabase
      .from("cash_shifts")
      .insert({
        store_id: data.storeId,
        branch_id: data.branchId ?? null,
        cashier_id: context.userId,
        opening_amount: data.openingAmount,
      })
      .select("id, store_id, branch_id, opened_at, opening_amount, status")
      .single();

    if (error) throw new Error("SHIFT_OPEN_FAILED");

    return {
      id: created.id,
      storeId: created.store_id,
      branchId: created.branch_id,
      openedAt: created.opened_at,
      openingAmount: Number(created.opening_amount),
      status: created.status as PosShift["status"],
    };
  });

export const posCloseShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shiftId: uuid, closingAmount: z.number().min(0).max(10_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("rpc_close_shift", {
      p_shift_id: data.shiftId,
      p_closing_amount: data.closingAmount,
    });
    if (error) throw new Error(error.message);
    return result as unknown as {
      ok: boolean;
      expected: number;
      difference: number;
      sales: number;
      invoices: number;
    };
  });

/* ============================ 3. المسح والبحث ============================ */

export const posScanBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        branchId: uuid.nullable().optional(),
        barcode: z.string().trim().min(1).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PosScanResult> => {
    const { data: result, error } = await context.supabase.rpc("rpc_scan_barcode", {
      p_store_id: data.storeId,
      p_barcode: data.barcode,
      ...(data.branchId ? { p_branch_id: data.branchId } : {}),
    });
    if (error) throw new Error(error.message);
    const raw = result as unknown as Record<string, unknown>;
    if (!raw?.["found"]) return { found: false, barcode: data.barcode };
    return {
      found: true,
      barcode: String(raw["barcode"]),
      variantId: String(raw["variant_id"]),
      productId: String(raw["product_id"]),
      productName: String(raw["product_name"]),
      unitLabel: String(raw["unit_label"] ?? "قطعة"),
      sellPrice: Number(raw["sell_price"] ?? 0),
      costPrice: raw["cost_price"] == null ? null : Number(raw["cost_price"]),
      stock: Number(raw["stock"] ?? 0),
    };
  });

/** بحث بالاسم داخل الكتالوج — للأصناف اللي مالهاش باركود. */
export const posSearchVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: uuid, branchId: uuid.nullable().optional(), query: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const { data: rows, error } = await context.supabase
      .from("product_variants")
      .select("id, product_id, price, cost_price, unit_label, size_label, active, products!inner(id, name)")
      .eq("active", true)
      .ilike("products.name", `%${data.query}%`)
      .limit(20);

    if (error) throw new Error("POS_SEARCH_FAILED");

    const variantIds = (rows ?? []).map((r) => r.id);
    const stockMap = new Map<string, number>();
    if (variantIds.length > 0) {
      const { data: stock } = await context.supabase
        .from("inventory_stock")
        .select("variant_id, qty_on_hand, branch_id")
        .eq("store_id", data.storeId)
        .in("variant_id", variantIds);
      for (const s of stock ?? []) {
        if (data.branchId && s.branch_id && s.branch_id !== data.branchId) continue;
        stockMap.set(s.variant_id, Number(s.qty_on_hand));
      }
    }

    return (rows ?? []).map((r) => {
      const product = r.products as unknown as { id: string; name: string };
      return {
        variantId: r.id,
        productId: r.product_id,
        productName: product?.name ?? "منتج",
        unitLabel: r.unit_label ?? r.size_label ?? "قطعة",
        sellPrice: Number(r.price),
        costPrice: r.cost_price == null ? null : Number(r.cost_price),
        stock: stockMap.get(r.id) ?? 0,
      };
    });
  });

/* ============================ 4. البيع ============================ */

const cartLineSchema = z.object({
  variantId: uuid,
  productId: uuid,
  productName: z.string().min(1).max(200),
  unitLabel: z.string().max(40).default("قطعة"),
  sellPrice: z.number().min(0).max(1_000_000),
  costPrice: z.number().min(0).max(1_000_000).nullable().optional(),
  qty: z.number().gt(0).max(100_000),
  discountPct: z.number().min(0).max(100).default(0),
  barcode: z.string().max(64).nullable().optional(),
});

/** صنف غير مسجّل: بيتباع بسعر يدوي وبيتسجّل في تقرير المجهولات. */
export const unknownLineSchema = z.object({
  barcode: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200).default("منتج غير مسجل"),
  sellPrice: z.number().min(0).max(1_000_000),
  qty: z.number().gt(0).max(100_000),
  unitLabel: z.string().max(40).default("قطعة"),
  notes: z.string().max(300).optional(),
});


export const posCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        branchId: uuid.nullable().optional(),
        shiftId: uuid,
        customerId: uuid.nullable().optional(),
        discountAmount: z.number().min(0).max(1_000_000).default(0),
        taxAmount: z.number().min(0).max(1_000_000).default(0),
        notes: z.string().max(400).optional(),
        lines: z.array(cartLineSchema).max(200).default([]),
        unknownLines: z.array(unknownLineSchema).max(50).default([]),
        payments: z
          .array(z.object({ methodId: uuid, amount: z.number().gt(0).max(1_000_000), reference: z.string().max(60).optional() }))
          .max(5)
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_WRITE, round2 } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_WRITE);

    if (data.lines.length === 0 && data.unknownLines.length === 0) throw new Error("CART_EMPTY");


    const { data: shift } = await context.supabase
      .from("cash_shifts")
      .select("id, status, store_id")
      .eq("id", data.shiftId)
      .maybeSingle();
    if (!shift || shift.status !== "open" || shift.store_id !== data.storeId) {
      throw new Error("SHIFT_NOT_OPEN");
    }

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
        tax_amount: data.taxAmount,
        notes: data.notes ?? null,
      })
      .select("id, invoice_number")
      .single();

    if (invoiceError || !invoice) throw new Error("INVOICE_CREATE_FAILED");

    const items = data.lines.map((line) => {
      const gross = line.sellPrice * line.qty;
      return {
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
        line_total: round2(gross * (1 - line.discountPct / 100)),
      };
    });

    const { error: itemsError } = await context.supabase.from("invoice_items").insert(items);
    if (itemsError) {
      await context.supabase.from("pos_invoices").delete().eq("id", invoice.id);
      throw new Error("INVOICE_ITEMS_FAILED");
    }

    if (data.payments.length > 0) {
      const { error: payError } = await context.supabase.from("invoice_payments").insert(
        data.payments.map((p) => ({
          invoice_id: invoice.id,
          method_id: p.methodId,
          amount: p.amount,
          reference: p.reference ?? null,
        })),
      );
      if (payError) {
        await context.supabase.from("pos_invoices").delete().eq("id", invoice.id);
        throw new Error("INVOICE_PAYMENTS_FAILED");
      }
    }

    const { data: confirmed, error: confirmError } = await context.supabase.rpc("rpc_confirm_invoice", {
      p_invoice_id: invoice.id,
    });

    if (confirmError) {
      await context.supabase.from("pos_invoices").delete().eq("id", invoice.id);
      throw new Error(confirmError.message);
    }

    const result = confirmed as unknown as Record<string, unknown>;
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      total: Number(result["total"] ?? 0),
      paid: Number(result["paid"] ?? 0),
      change: Number(result["change"] ?? 0),
    };
  });

export const posVoidInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ invoiceId: uuid, reason: z.string().trim().min(3).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("rpc_void_invoice", {
      p_invoice_id: data.invoiceId,
      p_reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const posListInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: uuid, limit: z.number().int().min(1).max(200).default(50) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PosInvoiceSummary[]> => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const { data: rows, error } = await context.supabase
      .from("pos_invoices")
      .select("id, invoice_number, total, paid_amount, status, created_at, customers(name), invoice_items(id)")
      .eq("store_id", data.storeId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) throw new Error("POS_INVOICES_FAILED");

    return (rows ?? []).map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      total: Number(r.total),
      paidAmount: Number(r.paid_amount),
      status: r.status as PosInvoiceSummary["status"],
      createdAt: r.created_at,
      customerName: (r.customers as unknown as { name: string } | null)?.name ?? null,
      itemsCount: ((r.invoice_items as unknown as unknown[]) ?? []).length,
    }));
  });

export const posGetInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ invoiceId: uuid }).parse(input))
  .handler(async ({ data, context }): Promise<PosInvoiceFull> => {
    const { data: row, error } = await context.supabase
      .from("pos_invoices")
      .select(
        "id, store_id, invoice_number, subtotal, discount_amount, tax_amount, total, paid_amount, change_amount, status, created_at, void_reason, customers(name), branches(name), invoice_items(id, product_name_snapshot, unit_label_snapshot, sell_price_snapshot, qty, discount_pct, line_total), invoice_payments(id, amount, payment_methods(name))",
      )
      .eq("id", data.invoiceId)
      .maybeSingle();

    if (error || !row) throw new Error("INVOICE_NOT_FOUND");

    const items = (row.invoice_items as unknown as Array<Record<string, unknown>>) ?? [];
    const payments = (row.invoice_payments as unknown as Array<Record<string, unknown>>) ?? [];

    return {
      id: row.id,
      storeId: row.store_id,
      invoiceNumber: row.invoice_number,
      subtotal: Number(row.subtotal),
      discountAmount: Number(row.discount_amount),
      taxAmount: Number(row.tax_amount),
      total: Number(row.total),
      paidAmount: Number(row.paid_amount),
      changeAmount: Number(row.change_amount),
      status: row.status as PosInvoiceFull["status"],
      createdAt: row.created_at,
      voidReason: row.void_reason,
      customerName: (row.customers as unknown as { name: string } | null)?.name ?? null,
      branchName: (row.branches as unknown as { name: string } | null)?.name ?? null,
      itemsCount: items.length,
      items: items.map((i) => ({
        id: String(i["id"]),
        productName: String(i["product_name_snapshot"]),
        unitLabel: String(i["unit_label_snapshot"]),
        sellPrice: Number(i["sell_price_snapshot"]),
        qty: Number(i["qty"]),
        discountPct: Number(i["discount_pct"]),
        lineTotal: Number(i["line_total"]),
      })),
      payments: payments.map((p) => ({
        id: String(p["id"]),
        methodName: (p["payment_methods"] as { name?: string } | null)?.name ?? "دفع",
        amount: Number(p["amount"]),
      })),
    };
  });

/* ============================ 5. العملاء ============================ */

export const posListCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: uuid, query: z.string().trim().max(60).optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PosCustomer[]> => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    let query = context.supabase
      .from("customers")
      .select("id, name, phone, address, customer_credit_accounts(current_balance), loyalty_accounts(points_balance)")
      .eq("store_id", data.storeId)
      .is("deleted_at", null)
      .order("name")
      .limit(100);

    if (data.query) query = query.or(`name.ilike.%${data.query}%,phone.ilike.%${data.query}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error("POS_CUSTOMERS_FAILED");

    return (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      address: r.address,
      balance: Number(
        (r.customer_credit_accounts as unknown as Array<{ current_balance: number }>)?.[0]?.current_balance ?? 0,
      ),
      points: Number((r.loyalty_accounts as unknown as Array<{ points_balance: number }>)?.[0]?.points_balance ?? 0),
    }));
  });

export const posCreateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(20).optional(),
        address: z.string().trim().max(200).optional(),
        creditLimit: z.number().min(0).max(1_000_000).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_WRITE } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_WRITE);

    const { data: created, error } = await context.supabase
      .from("customers")
      .insert({
        store_id: data.storeId,
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.code === "23505" ? "CUSTOMER_PHONE_EXISTS" : "CUSTOMER_CREATE_FAILED");

    await context.supabase
      .from("customer_credit_accounts")
      .insert({ customer_id: created.id, store_id: data.storeId, credit_limit: data.creditLimit });
    await context.supabase.from("loyalty_accounts").insert({ customer_id: created.id, store_id: data.storeId });

    return { id: created.id };
  });

export const posCustomerLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ customerId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_ledger_entries")
      .select("id, entry_type, debit, credit, balance_after, notes, created_at, invoice_id")
      .eq("customer_id", data.customerId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error("LEDGER_FAILED");

    return (rows ?? []).map((r) => ({
      id: r.id,
      entryType: r.entry_type,
      debit: Number(r.debit),
      credit: Number(r.credit),
      balanceAfter: Number(r.balance_after),
      notes: r.notes,
      createdAt: r.created_at,
      invoiceId: r.invoice_id,
    }));
  });

export const posCustomerPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ customerId: uuid, amount: z.number().gt(0).max(1_000_000), notes: z.string().max(200).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("rpc_customer_payment", {
      p_customer_id: data.customerId,
      p_amount: data.amount,
      ...(data.notes ? { p_notes: data.notes } : {}),
    });
    if (error) throw new Error(error.message);
    return result as unknown as { ok: boolean; balance: number };
  });

/* ============================ 6. الموردون والمشتريات ============================ */

export const posListSuppliers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const { data: rows, error } = await context.supabase
      .from("suppliers")
      .select("id, name, phone, address, tax_number, supplier_ledger_entries(balance_after, created_at)")
      .eq("store_id", data.storeId)
      .is("deleted_at", null)
      .order("name");

    if (error) throw new Error("SUPPLIERS_FAILED");

    return (rows ?? []).map((r) => {
      const entries = ((r.supplier_ledger_entries as unknown as Array<{ balance_after: number; created_at: string }>) ?? [])
        .slice()
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        address: r.address,
        taxNumber: r.tax_number,
        balance: Number(entries[0]?.balance_after ?? 0),
      };
    });
  });

export const posCreateSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(20).optional(),
        address: z.string().trim().max(200).optional(),
        taxNumber: z.string().trim().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_STOCK } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_STOCK);

    const { data: created, error } = await context.supabase
      .from("suppliers")
      .insert({
        store_id: data.storeId,
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
        tax_number: data.taxNumber || null,
      })
      .select("id")
      .single();

    if (error) throw new Error("SUPPLIER_CREATE_FAILED");
    return { id: created.id };
  });

export const posCreatePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        branchId: uuid.nullable().optional(),
        supplierId: uuid,
        invoiceNumber: z.string().trim().max(60).optional(),
        invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        paidAmount: z.number().min(0).max(10_000_000).default(0),
        notes: z.string().max(300).optional(),
        items: z
          .array(
            z.object({
              variantId: uuid,
              productName: z.string().min(1).max(200),
              costPrice: z.number().min(0).max(1_000_000),
              qty: z.number().gt(0).max(1_000_000),
              expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
            }),
          )
          .min(1)
          .max(200),
        confirm: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_STOCK, round2 } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_STOCK);

    const total = round2(data.items.reduce((sum, i) => sum + i.costPrice * i.qty, 0));

    const { data: created, error } = await context.supabase
      .from("purchase_invoices")
      .insert({
        store_id: data.storeId,
        branch_id: data.branchId ?? null,
        supplier_id: data.supplierId,
        invoice_number: data.invoiceNumber || null,
        invoice_date: data.invoiceDate,
        total,
        paid_amount: data.paidAmount,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (error || !created) throw new Error("PURCHASE_CREATE_FAILED");

    const { error: itemsError } = await context.supabase.from("purchase_items").insert(
      data.items.map((i) => ({
        purchase_invoice_id: created.id,
        variant_id: i.variantId,
        product_name_snapshot: i.productName,
        cost_price: i.costPrice,
        qty: i.qty,
        expiry_date: i.expiryDate ?? null,
        line_total: round2(i.costPrice * i.qty),
      })),
    );

    if (itemsError) {
      await context.supabase.from("purchase_invoices").delete().eq("id", created.id);
      throw new Error("PURCHASE_ITEMS_FAILED");
    }

    if (data.confirm) {
      const { error: confirmError } = await context.supabase.rpc("rpc_confirm_purchase", {
        p_purchase_id: created.id,
      });
      if (confirmError) throw new Error(confirmError.message);
    }

    return { id: created.id, total };
  });

export const posListPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const { data: rows, error } = await context.supabase
      .from("purchase_invoices")
      .select("id, invoice_number, invoice_date, total, paid_amount, status, suppliers(name)")
      .eq("store_id", data.storeId)
      .order("invoice_date", { ascending: false })
      .limit(100);

    if (error) throw new Error("PURCHASES_FAILED");

    return (rows ?? []).map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      invoiceDate: r.invoice_date,
      total: Number(r.total),
      paidAmount: Number(r.paid_amount),
      status: r.status,
      supplierName: (r.suppliers as unknown as { name: string } | null)?.name ?? "مورد",
    }));
  });

/* ============================ 7. المخزون والباركود ============================ */

export const posInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: uuid, branchId: uuid.nullable().optional(), query: z.string().trim().max(60).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const { data: rows, error } = await context.supabase
      .from("inventory_stock")
      .select(
        "id, variant_id, branch_id, qty_on_hand, updated_at, product_variants!inner(id, price, unit_label, size_label, min_stock_qty, products!inner(name))",
      )
      .eq("store_id", data.storeId)
      .order("updated_at", { ascending: false })
      .limit(300);

    if (error) throw new Error("INVENTORY_FAILED");

    const list = (rows ?? []).map((r) => {
      const variant = r.product_variants as unknown as {
        price: number;
        unit_label: string | null;
        size_label: string | null;
        min_stock_qty: number;
        products: { name: string };
      };
      return {
        variantId: r.variant_id,
        branchId: r.branch_id,
        productName: variant?.products?.name ?? "منتج",
        unitLabel: variant?.unit_label ?? variant?.size_label ?? "قطعة",
        price: Number(variant?.price ?? 0),
        minStockQty: Number(variant?.min_stock_qty ?? 0),
        qtyOnHand: Number(r.qty_on_hand),
        updatedAt: r.updated_at,
      };
    });

    const filtered = data.branchId ? list.filter((r) => r.branchId === data.branchId || r.branchId === null) : list;
    return data.query ? filtered.filter((r) => r.productName.includes(data.query!)) : filtered;
  });

export const posAdjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        branchId: uuid.nullable().optional(),
        variantId: uuid,
        qtyNew: z.number().min(-1_000_000).max(1_000_000),
        reason: z.string().trim().min(2).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("rpc_adjust_stock", {
      p_store_id: data.storeId,
      p_branch_id: (data.branchId ?? undefined) as string,
      p_variant_id: data.variantId,
      p_qty_new: data.qtyNew,
      p_reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return result as unknown as { ok: boolean; qty_before: number; qty_after: number };
  });

export const posStockAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const { data: rows, error } = await context.supabase
      .from("stock_alerts")
      .select("id, alert_type, triggered_at, variant_id, product_variants!inner(products!inner(name))")
      .eq("store_id", data.storeId)
      .eq("is_active", true)
      .order("triggered_at", { ascending: false })
      .limit(100);

    if (error) throw new Error("ALERTS_FAILED");

    return (rows ?? []).map((r) => ({
      id: r.id,
      alertType: r.alert_type,
      triggeredAt: r.triggered_at,
      productName:
        (r.product_variants as unknown as { products: { name: string } } | null)?.products?.name ?? "منتج",
    }));
  });

export const posAttachBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        variantId: uuid,
        barcode: z.string().trim().min(3).max(64),
        isPrimary: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_STOCK } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_STOCK);

    const { error } = await context.supabase.from("product_barcodes").upsert(
      {
        store_id: data.storeId,
        variant_id: data.variantId,
        barcode: data.barcode,
        is_primary: data.isPrimary,
      },
      { onConflict: "store_id,barcode" },
    );

    if (error) throw new Error("BARCODE_ATTACH_FAILED");

    await context.supabase
      .from("unknown_scan_items")
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: context.userId })
      .eq("store_id", data.storeId)
      .eq("barcode", data.barcode)
      .eq("resolved", false);

    return { ok: true };
  });

export const posUnknownScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const { data: rows, error } = await context.supabase
      .from("unknown_scan_items")
      .select("id, barcode, scanned_at, resolved")
      .eq("store_id", data.storeId)
      .eq("resolved", false)
      .order("scanned_at", { ascending: false })
      .limit(100);

    if (error) throw new Error("UNKNOWN_SCANS_FAILED");
    return (rows ?? []).map((r) => ({ id: r.id, barcode: r.barcode, scannedAt: r.scanned_at }));
  });

/* ============================ 8. الطباعة ============================ */

export const posLogPrint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: uuid, invoiceId: uuid.nullable().optional(), documentType: z.string().max(40).default("invoice_80mm") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await context.supabase.from("print_logs").insert({
      store_id: data.storeId,
      invoice_id: data.invoiceId ?? null,
      document_type: data.documentType,
      printed_by: context.userId,
    });
    return { ok: true };
  });
