import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { storeAdminGetSettings, storeAdminSaveBranding } from "@/lib/store-admin.functions";
import {
  brandingPresets,
  CARD_STYLE_OPTIONS,
  defaultBranding,
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  HEADER_STYLE_OPTIONS,
  RADIUS_OPTIONS,
  type StoreBranding,
  type StoreColorKey,
} from "@/lib/store-theme";
import { BrandingPreview } from "@/components/developer/BrandingPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/s/$storeSlug/admin/theme")({ component: StoreAdminTheme });

const colorFields: Array<{ key: StoreColorKey; label: string }> = [
  { key: "primaryColor", label: "الأساسي" },
  { key: "secondaryColor", label: "الثانوي" },
  { key: "accentColor", label: "التمييز" },
  { key: "backgroundColor", label: "الخلفية" },
  { key: "surfaceColor", label: "السطح" },
  { key: "textColor", label: "النص" },
  { key: "mutedColor", label: "النص الخافت" },
  { key: "borderColor", label: "الحدود" },
];

function StoreAdminTheme() {
  const { storeSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["store-admin", storeSlug, "settings"],
    queryFn: () => storeAdminGetSettings({ data: { storeSlug } }),
    retry: false,
  });
  const [branding, setBranding] = useState<StoreBranding>(defaultBranding);

  useEffect(() => {
    const b = query.data?.branding;
    if (!b) return;
    setBranding({
      primaryColor: b.primary_color,
      secondaryColor: b.secondary_color,
      accentColor: b.accent_color,
      backgroundColor: b.background_color,
      surfaceColor: b.surface_color,
      textColor: b.text_color,
      mutedColor: b.muted_color,
      borderColor: b.border_color,
      successColor: b.success_color,
      warningColor: b.warning_color,
      dangerColor: b.danger_color,
      themePreset: b.theme_preset,
      colorMode: b.color_mode as "light" | "dark",
      fontFamily: b.font_family,
      radiusStyle: b.radius_style,
      density: b.density,
      headerStyle: b.header_style,
      productCardStyle: b.product_card_style,
      heroImageUrl: b.hero_image_url,
      heroTitle: b.hero_title,
      heroSubtitle: b.hero_subtitle,
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      storeAdminSaveBranding({
        data: {
          storeSlug,
          colors: {
            primary: branding.primaryColor,
            secondary: branding.secondaryColor,
            accent: branding.accentColor,
            background: branding.backgroundColor,
            surface: branding.surfaceColor,
            text: branding.textColor,
            muted: branding.mutedColor,
            border: branding.borderColor,
            success: branding.successColor,
            warning: branding.warningColor,
            danger: branding.dangerColor,
          },
          themePreset: branding.themePreset ?? "custom",
          colorMode: branding.colorMode ?? "light",
          fontFamily: branding.fontFamily ?? "cairo",
          radiusStyle: branding.radiusStyle ?? "soft",
          density: branding.density ?? "comfortable",
          headerStyle: branding.headerStyle ?? "classic",
          productCardStyle: branding.productCardStyle ?? "standard",
          heroImageUrl: branding.heroImageUrl || null,
          heroTitle: branding.heroTitle ?? "",
          heroSubtitle: branding.heroSubtitle ?? "",
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ شكل المتجر");
      void queryClient.invalidateQueries({ queryKey: ["store-admin", storeSlug] });
    },
    onError: () => toast.error("مقدرناش نحفظ الشكل"),
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">الشكل والثيم</h1>
          <p className="mt-1 text-sm text-muted-foreground">هوية مستقلة ومعاينة مباشرة لمتجرك.</p>
        </div>
        <Button className="ms-auto gap-2" disabled={save.isPending} onClick={() => save.mutate()}>
          <Save className="size-4" /> حفظ
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="border border-border bg-surface p-4">
            <h2 className="font-bold">القوالب الجاهزة</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {brandingPresets.map((preset) => (
                <Button
                  key={preset.name}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBranding({ ...preset.branding, themePreset: preset.name })}
                >
                  <span
                    className="me-2 size-3 rounded-full"
                    style={{ backgroundColor: preset.branding.primaryColor }}
                  />
                  {preset.name}
                </Button>
              ))}
            </div>
          </section>
          <section className="border border-border bg-surface p-4">
            <h2 className="font-bold">الألوان</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {colorFields.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`theme-${field.key}`}>{field.label}</Label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id={`theme-${field.key}`}
                      type="color"
                      value={branding[field.key]}
                      onChange={(event) =>
                        setBranding((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                      className="h-10 w-12 border border-border bg-surface"
                    />
                    <Input
                      dir="ltr"
                      value={branding[field.key]}
                      onChange={(event) =>
                        setBranding((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="grid gap-3 border border-border bg-surface p-4 sm:grid-cols-2">
            <Choice
              label="الخط"
              value={branding.fontFamily ?? "cairo"}
              options={FONT_OPTIONS}
              onChange={(fontFamily) => setBranding((c) => ({ ...c, fontFamily }))}
            />
            <Choice
              label="الحواف"
              value={branding.radiusStyle ?? "soft"}
              options={RADIUS_OPTIONS}
              onChange={(radiusStyle) => setBranding((c) => ({ ...c, radiusStyle }))}
            />
            <Choice
              label="الكثافة"
              value={branding.density ?? "comfortable"}
              options={DENSITY_OPTIONS}
              onChange={(density) => setBranding((c) => ({ ...c, density }))}
            />
            <Choice
              label="الهيدر"
              value={branding.headerStyle ?? "classic"}
              options={HEADER_STYLE_OPTIONS}
              onChange={(headerStyle) => setBranding((c) => ({ ...c, headerStyle }))}
            />
            <Choice
              label="بطاقة المنتج"
              value={branding.productCardStyle ?? "standard"}
              options={CARD_STYLE_OPTIONS}
              onChange={(productCardStyle) => setBranding((c) => ({ ...c, productCardStyle }))}
            />
          </section>
          <section className="space-y-3 border border-border bg-surface p-4">
            <h2 className="font-bold">واجهة البداية</h2>
            <div>
              <Label htmlFor="hero-image">رابط صورة الغلاف</Label>
              <Input
                id="hero-image"
                dir="ltr"
                value={branding.heroImageUrl ?? ""}
                onChange={(e) => setBranding((c) => ({ ...c, heroImageUrl: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="hero-title">عنوان الغلاف</Label>
              <Input
                id="hero-title"
                value={branding.heroTitle ?? ""}
                onChange={(e) => setBranding((c) => ({ ...c, heroTitle: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="hero-subtitle">الوصف</Label>
              <Textarea
                id="hero-subtitle"
                value={branding.heroSubtitle ?? ""}
                onChange={(e) => setBranding((c) => ({ ...c, heroSubtitle: e.target.value }))}
              />
            </div>
          </section>
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <BrandingPreview branding={branding} storeName={(query.data?.store as any)?.name ?? "متجرك"} />
        </div>
      </div>
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
