import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { idbGet, idbSet } from "@/lib/offline/idb";
import { posOfflineSnapshot, type OfflineSnapshotData } from "@/lib/offline-snapshot.functions";
import {
  posAdjustStock,
  posCheckout,
  posCloseOfflineShift,
  posCreateCustomer,
  posCreatePurchase,
  posCustomerPayment,
} from "@/lib/pos.functions";
import { posRecordDamage } from "@/lib/pos-ops.functions";

export type OfflineMode = "offline" | "online";

/** أقصى عدد محاولات رفع قبل ما الفاتورة تتوقف وتنتظر مراجعة يدوية. */
export const MAX_SYNC_ATTEMPTS = 5;
/** بعد الوقت ده اللقطة المحلية تُعتبر قديمة ويظهر تحذير. */
export const SNAPSHOT_STALE_HOURS = 12;

export type OutboxInvoice = {
  id: string;
  storeId: string;
  createdAt: string;
  localNumber: string;
  /** المعرّف الفريد اللي بيمنع رفع الفاتورة مرتين. */
  clientInvoiceId: string;
  total: number;
  payload: Record<string, unknown>;
  attempts: number;
  lastError?: string | undefined;
  blocked?: boolean | undefined;
  /** رقم الفاتورة الرسمي بعد الرفع. */
  officialNumber?: string | undefined;
  officialInvoiceId?: string | undefined;
  syncedAt?: string | undefined;
};

export type OfflineOpType =
  | "adjustStock"
  | "purchase"
  | "damage"
  | "createCustomer"
  | "customerPayment";

export type OutboxOp = {
  id: string;
  storeId: string;
  type: OfflineOpType;
  label: string;
  createdAt: string;
  payload: Record<string, unknown>;
  attempts: number;
  lastError?: string | undefined;
  blocked?: boolean | undefined;
};

export type LocalShift = {
  clientShiftId: string;
  storeId: string;
  branchId: string | null;
  openedAt: string;
  openingAmount: number;
  closedAt?: string | undefined;
  invoices: number;
  sales: number;
};

type OfflineValue = {
  isOnline: boolean;
  mode: OfflineMode | null;
  chooseMode: (mode: OfflineMode) => void;
  snapshot: OfflineSnapshotData | null;
  snapshotStale: boolean;
  downloading: boolean;
  download: (options?: { full?: boolean }) => Promise<void>;
  outbox: OutboxInvoice[];
  syncedInvoices: OutboxInvoice[];
  ops: OutboxOp[];
  queueInvoice: (item: {
    storeId: string;
    localNumber: string;
    clientInvoiceId: string;
    total: number;
    payload: Record<string, unknown>;
  }) => Promise<void>;
  queueOp: (item: { type: OfflineOpType; label: string; payload: Record<string, unknown> }) => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  retryOp: (id: string) => Promise<void>;
  removeOp: (id: string) => Promise<void>;
  clearSynced: () => Promise<void>;
  sync: (silent?: boolean) => Promise<void>;
  syncing: boolean;
  /** الوردية المحلية (تشتغل من غير نت) */
  localShift: LocalShift | null;
  openLocalShift: (openingAmount: number) => Promise<LocalShift>;
  closeLocalShift: (closingAmount: number) => Promise<void>;
};

const OfflineContext = createContext<OfflineValue | null>(null);

export function useOffline(): OfflineValue | null {
  return useContext(OfflineContext);
}

const OUTBOX_KEY = "outbox";
const OPS_KEY = "outbox-ops";
const snapKey = (storeId: string) => `snapshot:${storeId}`;
const shiftKey = (storeId: string) => `local-shift:${storeId}`;
const modeKey = (storeId: string) => `tikka.offline-mode.${storeId}`;

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function OfflineProvider({
  storeId,
  branchId,
  children,
}: {
  storeId: string;
  branchId: string | null;
  children: ReactNode;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [mode, setMode] = useState<OfflineMode | null>(null);
  const [snapshot, setSnapshot] = useState<OfflineSnapshotData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [allInvoices, setAllInvoices] = useState<OutboxInvoice[]>([]);
  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [localShift, setLocalShift] = useState<LocalShift | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    setIsOnline(window.navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(modeKey(storeId));
    setMode(saved === "offline" || saved === "online" ? saved : null);
    void idbGet<OfflineSnapshotData>(snapKey(storeId)).then(setSnapshot);
    void idbGet<LocalShift>(shiftKey(storeId)).then((shift) =>
      setLocalShift(shift && !shift.closedAt ? shift : null),
    );
    void idbGet<OutboxInvoice[]>(OUTBOX_KEY).then((items) =>
      setAllInvoices((items ?? []).filter((item) => item.storeId === storeId)),
    );
    void idbGet<OutboxOp[]>(OPS_KEY).then((items) =>
      setOps((items ?? []).filter((item) => item.storeId === storeId)),
    );
  }, [storeId]);

  const outbox = useMemo(() => allInvoices.filter((item) => !item.syncedAt), [allInvoices]);
  const syncedInvoices = useMemo(() => allInvoices.filter((item) => Boolean(item.syncedAt)), [allInvoices]);

  const snapshotStale = useMemo(() => {
    if (!snapshot) return false;
    return Date.now() - new Date(snapshot.takenAt).getTime() > SNAPSHOT_STALE_HOURS * 3600 * 1000;
  }, [snapshot]);

  /** الحفظ: بنقرأ الكل من التخزين، نستبدل بيانات المتجر الحالي ونسيب باقي المتاجر زي ما هي. */
  const persistInvoices = useCallback(
    async (items: OutboxInvoice[]) => {
      setAllInvoices(items);
      const all = (await idbGet<OutboxInvoice[]>(OUTBOX_KEY)) ?? [];
      await idbSet(OUTBOX_KEY, [...all.filter((item) => item.storeId !== storeId), ...items]);
    },
    [storeId],
  );

  const persistOps = useCallback(
    async (items: OutboxOp[]) => {
      setOps(items);
      const all = (await idbGet<OutboxOp[]>(OPS_KEY)) ?? [];
      await idbSet(OPS_KEY, [...all.filter((item) => item.storeId !== storeId), ...items]);
    },
    [storeId],
  );

  const download = useCallback(
    async (options?: { full?: boolean }) => {
      setDownloading(true);
      try {
        const current = await idbGet<OfflineSnapshotData>(snapKey(storeId));
        const canDelta = !options?.full && current && current.branchId === (branchId ?? null);
        const data = await posOfflineSnapshot({
          data: { storeId, branchId, ...(canDelta ? { since: current!.takenAt } : {}) },
        });

        let merged: OfflineSnapshotData = data;
        if (data.partial && current) {
          const map = new Map(current.variants.map((variant) => [variant.variantId, variant]));
          for (const variant of data.variants) map.set(variant.variantId, variant);
          merged = { ...data, partial: false, variants: [...map.values()] };
        }

        await idbSet(snapKey(storeId), merged);
        setSnapshot(merged);
        toast.success(
          data.partial
            ? `تحديث سريع: ${data.variants.length} صنف اتغيّر (الإجمالي ${merged.variants.length}).`
            : `اتحمّل ${merged.variants.length} صنف للعمل بدون إنترنت.`,
        );
      } catch {
        toast.error("مقدرناش نحمّل البيانات للعمل أوفلاين.");
      }
      setDownloading(false);
    },
    [branchId, storeId],
  );

  const chooseMode = useCallback(
    (next: OfflineMode) => {
      window.localStorage.setItem(modeKey(storeId), next);
      setMode(next);
      if (next === "offline") void download({ full: true });
    },
    [download, storeId],
  );

  /* ===================== الوردية المحلية ===================== */

  const openLocalShift = useCallback(
    async (openingAmount: number) => {
      const shift: LocalShift = {
        clientShiftId: newId(`shift-${storeId.slice(0, 8)}`),
        storeId,
        branchId,
        openedAt: new Date().toISOString(),
        openingAmount,
        invoices: 0,
        sales: 0,
      };
      await idbSet(shiftKey(storeId), shift);
      setLocalShift(shift);
      return shift;
    },
    [branchId, storeId],
  );

  const closeLocalShift = useCallback(
    async (closingAmount: number) => {
      const shift = await idbGet<LocalShift>(shiftKey(storeId));
      if (!shift) return;
      const closed: LocalShift = { ...shift, closedAt: new Date().toISOString() };
      await idbSet(shiftKey(storeId), closed);
      setLocalShift(null);
      if (window.navigator.onLine) {
        try {
          await posCloseOfflineShift({ data: { storeId, clientShiftId: shift.clientShiftId, closingAmount } });
        } catch {
          toast.info("الوردية اتقفلت محليًا — القفل على السيرفر هيتم أول ما النت يرجع.");
        }
      }
    },
    [storeId],
  );

  /* ===================== الطوابير ===================== */

  /** خصم الكميات محليًا بعد بيع أوفلاين عشان مانبيعش أكتر من المتاح. */
  const applyLocalStock = useCallback(
    async (payload: Record<string, unknown>) => {
      const lines = (payload as { lines?: Array<{ variantId?: string | null; qty?: number }> }).lines;
      if (!Array.isArray(lines) || lines.length === 0) return;
      const current = await idbGet<OfflineSnapshotData>(snapKey(storeId));
      if (!current) return;
      const next: OfflineSnapshotData = {
        ...current,
        variants: current.variants.map((variant) => {
          const sold = lines
            .filter((line) => line.variantId === variant.variantId)
            .reduce((sum, line) => sum + Number(line.qty ?? 0), 0);
          return sold > 0 ? { ...variant, stock: variant.stock - sold } : variant;
        }),
      };
      await idbSet(snapKey(storeId), next);
      setSnapshot(next);
    },
    [storeId],
  );

  const queueInvoice = useCallback(
    async (item: {
      storeId: string;
      localNumber: string;
      clientInvoiceId: string;
      total: number;
      payload: Record<string, unknown>;
    }) => {
      const entry: OutboxInvoice = {
        ...item,
        id: newId("off"),
        createdAt: new Date().toISOString(),
        attempts: 0,
      };
      await persistInvoices([...allInvoices, entry]);
      await applyLocalStock(entry.payload);

      const shift = await idbGet<LocalShift>(shiftKey(storeId));
      if (shift && !shift.closedAt) {
        const updated: LocalShift = {
          ...shift,
          invoices: shift.invoices + 1,
          sales: Math.round((shift.sales + item.total) * 100) / 100,
        };
        await idbSet(shiftKey(storeId), updated);
        setLocalShift(updated);
      }
    },
    [allInvoices, applyLocalStock, persistInvoices, storeId],
  );

  const queueOp = useCallback(
    async (item: { type: OfflineOpType; label: string; payload: Record<string, unknown> }) => {
      const entry: OutboxOp = { ...item, id: newId("op"), storeId, createdAt: new Date().toISOString(), attempts: 0 };
      await persistOps([...ops, entry]);
    },
    [ops, persistOps, storeId],
  );

  const runOp = useCallback(async (op: OutboxOp) => {
    const payload = op.payload as never;
    switch (op.type) {
      case "adjustStock":
        await posAdjustStock({ data: payload });
        return;
      case "purchase":
        await posCreatePurchase({ data: payload });
        return;
      case "damage":
        await posRecordDamage({ data: payload });
        return;
      case "createCustomer":
        await posCreateCustomer({ data: payload });
        return;
      case "customerPayment":
        await posCustomerPayment({ data: payload });
        return;
      default:
        throw new Error("UNKNOWN_OP");
    }
  }, []);

  const sync = useCallback(
    async (silent = false) => {
      if (syncingRef.current) return;
      if (!window.navigator.onLine) {
        if (!silent) toast.error("مفيش اتصال — الرفع هيتم لما النت يرجع.");
        return;
      }

      const invoices = (await idbGet<OutboxInvoice[]>(OUTBOX_KEY)) ?? [];
      const pendingInvoices = invoices.filter(
        (item) => item.storeId === storeId && !item.syncedAt && !item.blocked,
      );
      const opsAll = (await idbGet<OutboxOp[]>(OPS_KEY)) ?? [];
      const pendingOps = opsAll.filter((item) => item.storeId === storeId && !item.blocked);

      if (pendingInvoices.length === 0 && pendingOps.length === 0) {
        if (!silent) toast.info("مفيش حاجة متأخرة للرفع.");
        return;
      }

      syncingRef.current = true;
      setSyncing(true);

      const mineInvoices = invoices.filter((item) => item.storeId === storeId);
      const nextInvoices: OutboxInvoice[] = [];
      let sent = 0;
      let failed = 0;

      for (const item of mineInvoices) {
        if (item.syncedAt || item.blocked) {
          nextInvoices.push(item);
          continue;
        }
        try {
          const result = await posCheckout({ data: item.payload as never });
          sent += 1;
          nextInvoices.push({
            ...item,
            attempts: item.attempts + 1,
            syncedAt: new Date().toISOString(),
            officialNumber: result.invoiceNumber,
            officialInvoiceId: result.invoiceId,
            lastError: undefined,
          });
        } catch (error) {
          failed += 1;
          const attempts = item.attempts + 1;
          nextInvoices.push({
            ...item,
            attempts,
            blocked: attempts >= MAX_SYNC_ATTEMPTS,
            lastError: error instanceof Error ? error.message : "SYNC_FAILED",
          });
        }
      }

      const mineOps = opsAll.filter((item) => item.storeId === storeId);
      const nextOps: OutboxOp[] = [];
      let opsSent = 0;
      for (const op of mineOps) {
        if (op.blocked) {
          nextOps.push(op);
          continue;
        }
        try {
          await runOp(op);
          opsSent += 1;
        } catch (error) {
          const attempts = op.attempts + 1;
          nextOps.push({
            ...op,
            attempts,
            blocked: attempts >= MAX_SYNC_ATTEMPTS,
            lastError: error instanceof Error ? error.message : "SYNC_FAILED",
          });
        }
      }

      await persistInvoices(nextInvoices);
      await persistOps(nextOps);

      // قفل الوردية المحلية على السيرفر لو كانت اتقفلت أوفلاين.
      const shift = await idbGet<LocalShift>(shiftKey(storeId));
      if (shift?.closedAt) {
        try {
          await posCloseOfflineShift({ data: { storeId, clientShiftId: shift.clientShiftId, closingAmount: 0 } });
          await idbSet(shiftKey(storeId), { ...shift, clientShiftId: shift.clientShiftId, closedAt: shift.closedAt });
        } catch {
          /* هنجرّب تاني في الدورة اللي بعدها. */
        }
      }

      syncingRef.current = false;
      setSyncing(false);

      if (sent > 0) toast.success(`اترفع ${sent} فاتورة على السيرفر بأرقامها الرسمية.`);
      if (opsSent > 0) toast.success(`اترفعت ${opsSent} عملية مخزون/عملاء متأخرة.`);
      if (failed > 0 && !silent) toast.error("بعض الفواتير فشل رفعها — راجعها من صفحة «المعلّقة».");
    },
    [persistInvoices, persistOps, runOp, storeId],
  );

  const retryItem = useCallback(
    async (id: string) => {
      await persistInvoices(
        allInvoices.map((item) =>
          item.id === id ? { ...item, attempts: 0, blocked: false, lastError: undefined } : item,
        ),
      );
      await sync();
    },
    [allInvoices, persistInvoices, sync],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await persistInvoices(allInvoices.filter((item) => item.id !== id));
    },
    [allInvoices, persistInvoices],
  );

  const retryOp = useCallback(
    async (id: string) => {
      await persistOps(
        ops.map((op) => (op.id === id ? { ...op, attempts: 0, blocked: false, lastError: undefined } : op)),
      );
      await sync();
    },
    [ops, persistOps, sync],
  );

  const removeOp = useCallback(
    async (id: string) => {
      await persistOps(ops.filter((op) => op.id !== id));
    },
    [ops, persistOps],
  );

  const clearSynced = useCallback(async () => {
    await persistInvoices(allInvoices.filter((item) => !item.syncedAt));
  }, [allInvoices, persistInvoices]);

  const pendingCount = outbox.filter((item) => !item.blocked).length + ops.filter((op) => !op.blocked).length;

  useEffect(() => {
    if (!isOnline || pendingCount === 0) return;
    const timer = window.setTimeout(() => void sync(true), 2000);
    const interval = window.setInterval(() => void sync(true), 30000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [isOnline, pendingCount, sync]);

  // تحديث تفاضلي للنسخة المحلية كل ربع ساعة في وضع الأوفلاين.
  useEffect(() => {
    if (mode !== "offline" || !isOnline) return;
    const interval = window.setInterval(() => void download(), 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [download, isOnline, mode]);

  const value = useMemo<OfflineValue>(
    () => ({
      isOnline,
      mode,
      chooseMode,
      snapshot,
      snapshotStale,
      downloading,
      download,
      outbox,
      syncedInvoices,
      ops,
      queueInvoice,
      queueOp,
      retryItem,
      removeItem,
      retryOp,
      removeOp,
      clearSynced,
      sync,
      syncing,
      localShift,
      openLocalShift,
      closeLocalShift,
    }),
    [
      chooseMode,
      clearSynced,
      closeLocalShift,
      download,
      downloading,
      isOnline,
      localShift,
      mode,
      openLocalShift,
      ops,
      outbox,
      queueInvoice,
      queueOp,
      removeItem,
      removeOp,
      retryItem,
      retryOp,
      snapshot,
      snapshotStale,
      sync,
      syncedInvoices,
      syncing,
    ],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}
