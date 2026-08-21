import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, PlusCircle, Settings2, Power, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

import {
  developerListStores,
  developerUpdateStore,
  developerDeleteStore,
  developerSetStoreMaintenance,
} from "@/lib/developer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/developer/stores/")({
  component: DeveloperStores,
});

const statusLabels: Record<string, string> = {
  active: "نشط",
  draft: "مسودة",
  suspended: "موقوف",
};

function DeveloperStores() {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<string>("all");

  const storesQuery = useQuery({
    queryKey: ["developer-stores"],
    queryFn: () => developerListStores(),
  });

  const toggleStatus = useMutation({
    mutationFn: (input: { id: string; next: "active" | "suspended" }) =>
      developerUpdateStore({ data: { id: input.id, store: { status: input.next } } }),
    onSuccess: () => {
      toast.success("تم تحديث حالة السوبرماركت");
      void queryClient.invalidateQueries({ queryKey: ["developer-stores"] });
    },
    onError: () => toast.error("مقدرناش نحدّث الحالة"),
  });

  const toggleMaintenance = useMutation({
    mutationFn: (input: { id: string; on: boolean }) =>
      developerSetStoreMaintenance({ data: { id: input.id, isMaintenance: input.on } }),
    onSuccess: () => {
      toast.success("تم تحديث وضع الصيانة");
      void queryClient.invalidateQueries({ queryKey: ["developer-stores"] });
    },
    onError: () => toast.error("مقدرناش نغيّر وضع الصيانة"),
  });

  const removeStore = useMutation({
    mutationFn: (id: string) => developerDeleteStore({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف السوبرماركت");
      void queryClient.invalidateQueries({ queryKey: ["developer-stores"] });
    },
    onError: () => toast.error("مقدرناش نحذف السوبرماركت"),
  });

  const rows = (storesQuery.data ?? []).filter((store) => {
    const matchesTerm =
      !term.trim() ||
      store.name.includes(term.trim()) ||
      store.slug.includes(term.trim().toLowerCase());
    const matchesStatus = status === "all" || store.status === status;
    return matchesTerm && matchesStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-black">السوبرماركتات</h1>
          <p className="text-xs text-muted-foreground">
            كل سوبرماركت له رابطه وهويته وبياناته المعزولة.
          </p>
        </div>
        <Button asChild className="ms-auto gap-1.5 rounded-xl">
          <Link to="/developer/new">
            <PlusCircle className="size-4" /> سوبرماركت جديد
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="ابحث بالاسم أو الرابط..."
          className="h-10 max-w-xs rounded-xl"
          aria-label="بحث في السوبرماركتات"
        />
        {["all", "active", "draft", "suspended"].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setStatus(value)}
          >
            {value === "all" ? "الكل" : statusLabels[value]}
          </Button>
        ))}
      </div>

      {storesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          مفيش سوبرماركتات مطابقة.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((store) => (
            <li
              key={store.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4"
            >
              {store.logoUrl ? (
                <img
                  src={store.logoUrl}
                  alt={store.name}
                  width={48}
                  height={48}
                  className="size-12 rounded-xl object-cover"
                />
              ) : (
                <span className="grid size-12 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground">
                  {store.name.slice(0, 1)}
                </span>
              )}

              <div className="min-w-40">
                <p className="text-sm font-black">
                  {store.name}
                  {store.is_master ? (
                    <span className="ms-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                      المتجر الأساسي
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  /s/{store.slug} · {statusLabels[store.status] ?? store.status}
                </p>
              </div>

              <div className="flex gap-5 text-xs text-muted-foreground">
                <span>
                  منتجات: <b className="text-foreground">{store.productCount}</b>
                </span>
                <span>
                  طلبات: <b className="text-foreground">{store.orderCount}</b>
                </span>
                <span>
                  مبيعات: <b className="text-foreground">{formatPrice(store.revenue)}</b>
                </span>
              </div>

              <div className="ms-auto flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" asChild className="gap-1">
                  <Link to="/s/$storeSlug" params={{ storeSlug: store.slug }} target="_blank">
                    <ExternalLink className="size-3.5" /> المتجر
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild className="gap-1">
                  <Link to="/developer/stores/$id" params={{ id: store.id }}>
                    <Settings2 className="size-3.5" /> إدارة
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant={(store as { is_maintenance?: boolean }).is_maintenance ? "default" : "ghost"}
                  className="gap-1"
                  disabled={toggleMaintenance.isPending}
                  onClick={() =>
                    toggleMaintenance.mutate({
                      id: store.id,
                      on: !(store as { is_maintenance?: boolean }).is_maintenance,
                    })
                  }
                >
                  <Wrench className="size-3.5" />
                  {(store as { is_maintenance?: boolean }).is_maintenance ? "إنهاء الصيانة" : "إيقاف للصيانة"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  disabled={toggleStatus.isPending}
                  onClick={() =>
                    toggleStatus.mutate({
                      id: store.id,
                      next: store.status === "active" ? "suspended" : "active",
                    })
                  }
                >
                  <Power className="size-3.5" />
                  {store.status === "active" ? "إيقاف" : "تفعيل"}
                </Button>
                {!store.is_master ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-destructive"
                    disabled={removeStore.isPending}
                    onClick={() => {
                      if (confirm(`حذف ${store.name} نهائيًا؟`)) removeStore.mutate(store.id);
                    }}
                  >
                    <Trash2 className="size-3.5" /> حذف
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
