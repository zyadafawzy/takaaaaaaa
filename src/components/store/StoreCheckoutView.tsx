import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useCart } from "@/lib/cart";
import { useZone } from "@/lib/zone";
import { computeTotals, meetsMinimum } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";
import { ordersAdapter } from "@/services/orders-adapter";
import type { CheckoutDraft, StoreSettings, SubstitutionPolicy } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/States";

const phoneSchema = z.string().regex(/^01[0-9]{9}$/u, "رقم غير صحيح");

const substitutionOptions: Array<{ value: SubstitutionPolicy; label: string }> = [
  { value: "substitute", label: "اختار بديل مناسب" },
  { value: "call_me", label: "اتصل بيا" },
  { value: "remove", label: "شيل المنتج لو مش موجود" },
];

type StoreCheckoutSettings = {
  pickupEnabled: boolean;
  acceptingOrders: boolean;
  closedMessage: string;
  storeName: string;
};

/** إتمام الطلب داخل السوبرماركت — الطلب يُسجَّل باسم المتجر وبإعداداته. */
export function StoreCheckoutView({
  storeSlug,
  settings,
}: {
  storeSlug: string;
  settings: StoreCheckoutSettings;
}) {
  const navigate = useNavigate();
  const { cart, ready, clear } = useCart();
  const { zones, zone, setZoneId } = useZone();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<CheckoutDraft>({
    firstName: "",
    phone: "",
    whatsapp: "",
    sameWhatsapp: true,
    zoneId: "",
    street: "",
    building: "",
    landmark: "",
    notes: "",
    fulfillment: "delivery",
    payment: "cod",
    substitution: "substitute",
    privacyAccepted: false,
  });

  const activeZone = zones.find((z) => z.id === (draft.zoneId || zone?.id)) ?? zone ?? null;
  const totals = computeTotals(cart.lines, draft.fulfillment === "delivery" ? activeZone : null);

  if (!settings.acceptingOrders) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-8 md:px-6">
        <EmptyState title="مقفولين مؤقتًا" description={settings.closedMessage} />
      </div>
    );
  }

  if (ready && cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-8 md:px-6">
        <EmptyState
          title="مفيش حاجة نكمّل بيها"
          description="السلة فاضية، ضيف منتجات الأول."
          action={
            <Button asChild>
              <Link to="/s/$storeSlug" params={{ storeSlug }}>
                شوف المنتجات
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const steps = ["بياناتك", "العنوان والتسليم", "المراجعة"];

  const validateStep0 = () => {
    const next: Record<string, string> = {};
    if (draft.firstName.trim().length < 2) next["firstName"] = "اكتب اسمك الأول";
    if (!phoneSchema.safeParse(draft.phone.trim()).success) {
      next["phone"] = "اكتب رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01)";
    }
    if (!draft.sameWhatsapp && !phoneSchema.safeParse(draft.whatsapp.trim()).success) {
      next["whatsapp"] = "رقم الواتساب مش صحيح";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep1 = () => {
    const next: Record<string, string> = {};
    if (draft.fulfillment === "delivery") {
      if (!activeZone) next["zone"] = "اختار منطقة التوصيل";
      if (draft.street.trim().length < 3) next["street"] = "اكتب اسم الشارع";
      if (draft.building.trim().length < 1) next["building"] = "اكتب رقم البيت/الشقة";
      if (activeZone && !meetsMinimum(totals.itemsTotal, activeZone)) {
        next["minimum"] = `الحد الأدنى للطلب في ${activeZone.name} هو ${formatPrice(activeZone.minimumOrder)}`;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!draft.privacyAccepted) {
      setErrors({ privacy: "لازم توافق على الشروط قبل ما نكمّل" });
      return;
    }
    setSubmitting(true);
    try {
      const result = await ordersAdapter.createPendingOrder({
        draft: { ...draft, zoneId: activeZone?.id ?? "" },
        lines: cart.lines,
        zone: draft.fulfillment === "delivery" ? activeZone : null,
        settings: { storeName: settings.storeName } as StoreSettings,
        storeSlug,
      });
      clear();
      navigate({
        to: "/s/$storeSlug/order/$token",
        params: { storeSlug, token: result.order.token },
      });
    } catch {
      toast.error("مقدرناش نسجّل الطلب دلوقتي", { description: "جرّب تاني بعد لحظة." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-3 py-6 md:px-6">
      <h1 className="mb-1 text-2xl font-extrabold">إنهاء الطلب</h1>
      <p className="mb-4 text-sm text-muted-foreground">خطوات قصيرة، وكل الأسعار واضحة قبل التأكيد.</p>

      <ol className="mb-6 flex gap-2" aria-label="خطوات إنهاء الطلب">
        {steps.map((label, index) => (
          <li key={label} className="flex-1">
            <div className={`h-1.5 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`} aria-hidden />
            <span className={`mt-1 block text-[11px] ${index === step ? "font-bold" : "text-muted-foreground"}`}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="space-y-4">
          <div>
            <Label htmlFor="firstName">الاسم الأول</Label>
            <Input
              id="firstName"
              value={draft.firstName}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
              className="mt-1"
            />
            {errors["firstName"] ? <p className="mt-1 text-xs text-destructive">{errors["firstName"]}</p> : null}
          </div>
          <div>
            <Label htmlFor="phone">رقم الموبايل</Label>
            <Input
              id="phone"
              inputMode="numeric"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="01xxxxxxxxx"
              className="mt-1"
            />
            {errors["phone"] ? <p className="mt-1 text-xs text-destructive">{errors["phone"]}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="sameWhatsapp"
              checked={draft.sameWhatsapp}
              onCheckedChange={(v) => setDraft({ ...draft, sameWhatsapp: v === true })}
            />
            <Label htmlFor="sameWhatsapp" className="text-sm">
              الواتساب نفس الرقم
            </Label>
          </div>
          {!draft.sameWhatsapp ? (
            <div>
              <Label htmlFor="whatsapp">رقم الواتساب</Label>
              <Input
                id="whatsapp"
                inputMode="numeric"
                value={draft.whatsapp}
                onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })}
                className="mt-1"
              />
              {errors["whatsapp"] ? <p className="mt-1 text-xs text-destructive">{errors["whatsapp"]}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4">
          <div>
            <Label className="mb-2 block">طريقة الاستلام</Label>
            <RadioGroup
              value={draft.fulfillment}
              onValueChange={(v) => setDraft({ ...draft, fulfillment: v as "delivery" | "pickup" })}
              className="gap-2"
            >
              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <RadioGroupItem value="delivery" id="delivery" />
                <Label htmlFor="delivery">توصيل للبيت</Label>
              </div>
              {settings.pickupEnabled ? (
                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <RadioGroupItem value="pickup" id="pickup" />
                  <Label htmlFor="pickup">استلام من الفرع</Label>
                </div>
              ) : null}
            </RadioGroup>
          </div>

          {draft.fulfillment === "delivery" ? (
            <>
              <div>
                <Label>المنطقة</Label>
                <Select
                  value={activeZone?.id ?? ""}
                  onValueChange={(value) => {
                    setDraft({ ...draft, zoneId: value });
                    setZoneId(value);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="اختار منطقتك" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} — {formatPrice(item.fee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors["zone"] ? <p className="mt-1 text-xs text-destructive">{errors["zone"]}</p> : null}
              </div>
              <div>
                <Label htmlFor="street">الشارع</Label>
                <Input
                  id="street"
                  value={draft.street}
                  onChange={(e) => setDraft({ ...draft, street: e.target.value })}
                  className="mt-1"
                />
                {errors["street"] ? <p className="mt-1 text-xs text-destructive">{errors["street"]}</p> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="building">رقم البيت / الشقة</Label>
                  <Input
                    id="building"
                    value={draft.building}
                    onChange={(e) => setDraft({ ...draft, building: e.target.value })}
                    className="mt-1"
                  />
                  {errors["building"] ? (
                    <p className="mt-1 text-xs text-destructive">{errors["building"]}</p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="landmark">علامة مميزة (اختياري)</Label>
                  <Input
                    id="landmark"
                    value={draft.landmark}
                    onChange={(e) => setDraft({ ...draft, landmark: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              {errors["minimum"] ? <p className="text-xs text-destructive">{errors["minimum"]}</p> : null}
            </>
          ) : null}

          <div>
            <Label className="mb-2 block">لو منتج مش موجود</Label>
            <RadioGroup
              value={draft.substitution}
              onValueChange={(v) => setDraft({ ...draft, substitution: v as SubstitutionPolicy })}
              className="gap-2"
            >
              {substitutionOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value}>{option.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="notes">ملاحظات للطلب</Label>
            <Textarea
              id="notes"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="mt-1"
            />
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <p className="font-bold">{draft.firstName}</p>
            <p className="text-muted-foreground">{draft.phone}</p>
            {draft.fulfillment === "delivery" ? (
              <p className="mt-2 text-muted-foreground">
                {activeZone?.name} — {draft.street} {draft.building}
              </p>
            ) : (
              <p className="mt-2 text-muted-foreground">استلام من الفرع</p>
            )}
          </div>

          <dl className="space-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex justify-between">
              <dt>إجمالي المنتجات</dt>
              <dd className="price font-semibold">{formatPrice(totals.itemsTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>رسوم التوصيل</dt>
              <dd className="price font-semibold">
                {totals.deliveryFee > 0 ? formatPrice(totals.deliveryFee) : "مجانًا"}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base">
              <dt className="font-bold">الإجمالي</dt>
              <dd className="price font-extrabold text-primary">{formatPrice(totals.grandTotal)}</dd>
            </div>
          </dl>

          <div className="flex items-start gap-2">
            <Checkbox
              id="privacy"
              checked={draft.privacyAccepted}
              onCheckedChange={(v) => setDraft({ ...draft, privacyAccepted: v === true })}
            />
            <Label htmlFor="privacy" className="text-sm leading-relaxed">
              موافق على استخدام بياناتي لتنفيذ الطلب والتواصل معايا.
            </Label>
          </div>
          {errors["privacy"] ? <p className="text-xs text-destructive">{errors["privacy"]}</p> : null}
        </section>
      ) : null}

      <div className="mt-6 flex gap-3">
        {step > 0 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
            رجوع
          </Button>
        ) : null}
        {step < 2 ? (
          <Button
            className="flex-1"
            onClick={() => {
              const valid = step === 0 ? validateStep0() : validateStep1();
              if (valid) setStep(step + 1);
            }}
          >
            كمّل
          </Button>
        ) : (
          <Button className="flex-1" disabled={submitting} onClick={submit}>
            {submitting ? "بنسجّل الطلب..." : "أكّد الطلب"}
          </Button>
        )}
      </div>
    </div>
  );
}
