import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * جداول/دوال مركز المبيعات أحدث من ملف الأنواع المولّد،
 * فبنستخدم عميل غير مقيّد بالأنواع للقراءة الإدارية المحصّنة بالكود.
 */
export type LooseClient = SupabaseClient<any, "public", any>;

export async function looseAdmin(): Promise<LooseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as LooseClient;
}

export const CAIRO_TZ = "Africa/Cairo";

export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** حدود اليوم بتوقيت القاهرة (+02:00) محوّلة إلى UTC للاستعلام. */
export function cairoRange(dateFrom: string, dateTo: string): { from: string; to: string } {
  return {
    from: new Date(`${dateFrom}T00:00:00+02:00`).toISOString(),
    to: new Date(`${dateTo}T23:59:59.999+02:00`).toISOString(),
  };
}

export function cairoDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CAIRO_TZ }).format(new Date(iso));
}

export function cairoHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: CAIRO_TZ, hour: "2-digit", hour12: false }).format(
      new Date(iso),
    ),
  );
}

/** تطبيع رقم مصري إلى E.164 — بدون تخمين. */
export function normalizeEgyptPhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (/^01\d{9}$/.test(digits)) return `+2${digits}`;
  if (/^201\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export type SaleSource = "inplace" | "delivery" | "all";

/** فلترة المصدر: أي فاتورة غير ديليفري تُعتبر بيع مكان. */
export function applySource<T extends { eq: (c: string, v: string) => T; neq: (c: string, v: string) => T }>(
  query: T,
  source: SaleSource,
): T {
  if (source === "delivery") return query.eq("sale_source", "delivery");
  if (source === "inplace") return query.neq("sale_source", "delivery");
  return query;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

/** صلاحية المستخدم على المتجر + هل يرى التكلفة/الربح. */
export async function resolveStoreAccess(supabase: unknown, userId: string, storeSlug: string) {
  const { requireStoreAccess } = await import("./store-admin.server");
  const access = await requireStoreAccess(supabase as never, userId, storeSlug);
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
