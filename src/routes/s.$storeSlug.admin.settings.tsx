import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  storeAdminDeleteZone,
  storeAdminGetSettings,
  storeAdminSaveProfile,
  storeAdminSaveSettings,
  storeAdminSaveZone,
  storeAdminSetProduct,
} from "@/lib/store-admin.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/s/$storeSlug/admin/settings")({
  component: StoreAdminSettings,
});

const emptyProfile = {
  name: "",
  description: "",
  logoUrl: "",
  faviconUrl: "",
  phone: "",
  whatsappNumber: "",
  supportNumber: "",
  contactName: "",
  address: "",
  governorate: "",
  businessHours: "",
  adminPassword: "",
};
const emptySettings = {
  acceptingOrders: true,
  pickupEnabled: false,
  codEnabled: true,
  onlinePaymentEnabled: false,
  contactEmail: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  orderWhatsappTemplate: "",
  substitutionPolicyText: "",
  closedMessage: "",
  privacyText: "",
  termsText: "",
};

function StoreAdminSettings() {
  const { storeSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["store-admin", storeSlug, "settings"],
    queryFn: () => storeAdminGetSettings({ data: { storeSlug } }),
    retry: false,
  });
  const [profile, setProfile] = useState(emptyProfile);
  const [settings, setSettings] = useState(emptySettings);

  useEffect(() => {
    const store = query.data?.store;
    const value = query.data?.settings;
    if (store)
      setProfile({
        name: (store as any).name || "",
        description: (store as any).description || "",
        logoUrl: (store as any).logo_url ?? "",
        faviconUrl: (store as any).favicon_url ?? "",
        phone: (store as any).phone || "",
        whatsappNumber: (store as any).whatsapp_number || "",
        supportNumber: (store as any).support_number || "",
        contactName: (store as any).contact_name || "",
        address: (store as any).address || "",
        governorate: (store as any).governorate || "",
        businessHours: (store as any).business_hours || "",
        adminPassword: "",
      });
    if (value)
      setSettings({
        acceptingOrders: value.accepting_orders,
        pickupEnabled: value.pickup_enabled,
        codEnabled: value.cod_enabled,
        onlinePaymentEnabled: value.online_payment_enabled,
        contactEmail: value.contact_email,
        facebookUrl: value.facebook_url,
        instagramUrl: value.instagram_url,
        tiktokUrl: value.tiktok_url,
        orderWhatsappTemplate: value.order_whatsapp_template,
        substitutionPolicyText: value.substitution_policy_text,
        closedMessage: value.closed_message,
        privacyText: value.privacy_text,
        termsText: value.terms_text,
      });
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      await storeAdminSaveProfile({
        data: {
          storeSlug,
          ...profile,
          logoUrl: profile.logoUrl || null,
          faviconUrl: profile.faviconUrl || null,
          adminPassword: profile.adminPassword || null,
        },
      });
      await storeAdminSaveSettings({ data: { storeSlug, ...settings } });
    },
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      void queryClient.invalidateQueries({ queryKey: ["store-admin", storeSlug] });
    },
    onError: () => toast.error("مقدرناش نحفظ الإعدادات"),
  });
  const zoneMutation = useMutation({
    mutationFn: storeAdminSaveZone,
    onSuccess: () => {
      toast.success("تم حفظ منطقة التوصيل");
      void queryClient.invalidateQueries({ queryKey: ["store-admin", storeSlug, "settings"] });
    },
    onError: () => toast.error("مقدرناش نحفظ المنطقة"),
  });
  const deleteZone = useMutation({
    mutationFn: storeAdminDeleteZone,
    onSuccess: () => {
      toast.success("تم حذف المنطقة");
      void queryClient.invalidateQueries({ queryKey: ["store-admin", storeSlug, "settings"] });
    },
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (query.isError)
    return (
      <p className="border border-border bg-surface p-6 text-sm text-muted-foreground">
        مش عندك صلاحية لإدارة إعدادات المتجر ده.
      </p>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">إعدادات المتجر</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            بيانات التواصل والطلب والتوصيل الخاصة بمتجرك.
          </p>
        </div>
        <Button className="ms-auto gap-2" disabled={save.isPending} onClick={() => save.mutate()}>
          <Save className="size-4" /> حفظ الكل
        </Button>
      </div>
      <Tabs defaultValue="profile">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="profile">بيانات المتجر</TabsTrigger>
          <TabsTrigger value="orders">الطلبات</TabsTrigger>
          <TabsTrigger value="delivery">مناطق التوصيل</TabsTrigger>
        </TabsList>
        <TabsContent
          value="profile"
          className="mt-4 grid gap-4 border border-border bg-surface p-4 md:grid-cols-2"
        >
          {(
            [
              ["name", "اسم المتجر"],
              ["phone", "التليفون"],
              ["whatsappNumber", "واتساب الطلبات"],
              ["supportNumber", "رقم الدعم"],
              ["contactName", "اسم مسؤول التواصل"],
              ["governorate", "المحافظة"],
              ["businessHours", "مواعيد العمل"],
              ["contactEmail", "البريد الإلكتروني"],
            ] as const
          ).map(([key, label]) =>
            key === "contactEmail" ? (
              <Field
                key={key}
                label={label}
                value={settings.contactEmail}
                onChange={(value) => setSettings((c) => ({ ...c, contactEmail: value }))}
              />
            ) : (
              <Field
                key={key}
                label={label}
                value={profile[key]}
                onChange={(value) => setProfile((c) => ({ ...c, [key]: value }))}
              />
            ),
          )}
          <Field
            label="كلمة مرور الإدارة (اتركها فارغة لعدم التغيير)"
            value={profile.adminPassword}
            onChange={(adminPassword) => setProfile((c) => ({ ...c, adminPassword }))}
            type="password"
          />
          <Field
            label="رابط الشعار"
            value={profile.logoUrl}
            onChange={(logoUrl) => setProfile((c) => ({ ...c, logoUrl }))}
            ltr
          />
          <Field
            label="رابط الأيقونة"
            value={profile.faviconUrl}
            onChange={(faviconUrl) => setProfile((c) => ({ ...c, faviconUrl }))}
            ltr
          />
          <div className="md:col-span-2">
            <Label>العنوان</Label>
            <Input
              className="mt-1"
              value={profile.address}
              onChange={(e) => setProfile((c) => ({ ...c, address: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <Label>الوصف</Label>
            <Textarea
              className="mt-1"
              value={profile.description}
              onChange={(e) => setProfile((c) => ({ ...c, description: e.target.value }))}
            />
          </div>
          <Field
            label="فيسبوك"
            value={settings.facebookUrl}
            onChange={(facebookUrl) => setSettings((c) => ({ ...c, facebookUrl }))}
            ltr
          />
          <Field
            label="إنستجرام"
            value={settings.instagramUrl}
            onChange={(instagramUrl) => setSettings((c) => ({ ...c, instagramUrl }))}
            ltr
          />
          <Field
            label="تيك توك"
            value={settings.tiktokUrl}
            onChange={(tiktokUrl) => setSettings((c) => ({ ...c, tiktokUrl }))}
            ltr
          />
        </TabsContent>
        <TabsContent value="orders" className="mt-4 space-y-4 border border-border bg-surface p-4">
          <Toggle
            label="استقبال الطلبات"
            checked={settings.acceptingOrders}
            onChange={(acceptingOrders) => setSettings((c) => ({ ...c, acceptingOrders }))}
          />
          <Toggle
            label="الاستلام من الفرع"
            checked={settings.pickupEnabled}
            onChange={(pickupEnabled) => setSettings((c) => ({ ...c, pickupEnabled }))}
          />
          <Toggle
            label="الدفع عند الاستلام"
            checked={settings.codEnabled}
            onChange={(codEnabled) => setSettings((c) => ({ ...c, codEnabled }))}
          />
          <Toggle
            label="الدفع الإلكتروني"
            checked={settings.onlinePaymentEnabled}
            onChange={(onlinePaymentEnabled) =>
              setSettings((c) => ({ ...c, onlinePaymentEnabled }))
            }
          />
          <Area
            label="قالب رسالة واتساب"
            value={settings.orderWhatsappTemplate}
            onChange={(orderWhatsappTemplate) =>
              setSettings((c) => ({ ...c, orderWhatsappTemplate }))
            }
          />
          <Area
            label="سياسة الاستبدال"
            value={settings.substitutionPolicyText}
            onChange={(substitutionPolicyText) =>
              setSettings((c) => ({ ...c, substitutionPolicyText }))
            }
          />
          <Area
            label="رسالة إغلاق الطلبات"
            value={settings.closedMessage}
            onChange={(closedMessage) => setSettings((c) => ({ ...c, closedMessage }))}
          />
          <Area
            label="سياسة الخصوصية"
            value={settings.privacyText}
            onChange={(privacyText) => setSettings((c) => ({ ...c, privacyText }))}
          />
          <Area
            label="الشروط"
            value={settings.termsText}
            onChange={(termsText) => setSettings((c) => ({ ...c, termsText }))}
          />
        </TabsContent>
        <TabsContent value="delivery" className="mt-4 space-y-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              zoneMutation.mutate({
                data: {
                  storeSlug,
                  name: "منطقة جديدة",
                  governorate: profile.governorate,
                  fee: 0,
                  minimumOrder: 0,
                  available: true,
                  sortOrder: query.data?.zones.length ?? 0,
                },
              })
            }
          >
            <Plus className="size-4" /> إضافة منطقة
          </Button>
          {query.data?.zones.map((zone) => (
            <div
              key={zone.id}
              className="grid gap-3 border border-border bg-surface p-4 md:grid-cols-[1fr_1fr_100px_100px_80px_auto] md:items-end"
            >
              <div>
                <Label>المحافظة</Label>
                <Select
                  value={zone.governorate}
                  onValueChange={(gov) =>
                    zoneMutation.mutate({
                      data: {
                        storeSlug,
                        id: zone.id,
                        name: zone.name,
                        governorate: gov,
                        fee: Number(zone.fee),
                        minimumOrder: Number(zone.minimum_order),
                        available: zone.available,
                        sortOrder: zone.sort_order,
                      },
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="اختر المحافظة" />
                  </SelectTrigger>
                  <SelectContent>
                    {query.data?.locations
                      .filter((l: any) => l.type === "governorate")
                      .map((l: any) => (
                        <SelectItem key={l.id} value={l.name}>
                          {l.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المنطقة</Label>
                <Select
                  value={zone.name}
                  onValueChange={(name) =>
                    zoneMutation.mutate({
                      data: {
                        storeSlug,
                        id: zone.id,
                        name,
                        governorate: zone.governorate,
                        fee: Number(zone.fee),
                        minimumOrder: Number(zone.minimum_order),
                        available: zone.available,
                        sortOrder: zone.sort_order,
                      },
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="اختر المنطقة" />
                  </SelectTrigger>
                  <SelectContent>
                    {query.data?.locations
                      .filter(
                        (l: any) =>
                          l.type === "area" &&
                          l.parent_id ===
                            query.data?.locations.find(
                              (gov: any) => gov.name === zone.governorate,
                            )?.id,
                      )
                      .map((l: any) => (
                        <SelectItem key={l.id} value={l.name}>
                          {l.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="الرسوم"
                value={String(zone.fee)}
                onChange={(value) =>
                  zoneMutation.mutate({
                    data: {
                      storeSlug,
                      id: zone.id,
                      name: zone.name,
                      governorate: zone.governorate,
                      fee: Number(value),
                      minimumOrder: Number(zone.minimum_order),
                      available: zone.available,
                      sortOrder: zone.sort_order,
                    },
                  })
                }
              />
              <Field
                label="الحد الأدنى"
                value={String(zone.minimum_order)}
                onChange={(value) =>
                  zoneMutation.mutate({
                    data: {
                      storeSlug,
                      id: zone.id,
                      name: zone.name,
                      governorate: zone.governorate,
                      fee: Number(zone.fee),
                      minimumOrder: Number(value),
                      available: zone.available,
                      sortOrder: zone.sort_order,
                    },
                  })
                }
              />
              <Switch
                checked={zone.available}
                onCheckedChange={(available) =>
                  zoneMutation.mutate({
                    data: {
                      storeSlug,
                      id: zone.id,
                      name: zone.name,
                      governorate: zone.governorate,
                      fee: Number(zone.fee),
                      minimumOrder: Number(zone.minimum_order),
                      available,
                      sortOrder: zone.sort_order,
                    },
                  })
                }
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="حذف المنطقة"
                onClick={() => deleteZone.mutate({ data: { storeSlug, id: zone.id } })}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ltr = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  ltr?: boolean;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        dir={ltr ? "ltr" : undefined}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
