import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  developerGetStore,
  developerUpdateStore,
  developerSetStoreProducts,
} from "@/lib/developer.functions";
import { defaultBranding, brandingPresets, type StoreBranding, type StoreColorKey } from "@/lib/store-theme";
import { BrandingPreview } from "@/components/developer/BrandingPreview";
import { ProductPicker } from "@/components/developer/ProductPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/developer/stores/$id")({
  component: StoreDetail,
});

const colorFields: Array<{ key: StoreColorKey; label: string }> = [
  { key: "primaryColor", label: "الأساسي" },
  { key: "secondaryColor", label: "الثانوي" },
  { key: "accentColor", label: "التمييز" },
  { key: "backgroundColor", label: "الخلفية" },
  { key: "surfaceColor", label: "البطاقات" },
  { key: "textColor", label: "النص" },
  { key: "mutedColor", label: "النص الخافت" },
  { key: "borderColor", label: "الحدود" },
];

function StoreDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const storeQuery = useQuery({
    queryKey: ["developer-store", id],
    queryFn: () => developerGetStore({ data: { id } }),
  });

  const data = storeQuery.data;

  const [form, setForm] = useState({
    name: "",
    slug: "",
    ownerName: "",
    description: "",
    phone: "",
    whatsappNumber: "",
    address: "",
    governorate: "",
    businessHours: "",
  });
  const [branding, setBranding] = useState<StoreBranding>(defaultBranding);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const initialSelected = useMemo(
    () => new Set((data?.assignments ?? []).map((row) => row.product_id as string)),
    [data],
  );

  useEffect(() => {
    if (!data) return;
    const store = data.store as unknown as Record<string, string | null>;
    setForm({
      name: store["name"] ?? "",
      slug: store["slug"] ?? "",
      ownerName: store["owner_name"] ?? "",
      description: store["description"] ?? "",
      phone: store["phone"] ?? "",
      whatsappNumber: store["whatsapp_number"] ?? "",
      address: store["address"] ?? "",
      governorate: store["governorate"] ?? "",
      businessHours: store["business_hours"] ?? "",
    });
    const b = data.branding as Record<string, string> | null;
    if (b) {
      setBranding({
        primaryColor: b["primary_color"] ?? defaultBranding.primaryColor,
        secondaryColor: b["secondary_color"] ?? defaultBranding.secondaryColor,
        accentColor: b["accent_color"] ?? defaultBranding.accentColor,
        backgroundColor: b["background_color"] ?? defaultBranding.backgroundColor,
        surfaceColor: b["surface_color"] ?? defaultBranding.surfaceColor,
        textColor: b["text_color"] ?? defaultBranding.textColor,
        mutedColor: b["muted_color"] ?? defaultBranding.mutedColor,
        borderColor: b["border_color"] ?? defaultBranding.borderColor,
        successColor: b["success_color"] ?? defaultBranding.successColor,
        warningColor: b["warning_color"] ?? defaultBranding.warningColor,
        dangerColor: b["danger_color"] ?? defaultBranding.dangerColor,
      });
    }
    setSelected(new Set(initialSelected));
  }, [data, initialSelected]);

  const save = useMutation({
    mutationFn: async () => {
      await developerUpdateStore({
        data: {
          id,
          store: {
            name: form.name,
            slug: form.slug,
            ownerName: form.ownerName,
            description: form.description,
            phone: form.phone,
            whatsappNumber: form.whatsappNumber,
            address: form.address,
            governorate: form.governorate,
            businessHours: form.businessHours,
          },
          branding,
        },
      });
      const add = Array.from(selected).filter((productId) => !initialSelected.has(productId));
      const remove = Array.from(initialSelected).filter((productId) => !selected.has(productId));
      if (add.length > 0 || remove.length > 0) {
        await developerSetStoreProducts({ data: { storeId: id, add, remove } });
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ التعديلات");
      void queryClient.invalidateQueries({ queryKey: ["developer-store", id] });
      void queryClient.invalidateQueries({ queryKey: ["developer-stores"] });
    },
    onError: () => toast.error("مقدرناش نحفظ التعديلات"),
  });

  if (storeQuery.isLoading) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }
  if (!data) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-10 text-center text-sm">
        السوبرماركت مش موجود.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-black">{form.name}</h1>
          <p className="text-[11px] text-muted-foreground">/s/{form.slug}</p>
        </div>
        <div className="ms-auto flex gap-2">
          <Button variant="outline" asChild className="gap-1.5">
            <Link to="/s/$storeSlug" params={{ storeSlug: form.slug }} target="_blank">
              <ExternalLink className="size-4" /> فتح المتجر
            </Link>
          </Button>
          <Button className="gap-1.5" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            حفظ
          </Button>
        </div>
      </div>

      <Tabs defaultValue="identity">
        <TabsList>
          <TabsTrigger value="identity">البيانات</TabsTrigger>
          <TabsTrigger value="branding">الهوية</TabsTrigger>
          <TabsTrigger value="products">المنتجات</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-4">
          <div className="grid gap-4 rounded-2xl border border-border bg-surface p-4 md:grid-cols-2 md:p-6">
            {(
              [
                ["name", "الاسم"],
                ["slug", "الرابط"],
                ["ownerName", "المالك"],
                ["phone", "تليفون"],
                ["whatsappNumber", "واتساب"],
                ["governorate", "المحافظة"],
                ["businessHours", "مواعيد العمل"],
                ["address", "العنوان"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`field-${key}`}>{label}</Label>
                <Input
                  id={`field-${key}`}
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </div>
            ))}
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="field-description">الوصف</Label>
              <Textarea
                id="field-description"
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <div className="grid gap-6 rounded-2xl border border-border bg-surface p-4 md:p-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {brandingPresets.map((preset) => (
                  <Button
                    key={preset.name}
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setBranding(preset.branding)}
                  >
                    <span
                      className="me-1.5 size-3 rounded-full"
                      style={{ background: preset.branding.primaryColor }}
                    />
                    {preset.name}
                  </Button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {colorFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`brand-${field.key}`}>{field.label}</Label>
                    <div className="flex gap-2">
                      <input
                        id={`brand-${field.key}`}
                        type="color"
                        value={branding[field.key]}
                        onChange={(event) =>
                          setBranding((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                        className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface"
                      />
                      <Input
                        dir="ltr"
                        className="h-10"
                        value={branding[field.key]}
                        onChange={(event) =>
                          setBranding((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <BrandingPreview branding={branding} storeName={form.name} />
          </div>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <div className="rounded-2xl border border-border bg-surface p-4 md:p-6">
            <ProductPicker selected={selected} onChange={setSelected} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
