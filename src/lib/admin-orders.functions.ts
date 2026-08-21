import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** admin_update_order_status — الدور يتحقق من قاعدة البيانات، مش من المتصفح. */
export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().min(6).max(40),
        status: z.enum([
          "new",
          "awaiting_whatsapp",
          "needs_call",
          "preparing",
          "out_for_delivery",
          "delivered",
          "cancelled",
        ]),
        note: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff, ORDER_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, ORDER_ROLES);

    const { data: order, error } = await context.supabase
      .from("orders")
      .update({ status: data.status as any })
      .eq("token", data.token)
      .select("id, token, status")
      .maybeSingle();

    if (error) throw new Error("UPDATE_FAILED");
    if (!order) throw new Error("ORDER_NOT_FOUND");

    await context.supabase.from("order_events").insert({
      order_id: order.id,
      label: `الحالة بقت: ${data.status}`,
      actor: identity.fullName || identity.email,
      actor_user_id: identity.userId,
    });

    if (data.note) {
      await context.supabase.from("order_notes").insert({
        order_id: order.id,
        body: data.note,
        author_user_id: identity.userId,
        author_name: identity.fullName || identity.email,
      });
    }

    await writeAudit(identity, "admin_update_order_status", "orders", order.id, {
      status: data.status,
    });

    return { ok: true, status: order.status };
  });

/** قائمة الطلبات للفريق مع دعم التقسيم (Pagination). */
export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.string().optional().nullable(),
        query: z.string().optional(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, [
      "super_admin",
      "store_manager",
      "order_operator",
      "ceo_viewer",
    ]);

    const limit = data.limit ?? 50;
    const offset = data.offset ?? 0;

    let query = context.supabase
      .from("orders")
      .select(
        `token, order_number, status, created_at, customer_first_name, customer_phone,
         zone_name, fulfillment, grand_total, items_total, delivery_fee, discount_total,
         order_items ( product_name, size_label, quantity, unit_price )`,
        { count: "exact" },
      );

    if (data.status && (data.status as string) !== "all") {
      query = query.eq("status", data.status as any);
    }

    if (data.query) {
      const q = data.query.trim();
      query = query.or(`order_number.ilike.%${q}%,customer_phone.ilike.%${q}%,customer_first_name.ilike.%${q}%`);
    }

    const { data: orders, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    return {
      orders: orders ?? [],
      total: count ?? 0,
      offset,
      limit,
    };
  });
