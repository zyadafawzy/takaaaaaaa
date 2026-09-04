import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, RotateCcw, Save, Search } from "lucide-react";
import { toast } from "sonner";

import { usePos } from "@/components/pos/PosShell";
import { POS_MANAGE_ROLES, posCan } from "@/components/pos/pos-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { posCatalogList, posCatalogResetPrice, posCatalogSetPrice } from "@/lib/pos-catalog.functions";
import type { PosCatalogItem } from "@/types/pos";

export const Route = createFileRoute("/pos/catalog")({
  head: () => ({
    meta: [
      { title: "كتالوج الماكينة | تِكّة" },
      {
        name: "description",
        content: "كتالوج باركود ماكينة الكاشير: أصناف ثابتة بباركود مقفول وأسعار يحددها كل متجر.",
      },
      { property: "og:title", content: "كتالوج الماكينة | تِكّة" },
      { property: "og:description", content: "أسعار أصناف ماكينة الكاشير لكل متجر — الباركود مقفول." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PosCatalogPage,
});

export function PosCatalogPage() {
  const pos = usePos();
  const canEdit = posCan(pos.role, POS_MANAGE_ROLES);
  const [items, setItems] = useState<PosCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const result = await posCatalogList({
        data: { storeId: pos.storeId, page, ...(search ? { query: search } : {}) },
      });
      setItems(result.items);
      setTotal(result.total);
    } catch {
      toast.error("مقدرناش نحمّل كتالوج الماكينة.");
    }
    setBusy(false);
  }, [page, pos.storeId, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePrice = async (item: PosCatalogItem) => {
    const value = Number(drafts[item.id]);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("سعر غير صحيح.");
      return;
    }
    setBusy(true);
    try {
      await posCatalogSetPrice({ data: { storeId: pos.storeId, itemId: item.id, sellPrice: value } });
      toast.success("السعر اتحدّث للمتجر.");
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      await load();
    } catch {
      toast.error("مقدرناش نحدّث السعر — محتاج صلاحية مدير.");
    }
    setBusy(false);
  };

  const resetPrice = async (item: PosCatalogItem) => {
    setBusy(true);
    try {
      await posCatalogResetPrice({ data: { storeId: pos.storeId, itemId: item.id } });
      toast.success("رجع لسعر الكتالوج.");
      await load();
    } catch {
      toast.error("مقدرناش نرجّع السعر.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">كتالوج ماكينة الكاشير</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("ar-EG")} صنف بباركود ثابت. تقدر تغيّر السعر لمتجرك بس — الباركود والاسم مقفولين.
          </p>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(0);
            setSearch(query.trim());
          }}
        >
          <Input
            value={query}
            placeholder="اسم الصنف أو الباركود"
            className="h-11 w-64"
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={busy}>
            <Search className="size-4" />
            بحث
          </Button>
        </form>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {items.map((item) => {
          const effective = item.storePrice ?? item.defaultPrice;
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-[9px] text-muted-foreground">
                    بدون صورة
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.name}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="size-3" />
                  <span className="font-mono">{item.barcode}</span>
                  <span>· {item.unitLabel}</span>
                </span>
              </span>

              <span className="text-end text-sm">
                <span className="block text-muted-foreground">سعر الكتالوج</span>
                <span className="block font-bold tabular-nums">{formatPrice(item.defaultPrice)}</span>
              </span>

              {canEdit ? (
                <span className="flex items-center gap-2">
                  <Input
                    value={drafts[item.id] ?? String(effective)}
                    inputMode="decimal"
                    className="h-11 w-28 text-center"
                    aria-label={`سعر ${item.name} في المتجر`}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                    }
                  />
                  <Button size="sm" disabled={busy} onClick={() => void savePrice(item)}>
                    <Save className="size-4" />
                  </Button>
                  {item.storePrice != null ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      aria-label="رجّع لسعر الكتالوج"
                      onClick={() => void resetPrice(item)}
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  ) : null}
                </span>
              ) : (
                <span className="text-end text-sm">
                  <span className="block text-muted-foreground">سعر المتجر</span>
                  <span className="block font-black text-primary tabular-nums">{formatPrice(effective)}</span>
                </span>
              )}
            </li>
          );
        })}
        {items.length === 0 && !busy ? (
          <li className="p-6 text-center text-sm text-muted-foreground">مفيش أصناف بالبحث ده.</li>
        ) : null}
      </ul>

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={page === 0 || busy} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          السابق
        </Button>
        <span className="text-sm text-muted-foreground">صفحة {page + 1}</span>
        <Button variant="outline" disabled={busy || (page + 1) * 40 >= total} onClick={() => setPage((p) => p + 1)}>
          التالي
        </Button>
      </div>
    </div>
  );
}
