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
import { posCheckout } from "@/lib/pos.functions";

export type OfflineMode = "offline" | "online";

export type OutboxInvoice = {
  id: string;
  storeId: string;
  createdAt: string;
  localNumber: string;
  total: number;
  payload: Parameters<typeof posCheckout>[0] extends { data: infer D } ? D : never;
  lastError?: string;
};

type OfflineValue = {
  isOnline: boolean;
  mode: OfflineMode | null;
  chooseMode: (mode: OfflineMode) => void;
  snapshot: OfflineSnapshotData | null;
  downloading: boolean;
  download: () => Promise<void>;
  outbox: OutboxInvoice[];
  queueInvoice: (item: Omit<OutboxInvoice, "id" | "createdAt">) => Promise<void>;
  sync: (silent?: boolean) => Promise<void>;
  syncing: boolean;
};

const OfflineContext = createContext<OfflineValue | null>(null);

export function useOffline(): OfflineValue | null {
  return useContext(OfflineContext);
}

const OUTBOX_KEY = "outbox";
const snapKey = (storeId: string) => `snapshot:${storeId}`;
const modeKey = (storeId: string) => `tikka.offline-mode.${storeId}`;

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
  const [outbox, setOutbox] = useState<OutboxInvoice[]>([]);
  const [syncing, setSyncing] = useState(false);
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
    void idbGet<OutboxInvoice[]>(OUTBOX_KEY).then((items) =>
      setOutbox((items ?? []).filter((item) => item.storeId === storeId)),
    );
  }, [storeId]);

  const persistOutbox = useCallback(async (items: OutboxInvoice[]) => {
    setOutbox(items);
    await idbSet(OUTBOX_KEY, items);
  }, []);

  const download = useCallback(async () => {
    setDownloading(true);
    try {
      const data = await posOfflineSnapshot({ data: { storeId, branchId } });
      await idbSet(snapKey(storeId), data);
      setSnapshot(data);
      toast.success(`اتحمّل ${data.variants.length} صنف للعمل بدون إنترنت.`);
    } catch {
      toast.error("مقدرناش نحمّل البيانات للعمل أوفلاين.");
    }
    setDownloading(false);
  }, [branchId, storeId]);

  const chooseMode = useCallback(
    (next: OfflineMode) => {
      window.localStorage.setItem(modeKey(storeId), next);
      setMode(next);
      if (next === "offline") void download();
    },
    [download, storeId],
  );

  /** خصم الكميات محليًا بعد بيع أوفلاين عشان مانبيعش أكتر من المتاح. */
  const applyLocalStock = useCallback(
    async (payload: unknown) => {
      const lines = (payload as { lines?: Array<{ variantId?: string | null; qty?: number }> } | null)?.lines;
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
    async (item: Omit<OutboxInvoice, "id" | "createdAt">) => {
      const entry: OutboxInvoice = {
        ...item,
        id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      const current = (await idbGet<OutboxInvoice[]>(OUTBOX_KEY)) ?? [];
      await persistOutbox([...current, entry]);
      await applyLocalStock(entry.payload);
    },
    [applyLocalStock, persistOutbox],
  );

  const sync = useCallback(
    async (silent = false) => {
      if (syncingRef.current) return;
      if (!window.navigator.onLine) return;
      const all = (await idbGet<OutboxInvoice[]>(OUTBOX_KEY)) ?? [];
      const pending = all.filter((item) => item.storeId === storeId);
      const others = all.filter((item) => item.storeId !== storeId);
      if (pending.length === 0) {
        if (!silent) toast.info("مفيش فواتير متأخرة للرفع.");
        return;
      }
      syncingRef.current = true;
      setSyncing(true);
      const rest: OutboxInvoice[] = [];
      let sent = 0;
      let failed = 0;
      for (const item of pending) {
        try {
          await posCheckout({ data: item.payload as never });
          sent += 1;
        } catch (error) {
          failed += 1;
          rest.push({ ...item, lastError: error instanceof Error ? error.message : "SYNC_FAILED" });
        }
      }
      const merged = [...others, ...rest];
      setOutbox(rest);
      await idbSet(OUTBOX_KEY, merged);
      syncingRef.current = false;
      setSyncing(false);
      if (sent > 0) toast.success(`اترفع ${sent} فاتورة على السيرفر.`);
      if (failed > 0 && !silent) toast.error("بعض الفواتير فشل رفعها — هنجرب تاني لما النت يستقر.");
    },
    [storeId],
  );

  useEffect(() => {
    if (!isOnline || outbox.length === 0) return;
    const timer = window.setTimeout(() => void sync(true), 2000);
    const interval = window.setInterval(() => void sync(true), 30000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [isOnline, outbox.length, sync]);

  // تحديث تلقائي للنسخة المحلية كل ربع ساعة في وضع الأوفلاين.
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
      downloading,
      download,
      outbox,
      queueInvoice,
      sync,
      syncing,
    }),
    [chooseMode, download, downloading, isOnline, mode, outbox, queueInvoice, snapshot, sync, syncing],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}
