import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { developerCreateStore } from "@/lib/developer.functions";
import {
  defaultBranding,
  brandingPresets,
  FONT_OPTIONS,
  RADIUS_OPTIONS,
  DENSITY_OPTIONS,
  HEADER_STYLE_OPTIONS,
  CARD_STYLE_OPTIONS,
  type StoreBranding,
  type StoreColorKey,
} from "@/lib/store-theme";
import { featuresForPlan, type StoreFeatureMap, type StorePlanId } from "@/lib/store-features";
import { BrandingPreview } from "@/components/developer/BrandingPreview";
import { ProductPicker } from "@/components/developer/ProductPicker";
import { DeliveryZonesEditor, type ZoneDraft } from "@/components/developer/DeliveryZonesEditor";
import { StoreFeaturesEditor } from "@/components/developer/StoreFeaturesEditor";
import { LogoUploader, type LogoDraft } from "@/components/developer/LogoUploader";
import { HeroGalleryPicker } from "@/components/developer/HeroGalleryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/developer/new")({
  component: CreateStoreWizard,
});

const steps = ["الهوية", "الهوية البصرية", "المنتجات", "مناطق التوصيل", "الإمكانيات", "المراجعة"] as const;

const colorFields: Array<{ key: StoreColorKey; label: string }> = [
  { key: "primaryColor", label: "اللون الأساسي" },
  { key: "secondaryColor", label: "اللون الثانوي" },
  { key: "accentColor", label: "لون التمييز" },
  { key: "backgroundColor", label: "الخلفية" },
  { key: "surfaceColor", label: "البطاقات" },
  { key: "textColor", label: "النص" },
  { key: "mutedColor", label: "النص الخافت" },
  { key: "borderColor", label: "الحدود" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function CreateStoreWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<LogoDraft | null>(null);
  const [branding, setBranding] = useState<StoreBranding>(defaultBranding);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zones, setZones] = useState<ZoneDraft[]>([]);
  const [plan, setPlan] = useState<StorePlanId>("pro");
  const [features, setFeatures] = useState<StoreFeatureMap>(() => featuresForPlan("pro"));
  const [adminUsername, setAdminUsername] = useState("owner");
  const [adminPassword, setAdminPassword] = useState("");
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("المتجر تحت الصيانة، هنرجع قريب جدًا 🌿");
  const [phone, setPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [address, setAddress] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [businessHours, setBusinessHours] = useState("");

  const create = useMutation({
    mutationFn: () =>
      developerCreateStore({
        data: {
          store: {
            slug,
            name,
            ownerName,
            description,
            phone,
            whatsappNumber,
            supportNumber: "",
            contactName: ownerName,
            address,
            governorate,
            businessHours,
            status: "active",
            isMaintenance,
            maintenanceMessage,
            plan,
            features: features as Record<string, boolean>,
          },
          branding,
          productIds: Array.from(selected),
          zones,
          adminUsername: adminUsername.trim().toLowerCase(),
          ...(adminPassword.trim().length >= 4 ? { adminPassword: adminPassword.trim() } : {}),
          ...(logo ? { logo: { fileName: logo.fileName, contentType: logo.contentType, base64: logo.base64 } } : {}),
        },
      }),
    onSuccess: (result) => {
      toast.success("تم إنشاء السوبرماركت");
      void navigate({ to: "/developer/stores/$id", params: { id: result.id } });
    },
    onError: (error: Error) => {
      toast.error(
        error.message.includes("SLUG_TAKEN") ? "الرابط ده مستخدم قبل كده" : "مقدرناش نكمل الإنشاء",
      );
    },
  });

  const identityValid = name.trim().length >= 2 && /^[a-z0-9-]{2,60}$/.test(slug);
  const canNext = step === 0 ? identityValid : true;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black">إنشاء سوبرماركت جديد</h1>
        <p className="text-xs text-muted-foreground">
          نفس محرّك تِكّة بالكامل، بهوية ورابط ومناطق توصيل وإمكانيات مستقلة.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs">
        {steps.map((label, index) => (
          <li
            key={label}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold ${
              index === step
                ? "bg-primary text-primary-foreground"
                : index < step
                  ? "bg-primary-soft text-primary"
                  : "border border-border text-muted-foreground"
            }`}
          >
            {index < step ? <Check className="size-3.5" /> : <span>{index + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-border bg-surface p-4 md:p-6">
        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <LogoUploader logo={logo} onChange={setLogo} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-name">اسم السوبرماركت</Label>
              <Input
                id="store-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slug) setSlug(slugify(event.target.value));
                }}
                placeholder="سوبرماركت النور"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-slug">الرابط (إنجليزي)</Label>
              <Input
                id="store-slug"
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                placeholder="al-nour"
                dir="ltr"
              />
              <p className="text-[11px] text-muted-foreground">/s/{slug || "al-nour"}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-owner">اسم المالك</Label>
              <Input
                id="store-owner"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-phone">تليفون</Label>
              <Input id="store-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-wa">رقم واتساب الطلبات</Label>
              <Input
                id="store-wa"
                value={whatsappNumber}
                onChange={(event) => setWhatsappNumber(event.target.value)}
                dir="ltr"
                placeholder="201000000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-hours">مواعيد العمل</Label>
              <Input
                id="store-hours"
                value={businessHours}
                onChange={(event) => setBusinessHours(event.target.value)}
                placeholder="يوميًا ٩ص - ١٢م"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-gov">المحافظة</Label>
              <Input
                id="store-gov"
                value={governorate}
                onChange={(event) => setGovernorate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="store-address">عنوان السوبرماركت</Label>
              <Input
                id="store-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="store-desc">وصف مختصر</Label>
              <Textarea
                id="store-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-bold text-muted-foreground">
                    ثيمات جاهزة — دوسة واحدة تلبس المتجر بالكامل
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {brandingPresets.map((preset) => {
                      const active = branding.primaryColor === preset.branding.primaryColor;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setBranding({ ...branding, ...preset.branding })}
                          className={`group overflow-hidden rounded-2xl border-2 text-start transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                            active ? "border-primary shadow-md" : "border-border"
                          }`}
                        >
                          <span
                            className="flex h-12 items-end gap-1 p-2"
                            style={{ background: preset.branding.backgroundColor }}
                          >
                            <span
                              className="size-6 rounded-lg"
                              style={{ background: preset.branding.primaryColor }}
                            />
                            <span
                              className="size-6 rounded-lg"
                              style={{ background: preset.branding.accentColor }}
                            />
                            <span
                              className="size-6 rounded-lg border"
                              style={{
                                background: preset.branding.surfaceColor,
                                borderColor: preset.branding.borderColor,
                              }}
                            />
                          </span>
                          <span className="block truncate px-2 py-1.5 text-[11px] font-bold">
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {colorFields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={`color-${field.key}`}>{field.label}</Label>
                      <div className="flex gap-2">
                        <input
                          id={`color-${field.key}`}
                          type="color"
                          value={branding[field.key]}
                          onChange={(event) =>
                            setBranding((current) => ({ ...current, [field.key]: event.target.value }))
                          }
                          className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface"
                        />
                        <Input
                          value={branding[field.key]}
                          onChange={(event) =>
                            setBranding((current) => ({ ...current, [field.key]: event.target.value }))
                          }
                          dir="ltr"
                          className="h-10"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="hero-title">عنوان الواجهة</Label>
                    <Input
                      id="hero-title"
                      value={branding.heroTitle ?? ""}
                      onChange={(e) => setBranding((c) => ({ ...c, heroTitle: e.target.value }))}
                      placeholder="طلبات البيت الناقصة… في كام تكة"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hero-sub">السطر التحتاني</Label>
                    <Input
                      id="hero-sub"
                      value={branding.heroSubtitle ?? ""}
                      onChange={(e) => setBranding((c) => ({ ...c, heroSubtitle: e.target.value }))}
                      placeholder="جودة فريش • أسعار حقيقية • توصيل سريع"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="color-mode">وضع الألوان</Label>
                    <select
                      id="color-mode"
                      value={branding.colorMode ?? "light"}
                      onChange={(e) =>
                        setBranding((c) => ({ ...c, colorMode: e.target.value as "light" | "dark" | "system" }))
                      }
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      <option value="light">نهاري</option>
                      <option value="dark">ليلي</option>
                      <option value="system">حسب جهاز الزبون</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="font-family">الخط</Label>
                    <select
                      id="font-family"
                      value={branding.fontFamily ?? "cairo"}
                      onChange={(e) => setBranding((c) => ({ ...c, fontFamily: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      {FONT_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="radius-style">شكل الحواف</Label>
                    <select
                      id="radius-style"
                      value={branding.radiusStyle ?? "soft"}
                      onChange={(e) => setBranding((c) => ({ ...c, radiusStyle: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      {RADIUS_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="density">كثافة المساحات</Label>
                    <select
                      id="density"
                      value={branding.density ?? "comfortable"}
                      onChange={(e) => setBranding((c) => ({ ...c, density: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      {DENSITY_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="header-style">شكل الهيدر</Label>
                    <select
                      id="header-style"
                      value={branding.headerStyle ?? "classic"}
                      onChange={(e) => setBranding((c) => ({ ...c, headerStyle: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      {HEADER_STYLE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="card-style">شكل كارت المنتج</Label>
                    <select
                      id="card-style"
                      value={branding.productCardStyle ?? "standard"}
                      onChange={(e) => setBranding((c) => ({ ...c, productCardStyle: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      {CARD_STYLE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold text-muted-foreground">معاينة حيّة</p>
                <BrandingPreview branding={branding} storeName={name} />
              </div>
            </div>

            <HeroGalleryPicker
              value={branding.heroImageUrl ?? null}
              onChange={(url) => setBranding((c) => ({ ...c, heroImageUrl: url }))}
            />
          </div>
        ) : null}

        {step === 2 ? <ProductPicker selected={selected} onChange={setSelected} /> : null}

        {step === 3 ? <DeliveryZonesEditor zones={zones} onChange={setZones} /> : null}

        {step === 4 ? (
          <div className="space-y-6">
            <StoreFeaturesEditor
              plan={plan}
              features={features}
              onPlanChange={setPlan}
              onFeaturesChange={setFeatures}
            />

            <div className="grid gap-4 rounded-2xl border border-border bg-background p-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-username">اسم مستخدم صاحب المتجر</Label>
                <Input
                  id="admin-username"
                  value={adminUsername}
                  onChange={(event) => setAdminUsername(event.target.value.toLowerCase())}
                  dir="ltr"
                  pattern="[a-z0-9][a-z0-9_-]{2,31}"
                  placeholder="owner"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-pass">كلمة سر لوحة تحكم المتجر</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  dir="ltr"
                  placeholder="4 حروف على الأقل"
                />
                <p className="text-[11px] text-muted-foreground">
                  الدخول من /s/{slug || "..."}/admin باسم المستخدم وكلمة المرور.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isMaintenance}
                    onCheckedChange={setIsMaintenance}
                    aria-label="وضع الصيانة"
                  />
                  <Label className="!m-0">إيقاف المتجر للصيانة</Label>
                </div>
                <Textarea
                  value={maintenanceMessage}
                  onChange={(event) => setMaintenanceMessage(event.target.value)}
                  rows={2}
                  aria-label="رسالة الصيانة"
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <dl className="space-y-2 text-sm">
              {[
                ["الاسم", name],
                ["الرابط", `/s/${slug}`],
                ["المالك", ownerName || "—"],
                ["واتساب", whatsappNumber || "—"],
                ["المحافظة", governorate || "—"],
                ["عدد المنتجات", String(selected.size)],
                ["مناطق التوصيل", String(zones.length)],
                ["الباقة", plan],
                ["اسم مستخدم المالك", adminUsername || "—"],
                ["كلمة سر اللوحة", adminPassword ? "تم ضبطها" : "—"],
                ["الصيانة", isMaintenance ? "مفعّلة" : "مقفولة"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-border pb-1.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            <BrandingPreview branding={branding} storeName={name} />
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={step === 0}
          onClick={() => setStep((value) => Math.max(0, value - 1))}
        >
          <ArrowRight className="size-4" /> رجوع
        </Button>
        {step < steps.length - 1 ? (
          <Button
            className="ms-auto gap-1.5"
            disabled={!canNext}
            onClick={() => setStep((value) => value + 1)}
          >
            التالي <ArrowLeft className="size-4" />
          </Button>
        ) : (
          <Button
            className="ms-auto gap-1.5"
            disabled={!identityValid || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            إنشاء السوبرماركت
          </Button>
        )}
      </div>
    </div>
  );
}
