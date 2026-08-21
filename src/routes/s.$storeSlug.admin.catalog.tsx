import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { storeAdminCatalog, storeAdminSetProduct } from "@/lib/store-admin.functions";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/s/$storeSlug/admin/catalog")({
  component: StoreAdminCatalog,
});

function StoreAdminCatalog() {
  const { storeSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey: ["store-admin", storeSlug, "catalog", search, offset],
    queryFn: () =>
      storeAdminCatalog({ data: { storeSlug, query: search || undefined, offset, limit: 40 } }),
    retry: false,
  });

  const update = useMutation({
    mutationFn: (data: {
      productId: string;
      enabled?: boolean;
      visible?: boolean;
      featured?: boolean;
      priceOverride?: number | null;
      stockOverride?: number | null;
    }) => storeAdminSetProduct({ data: { storeSlug, ...data } }),
    onSuccess: () => {
      toast.success("تم حفظ المنتج");
      void queryClient.invalidateQueries({ queryKey: ["store-admin", storeSlug, "catalog"] });
    },
    onError: () => toast.error("مقدرناش نحفظ التعديل"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">منتجات المتجر</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          فعّل منتجات الكتالوج وحدد ظهورها وسعرها ومخزونها داخل متجرك فقط.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setOffset(0);
          setSearch(term.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="ps-9"
            placeholder="ابحث باسم المنتج"
          />
        </div>
        <Button type="submit">بحث</Button>
      </form>

      {query.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : query.isError ? (
        <p className="border border-border bg-surface p-6 text-sm text-muted-foreground">
          مش عندك صلاحية لإدارة منتجات المتجر ده.
        </p>
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <p className="border border-border bg-surface p-6 text-sm text-muted-foreground">
          مفيش منتجات مطابقة.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border bg-surface">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 text-start">المنتج</th>
                <th className="p-3 text-start">السعر الأساسي</th>
                <th className="p-3 text-start">سعر المتجر</th>
                <th className="p-3 text-start">مخزون المتجر</th>
                <th className="p-3 text-center">مفعّل</th>
                <th className="p-3 text-center">ظاهر</th>
                <th className="p-3 text-center">مميّز</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {query.data?.items.map((product) => (
                <tr key={product.id}>
                  <td className="p-3">
                    <p className="font-bold">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku}
                      {product.isPrivate ? " · خاص بالمتجر" : ""}
                    </p>
                  </td>
                  <td className="price p-3">{formatPrice(product.basePrice)}</td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-9 w-28"
                      defaultValue={product.priceOverride ?? ""}
                      placeholder="الأساسي"
                      onBlur={(event) =>
                        update.mutate({
                          productId: product.id,
                          priceOverride: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min="0"
                      className="h-9 w-24"
                      defaultValue={product.stockOverride ?? ""}
                      placeholder={String(product.stock)}
                      onBlur={(event) =>
                        update.mutate({
                          productId: product.id,
                          stockOverride: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={product.enabled}
                      onCheckedChange={(enabled) =>
                        update.mutate({ productId: product.id, enabled })
                      }
                    />
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={product.visible}
                      onCheckedChange={(visible) =>
                        update.mutate({ productId: product.id, visible })
                      }
                    />
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={product.featured}
                      onCheckedChange={(featured) =>
                        update.mutate({ productId: product.id, featured })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 40))}
        >
          السابق
        </Button>
        <Button
          variant="outline"
          disabled={!query.data?.hasMore}
          onClick={() => setOffset(offset + 40)}
        >
          التالي
        </Button>
      </div>
    </div>
  );
}
