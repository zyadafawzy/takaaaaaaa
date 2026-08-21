import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Plus, Trash2, MapPin, Truck } from "lucide-react";
import { catalogRepository } from "@/services/catalog-repository";
import { roleLabels } from "@/lib/auth/permissions";
import { useAdminAuth } from "@/lib/auth/admin-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminUpdateSettings, adminListZones, adminUpdateZone, adminCreateZone, adminDeleteZone } from "@/lib/admin-settings.functions";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const { allowed, user, ready } = useAdminAuth();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ 
    queryKey: ["settings"], 
    queryFn: () => catalogRepository.getSettings(),
    enabled: ready && allowed("settings.manage")
  });
  const zonesQuery = useQuery({ 
    queryKey: ["admin-zones"], 
    queryFn: () => adminListZones(),
    enabled: ready && allowed("settings.manage")
  });

  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setFormData(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => adminUpdateSettings({ data }),
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات بنجاح");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => {
      toast.error("فشل حفظ الإعدادات");
    }
  });

  const updateZoneMutation = useMutation({
    mutationFn: (data: any) => adminUpdateZone({ data }),
    onSuccess: () => {
      toast.success("تم تحديث المنطقة");
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
    }
  });

  const createZoneMutation = useMutation({
    mutationFn: (data: any) => adminCreateZone({ data }),
    onSuccess: () => {
      toast.success("تم إضافة المنطقة");
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
    }
  });

  const deleteZoneMutation = useMutation({
    mutationFn: (id: string) => adminDeleteZone({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف المنطقة");
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
    }
  });

  if (ready && !allowed("settings.manage")) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-bold">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">
          دورك ({user ? roleLabels[user.role] : "—"}) مايسمحش بتعديل إعدادات المتجر.
        </p>
      </div>
    );
  }

  const handleSave = () => {
    if (formData) {
      updateSettingsMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إعدادات المتجر</h1>
          <p className="text-sm text-muted-foreground">إدارة معلومات المتجر، التوصيل، والسياسات.</p>
        </div>
        <Button onClick={handleSave} disabled={updateSettingsMutation.isPending} className="gap-2">
          <Save className="size-4" />
          حفظ التغييرات
        </Button>
      </header>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="general">المعلومات العامة</TabsTrigger>
          <TabsTrigger value="delivery">التوصيل والمناطق</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>بيانات التواصل والفرع</CardTitle>
              <CardDescription>المعلومات دي بتظهر للعميل في واجهة المتجر.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="storeName">اسم المتجر</Label>
                  <Input 
                    id="storeName" 
                    value={formData?.storeName || ""} 
                    onChange={e => setFormData({ ...formData, storeName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">رقم واتساب (للطلبات)</Label>
                  <Input 
                    id="whatsapp" 
                    value={formData?.whatsappNumber || ""} 
                    onChange={e => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    placeholder="مثال: 201234567890"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hours">مواعيد العمل</Label>
                <Input 
                  id="hours" 
                  value={formData?.openingHours || ""} 
                  onChange={e => setFormData({ ...formData, openingHours: e.target.value })}
                  placeholder="مثال: يومياً من ٩ صباحاً حتى ١١ مساءً"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">عنوان الفرع</Label>
                <Textarea 
                  id="address" 
                  value={formData?.branchAddress || ""} 
                  onChange={e => setFormData({ ...formData, branchAddress: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>حالة التشغيل</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>استقبال الطلبات</Label>
                  <p className="text-xs text-muted-foreground">فتح أو غلق إمكانية عمل طلبات جديدة.</p>
                </div>
                <Switch 
                  checked={formData?.acceptingOrders || false} 
                  onCheckedChange={checked => setFormData({ ...formData, acceptingOrders: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>الاستلام من الفرع</Label>
                  <p className="text-xs text-muted-foreground">تفعيل خيار استلام العميل لطلبه من الفرع.</p>
                </div>
                <Switch 
                  checked={formData?.pickupEnabled || false} 
                  onCheckedChange={checked => setFormData({ ...formData, pickupEnabled: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>السياسات والتنويهات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="announcement">تنويه عام (يظهر في أعلى المتجر)</Label>
                <Input 
                  id="announcement" 
                  value={formData?.announcement || ""} 
                  onChange={e => setFormData({ ...formData, announcement: e.target.value })}
                  placeholder="مثال: خصومات تصل لـ ٥٠٪ على المنظفات!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="policy">سياسة التبديل والبدائل</Label>
                <Textarea 
                  id="policy" 
                  className="min-h-32"
                  value={formData?.substitutionPolicyText || ""} 
                  onChange={e => setFormData({ ...formData, substitutionPolicyText: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">مناطق التوصيل</h3>
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-2"
              onClick={() => {
                const name = prompt("اسم المنطقة (مثلاً: المعادي)");
                if (!name) return;
                createZoneMutation.mutate({ 
                  name, 
                  governorate: "القاهرة", 
                  fee: 20, 
                  minimumOrder: 100 
                });
              }}
            >
              <Plus className="size-4" /> إضافة منطقة
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {zonesQuery.data?.map(zone => (
              <Card key={zone.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base truncate">{zone.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-7 text-destructive"
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف منطقة ${zone.name}؟`)) {
                            deleteZoneMutation.mutate(zone.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      <Switch 
                        checked={zone.available}
                        onCheckedChange={checked => updateZoneMutation.mutate({ id: zone.id, available: checked })}
                      />
                    </div>
                  </div>
                  <CardDescription>{zone.governorate}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">رسوم التوصيل</Label>
                      <div className="flex items-center gap-1">
                        <Input 
                          type="number" 
                          className="h-8" 
                          defaultValue={zone.fee}
                          onBlur={e => updateZoneMutation.mutate({ id: zone.id, fee: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">حد أدنى للطلب</Label>
                      <Input 
                        type="number" 
                        className="h-8" 
                        defaultValue={zone.minimum_order}
                        onBlur={e => updateZoneMutation.mutate({ id: zone.id, minimumOrder: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">توصيل مجاني من</Label>
                    <Input 
                      type="number" 
                      className="h-8" 
                      defaultValue={zone.free_delivery_threshold || 0}
                      onBlur={e => updateZoneMutation.mutate({ id: zone.id, freeDeliveryThreshold: Number(e.target.value) || null })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
