import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Package, LayoutGrid, Loader2 } from "lucide-react";
import { adminListBundles, adminCreateBundle, adminDeleteBundle } from "@/lib/admin-bundles.functions";
import { adminListProducts } from "@/lib/admin-catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAdminAuth } from "@/lib/auth/admin-auth";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/bundles")({
  component: AdminBundles,
});

function AdminBundles() {
  const { allowed, ready } = useAdminAuth();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  
  const [newBundle, setNewBundle] = useState({
    name: "",
    slug: "",
    description: "",
    discountAmount: 0,
    items: [{ productId: "", quantity: 1 }]
  });

  const bundlesQuery = useQuery({
    queryKey: ["admin-bundles"],
    queryFn: () => adminListBundles(),
    enabled: ready && allowed("catalog.view")
  });

  const productsQuery = useQuery({
    queryKey: ["admin-products-minimal"],
    queryFn: () => adminListProducts({ data: { page: 0 } }),
    enabled: isAdding
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => adminCreateBundle({ data }),
    onSuccess: () => {
      toast.success("تم إنشاء الحزمة");
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ["admin-bundles"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteBundle({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الحزمة");
      queryClient.invalidateQueries({ queryKey: ["admin-bundles"] });
    }
  });

  if (!allowed("catalog.view")) return null;

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">حزم المنتجات (Packages)</h1>
          <p className="text-sm text-muted-foreground">اجمع منتجاتك في عرض واحد بخصم خاص.</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <Plus className="size-4" /> إضافة حزمة جديدة
        </Button>
      </header>

      {isAdding && (
        <Card className="border-primary shadow-lifted">
          <CardHeader>
            <CardTitle>إنشاء حزمة جديدة</CardTitle>
            <CardDescription>أضف المنتجات والخصم المناسب للحزمة.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>اسم الحزمة</Label>
                <Input 
                  value={newBundle.name} 
                  onChange={e => setNewBundle({...newBundle, name: e.target.value})} 
                  placeholder="مثال: حزمة الفطار العائلي"
                />
              </div>
              <div className="space-y-2">
                <Label>الرابط (Slug)</Label>
                <Input 
                  value={newBundle.slug} 
                  onChange={e => setNewBundle({...newBundle, slug: e.target.value})} 
                  placeholder="breakfast-bundle"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea 
                value={newBundle.description} 
                onChange={e => setNewBundle({...newBundle, description: e.target.value})} 
              />
            </div>

            <div className="space-y-2">
              <Label>مبلغ الخصم (ج.م)</Label>
              <Input 
                type="number" 
                value={newBundle.discountAmount} 
                onChange={e => setNewBundle({...newBundle, discountAmount: Number(e.target.value)})} 
              />
            </div>

            <div className="space-y-2">
              <Label>المنتجات</Label>
              {newBundle.items.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <select 
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                    value={item.productId}
                    onChange={e => {
                      const newItems = [...newBundle.items];
                      if (newItems[index]) {
                        newItems[index] = { ...newItems[index], productId: e.target.value };
                        setNewBundle({...newBundle, items: newItems});
                      }
                    }}
                  >
                    <option value="">اختر منتج...</option>
                    {(productsQuery.data?.items || []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} - {formatPrice(p.price)}</option>
                    ))}
                  </select>
                  <Input 
                    type="number" 
                    className="w-20" 
                    value={item.quantity}
                    onChange={e => {
                      const newItems = [...newBundle.items];
                      if (newItems[index]) {
                        newItems[index] = { ...newItems[index], quantity: Number(e.target.value) };
                        setNewBundle({...newBundle, items: newItems});
                      }
                    }}
                  />
                  {newBundle.items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => {
                      const newItems = newBundle.items.filter((_, i) => i !== index);
                      setNewBundle({...newBundle, items: newItems});
                    }}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => {
                setNewBundle({...newBundle, items: [...newBundle.items, { productId: "", quantity: 1 }]});
              }}>
                + إضافة منتج آخر
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsAdding(false)}>إلغاء</Button>
              <Button onClick={() => createMutation.mutate(newBundle)} disabled={createMutation.isPending || !newBundle.name || !newBundle.slug}>
                {createMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                حفظ الحزمة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(bundlesQuery.data || []).map((bundle: any) => (
          <Card key={bundle.id} className="group relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                  <Package className="size-5" />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteMutation.mutate(bundle.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <CardTitle>{bundle.name}</CardTitle>
              <CardDescription className="line-clamp-2">{bundle.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">المنتجات:</div>
                <ul className="space-y-1">
                  {bundle.bundle_items.map((item: any, i: number) => (
                    <li key={i} className="text-sm flex justify-between">
                      <span>{item.products.name}</span>
                      <span className="text-muted-foreground">×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="text-xs font-bold text-success">وفر {formatPrice(bundle.discount_amount)}</span>
                  <div className="px-2 py-1 bg-muted rounded text-[10px] font-bold">/{bundle.slug}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}