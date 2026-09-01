import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PosMembership, PosRole } from "@/types/pos";

type Client = SupabaseClient<Database>;

export const ROLE_WRITE: PosRole[] = ["store_owner", "branch_manager", "cashier", "inventory_clerk"];
export const ROLE_MANAGE: PosRole[] = ["store_owner", "branch_manager"];
export const ROLE_STOCK: PosRole[] = ["store_owner", "branch_manager", "inventory_clerk"];
export const ROLE_ANY: PosRole[] = [...ROLE_WRITE, "viewer"];

/** عضويات المستخدم في نقاط البيع + المتاجر الخاصة بها. */
export async function listMemberships(supabase: Client, userId: string): Promise<PosMembership[]> {
  const { data: members, error } = await supabase
    .from("pos_members")
    .select("store_id, branch_id, role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw new Error("POS_MEMBERSHIP_FAILED");

  const rows = members ?? [];

  // مدير النظام العام يشوف كل المتاجر.
  const { data: isOwner } = await supabase.rpc("pos_is_superadmin", { _user_id: userId });

  if (isOwner) {
    const { data: stores } = await supabase.from("stores").select("id, name, slug").order("name");
    return (stores ?? []).map((s) => ({
      storeId: s.id,
      storeName: s.name,
      storeSlug: s.slug,
      branchId: rows.find((r) => r.store_id === s.id)?.branch_id ?? null,
      role: "store_owner" as PosRole,
    }));
  }

  if (rows.length === 0) return [];

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, slug")
    .in("id", rows.map((r) => r.store_id));

  return rows.map((r) => {
    const store = (stores ?? []).find((s) => s.id === r.store_id);
    return {
      storeId: r.store_id,
      storeName: store?.name ?? "متجر",
      storeSlug: store?.slug ?? "",
      branchId: r.branch_id,
      role: r.role as PosRole,
    };
  });
}

/** يتحقق من صلاحية المستخدم على المتجر — من قاعدة البيانات، مش من المتصفح. */
export async function requireStoreRole(
  supabase: Client,
  userId: string,
  storeId: string,
  allowed: PosRole[],
): Promise<PosRole> {
  const { data: isOwner } = await supabase.rpc("pos_is_superadmin", { _user_id: userId });
  if (isOwner) return "store_owner";

  const { data, error } = await supabase
    .from("pos_members")
    .select("role, is_active")
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (error || !data || !data.is_active) throw new Error("POS_FORBIDDEN");
  if (!allowed.includes(data.role as PosRole)) throw new Error("POS_FORBIDDEN_ROLE");
  return data.role as PosRole;
}

export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** بداية/نهاية اليوم بتوقيت القاهرة كـ ISO. */
export function cairoDayRange(dateFrom: string, dateTo: string): { from: string; to: string } {
  return {
    from: new Date(`${dateFrom}T00:00:00+02:00`).toISOString(),
    to: new Date(`${dateTo}T23:59:59.999+02:00`).toISOString(),
  };
}
