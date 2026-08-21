import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { Search, Loader2, Save, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { adminListProducts, adminSyncInventory } from "@/lib/admin-catalog.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAdminAuth } from "@/lib/auth/admin-auth";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/inventory")({
  component: AdminInventory,
});

function AdminInventory() {
  const { allowed, ready } = useAdminAuth();
  const canEdit = allowed("inventory.edit");
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [localUpdates, setLocalUpdates] = useState<Record<string, { stock?: number; available?: boolean; sort_order?: number }>>({});

  // Simple debounce for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0); // Reset page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const productsQuery = useQuery({ 
    queryKey: ["admin-inventory", debouncedSearch, page], 
    queryFn: () => adminListProducts({ data: { search: debouncedSearch, page, sort: "name" } }),
    enabled: ready && allowed("inventory.view")
  });

  const syncMutation = useMutation({
    mutationFn: (updates: any[]) => adminSyncInventory({ data: { updates } }),
    onSuccess: () => {
      toast.success("تم تحديث المخزون بنجاح");
      setLocalUpdates({});
      queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
    },
    onError: () => {
      toast.error("فشل تحديث المخزون");
    }
  });

  const handleStockChange = (productId: string, stock: number) => {
    setLocalUpdates(prev => ({
      ...prev,
      [productId]: { ...prev[productId], stock }
    }));
  };

  const handleAvailabilityChange = (productId: string, available: boolean) => {
    setLocalUpdates(prev => ({
      ...prev,
      [productId]: { ...prev[productId], available }
    }));
  };

  const hasChanges = Object.keys(localUpdates).length > 0;

  const handleSave = () => {
    const updates = Object.entries(localUpdates).map(([productId, changes]) => ({
      productId,
      ...changes
    }));
    syncMutation.mutate(updates);
  };

  if (!allowed("inventory.view")) {
    return <p className="text-sm text-muted-foreground">دورك مايسمحش بالمخزون.</p>;
  }

  const items = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / (productsQuery.data?.pageSize ?? 50));

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">إدارة المخزون</h1>
          <p className="text-sm text-muted-foreground">
            عرض وتعديل حالة المنتجات والكميات (إجمالي {total} منتج).
          </p>
        </div>
        <div className="flex items-center gap-2">
           {hasChanges && (
            <Button onClick={handleSave} disabled={syncMutation.isPending} className="gap-2">
              {syncMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              حفظ التعديلات ({Object.keys(localUpdates).length})
            </Button>
          )}
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-inventory"] })}
            disabled={productsQuery.isFetching}
          >
            <RefreshCw className={`size-4 ${productsQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو SKU..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-semibold">
              <tr>
                <th className="p-4 text-start">المنتج</th>
                <th className="p-4 text-start">السعر</th>
                <th className="p-4 text-start w-20 text-center">الترتيب</th>
                <th className="p-4 text-start text-center">المخزون</th>
                <th className="p-4 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {productsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">جاري التحميل...</td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">لم يتم العثور على منتجات.</td>
                </tr>
              ) : (
                items.map((product) => {
                  const local = localUpdates[product.id];
                  const currentStock = local?.stock ?? product.stock;
                  const currentAvailable = local?.available ?? product.available;

                  return (
                    <tr key={product.id} className={`hover:bg-muted/30 transition-colors ${currentStock === 0 ? "bg-destructive/5" : ""}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {product.thumbnailUrl ? (
                            <img
                              src={product.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              className="size-10 rounded-lg object-cover border border-border"
                            />
                          ) : (
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                              N/A
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold truncate max-w-[200px]">{product.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-medium">{formatPrice(product.price)}</td>
                      <td className="p-4">
                        <Input
                          type="number"
                          className={`h-9 w-16 text-center font-mono text-xs ${local?.sort_order !== undefined ? 'border-primary ring-1 ring-primary' : ''}`}
                          value={local?.sort_order ?? product.sort_order ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setLocalUpdates({
                              ...localUpdates,
                              [product.id]: { ...localUpdates[product.id], sort_order: val }
                            });
                          }}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className={`h-9 w-20 text-center font-bold ${local?.stock !== undefined ? 'border-primary ring-1 ring-primary' : ''}`}
                            disabled={!canEdit}
                            value={currentStock}
                            onChange={(e) => handleStockChange(product.id, parseInt(e.target.value) || 0)}
                          />
                          {product.stock === 0 && !local?.stock && (
                            <span className="text-[10px] font-bold text-destructive">نفذ</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={currentAvailable}
                            disabled={!canEdit}
                            onCheckedChange={(checked) => handleAvailabilityChange(product.id, checked)}
                            className={local?.available !== undefined ? 'data-[state=checked]:bg-primary' : ''}
                          />
                          <span className={`text-[10px] font-medium ${currentAvailable ? 'text-success' : 'text-muted-foreground'}`}>
                            {currentAvailable ? 'نشط' : 'متوقف'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            صفحة {page + 1} من {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || productsQuery.isFetching}
              onClick={() => setPage(p => p - 1)}
              className="gap-1"
            >
              <ChevronRight className="size-4" /> السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || productsQuery.isFetching}
              onClick={() => setPage(p => p + 1)}
              className="gap-1"
            >
              التالي <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}