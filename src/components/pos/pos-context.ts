import type { PosBranch, PosMembership, PosPaymentMethod, PosRole, PosShift } from "@/types/pos";

export { POS_ROLE_LABELS } from "@/types/pos";

/** كل اللي شاشات الكاشير محتاجاه من السياق المشترك. */
export type PosBootstrapContext = {
  storeId: string;
  storeName: string;
  role: PosRole;
  branchId: string | null;
  branches: PosBranch[];
  paymentMethods: PosPaymentMethod[];
  shift: PosShift | null;
  memberships: PosMembership[];
  setBranchId: (branchId: string | null) => void;
  setStoreId: (storeId: string) => void;
  refresh: () => void;
};

export const POS_MANAGE_ROLES: PosRole[] = ["store_owner", "branch_manager"];
export const POS_STOCK_ROLES: PosRole[] = ["store_owner", "branch_manager", "inventory_clerk"];
export const POS_WRITE_ROLES: PosRole[] = ["store_owner", "branch_manager", "cashier", "inventory_clerk"];

export function posCan(role: PosRole, allowed: PosRole[]): boolean {
  return allowed.includes(role);
}
