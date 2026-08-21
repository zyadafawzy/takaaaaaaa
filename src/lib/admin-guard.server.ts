import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const SUPER_ADMIN_ROLES: AppRole[] = ["super_admin"];
export const SETTINGS_ROLES: AppRole[] = ["super_admin", "store_manager"];
export const CATALOG_ROLES: AppRole[] = ["super_admin", "store_manager", "inventory_operator"];
export const ORDER_ROLES: AppRole[] = ["super_admin", "store_manager", "order_operator"];

export type StaffIdentity = {
  userId: string;
  email: string;
  role: AppRole;
  fullName: string;
};

/**
 * يتحقق من دور الموظف من قاعدة البيانات (مش من المتصفح).
 * بيرمي خطأ لو المستخدم مش موظف نشط أو دوره مش مسموح.
 */
export async function requireStaff(
  supabase: SupabaseClient<Database>,
  userId: string,
  allowed: AppRole[],
): Promise<StaffIdentity> {
  const { data, error } = await supabase
    .from("admin_profiles")
    .select("user_id, email, role, full_name, active")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("FORBIDDEN");
  if (!data || !data.active) throw new Error("FORBIDDEN");
  if (!allowed.includes(data.role)) throw new Error("FORBIDDEN_ROLE");

  return { userId, email: data.email, role: data.role, fullName: data.full_name };
}

export async function writeAudit(
  identity: StaffIdentity,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: identity.userId,
    actor_email: identity.email,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata as never,
  });
}
