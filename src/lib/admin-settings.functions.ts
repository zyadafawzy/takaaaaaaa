import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const settingsSchema = z.object({
  storeName: z.string(),
  whatsappNumber: z.string(),
  openingHours: z.string(),
  branchAddress: z.string(),
  acceptingOrders: z.boolean(),
  pickupEnabled: z.boolean(),
  substitutionPolicyText: z.string(),
  announcement: z.string().optional(),
});

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const { requireStaff, SETTINGS_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, SETTINGS_ROLES);

    // الدالة دي محجوزة للخادم الموثوق بس — بننفذها بعد التأكد من صلاحية الموظف.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("upsert_app_setting", {
      p_key: "store",
      p_value: data as any,
      p_is_public: true,
    });

    if (error) throw new Error("SETTINGS_UPDATE_FAILED");

    await writeAudit(identity, "update_settings", "app_settings", "store", data);
    return { ok: true };
  });

export const adminListZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context) throw new Error("Unauthorized");
    const { requireStaff, SETTINGS_ROLES } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, SETTINGS_ROLES);

    const { data, error } = await context.supabase
      .from("delivery_zones")
      .select("*")
      .order("sort_order");

    if (error) throw new Error("ZONES_FETCH_FAILED");
    return data;
  });

export const adminUpdateZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      governorate: z.string().optional(),
      fee: z.number().optional(),
      minimumOrder: z.number().optional(),
      freeDeliveryThreshold: z.number().nullable().optional(),
      available: z.boolean().optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const { requireStaff, SETTINGS_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, SETTINGS_ROLES);

    const { id, ...updates } = data;
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.governorate !== undefined) dbUpdates.governorate = updates.governorate;
    if (updates.fee !== undefined) dbUpdates.fee = updates.fee;
    if (updates.minimumOrder !== undefined) dbUpdates.minimum_order = updates.minimumOrder;
    if (updates.freeDeliveryThreshold !== undefined) dbUpdates.free_delivery_threshold = updates.freeDeliveryThreshold;
    if (updates.available !== undefined) dbUpdates.available = updates.available;

    const { error } = await context.supabase
      .from("delivery_zones")
      .update(dbUpdates)
      .eq("id", id);

    if (error) throw new Error("ZONE_UPDATE_FAILED");

    await writeAudit(identity, "update_zone", "delivery_zones", id, updates);
    return { ok: true };
  });

export const adminCreateZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      name: z.string(),
      governorate: z.string(),
      fee: z.number(),
      minimumOrder: z.number(),
      freeDeliveryThreshold: z.number().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const { requireStaff, SETTINGS_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, SETTINGS_ROLES);

    const { error, data: inserted } = await context.supabase
      .from("delivery_zones")
      .insert({
        name: data.name,
        governorate: data.governorate,
        fee: data.fee,
        minimum_order: data.minimumOrder,
        free_delivery_threshold: data.freeDeliveryThreshold,
        available: true,
      } as any)
      .select()
      .single();

    if (error) throw new Error("ZONE_CREATE_FAILED");

    await writeAudit(identity, "create_zone", "delivery_zones", inserted.id, data);
    return inserted;
  });

export const adminDeleteZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const { requireStaff, SETTINGS_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, SETTINGS_ROLES);

    const { error } = await context.supabase
      .from("delivery_zones")
      .delete()
      .eq("id", data.id);

    if (error) throw new Error("ZONE_DELETE_FAILED");

    await writeAudit(identity, "delete_zone", "delivery_zones", data.id, {});
    return { ok: true };
  });
