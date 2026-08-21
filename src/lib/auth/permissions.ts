import type { AdminRole } from "@/domain/types";

/**
 * مصفوفة صلاحيات الواجهة.
 * ملاحظة مهمة: ده إخفاء أزرار فقط. الحماية الفعلية بتتم على الخادم/قاعدة البيانات في الأمر الثاني.
 */

export type Permission =
  | "orders.view"
  | "orders.update"
  | "orders.contact"
  | "catalog.view"
  | "catalog.edit"
  | "inventory.view"
  | "inventory.edit"
  | "promotions.manage"
  | "delivery.manage"
  | "settings.manage"
  | "reports.view"
  | "users.manage";

const matrix: Record<AdminRole, Permission[]> = {
  super_admin: [
    "orders.view",
    "orders.update",
    "orders.contact",
    "catalog.view",
    "catalog.edit",
    "inventory.view",
    "inventory.edit",
    "promotions.manage",
    "delivery.manage",
    "settings.manage",
    "reports.view",
    "users.manage",
  ],
  store_manager: [
    "orders.view",
    "orders.update",
    "orders.contact",
    "catalog.view",
    "catalog.edit",
    "inventory.view",
    "inventory.edit",
    "promotions.manage",
    "delivery.manage",
    "reports.view",
  ],
  order_operator: ["orders.view", "orders.update", "orders.contact", "catalog.view"],
  inventory_operator: ["catalog.view", "catalog.edit", "inventory.view", "inventory.edit"],
  ceo_viewer: ["reports.view", "orders.view"],
};

export const roleLabels: Record<AdminRole, string> = {
  super_admin: "مدير النظام",
  store_manager: "مدير المتجر",
  order_operator: "موظف طلبات",
  inventory_operator: "موظف مخزون",
  ceo_viewer: "قراءة تقارير",
};

export function can(role: AdminRole, permission: Permission): boolean {
  return matrix[role].includes(permission);
}
