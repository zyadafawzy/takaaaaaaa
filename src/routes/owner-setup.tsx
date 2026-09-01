import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  ownerChangePassphrase,
  ownerCreateAdmin,
  ownerRequestPassphraseLink,
  ownerSetupInfo,
  ownerCreateStore,
} from "@/lib/owner-setup.functions";
import { generateStoreAIAsset } from "@/lib/store-assets.functions";

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
import { Checkbox } from "@/components/ui/checkbox";
import { ImagePlus, Store, ShieldCheck, Settings, RefreshCw, X } from "lucide-react";

export const Route = createFileRoute("/owner-setup")({
  head: () => ({
    meta: [
      { title: "مركز تحكم المطور | تِكّة" },
      { name: "description", content: "صفحة إعداد المنصة وإدارة المتاجر." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerSetupPage,
});

const GOVERNORATES = [
  { name: "القاهرة", regions: ["مصر الجديدة", "مدينة نصر", "المعادي", "التجمع الخامس", "وسط البلد", "شبرا"] },
  { name: "الجيزة", regions: ["الدقي", "المهندسين", "الهرم", "فيصل", "الشيخ زايد", "6 أكتوبر"] },
  { name: "الإسكندرية", regions: ["سموحة", "جليم", "سيدي جابر", "العجمي", "المنتزة"] },
];

const PLANS = [
  { id: "basic", label: "أساسي", price: "١٠٠٠ ج.م/شهر", features: ["١٠٠ منتج", "دعم فني"] },
  { id: "pro", label: "برو (سوبر ستور)", price: "٣٠٠٠ ج.م/شهر", features: ["١٧٠٠+ منتج", "دفع إلكتروني", "AI ماركتنج"] },
  { id: "enterprise", label: "إنتربرايز", price: "١٠٠٠٠ ج.م/شهر", features: ["منتجات لا نهائية", "دومين خاص", "دعم ٢٤/٧"] },
];

function OwnerSetupPage() {
  const createAdmin = useServerFn(ownerCreateAdmin);
  const requestLink = useServerFn(ownerRequestPassphraseLink);
  const changePassphrase = useServerFn(ownerChangePassphrase);
  const getInfo = useServerFn(ownerSetupInfo);
  const generateAI = useServerFn(generateStoreAIAsset);
  const createStoreFn = useServerFn(ownerCreateStore);

  const [maskedEmail, setMaskedEmail] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [storeOwner, setStoreOwner] = useState("");
  const [storeGov, setStoreGov] = useState(GOVERNORATES[0]!.name);
  const [storeRegion, setStoreRegion] = useState(GOVERNORATES[0]!.regions[0]!);
  const [storeAdminUsername, setStoreAdminUsername] = useState("owner");
  const [storeAdminPass, setStoreAdminPass] = useState("");
  const [planId, setPlanId] = useState("pro");
  const [createStoreMsg, setCreateStoreMsg] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSamples, setAiSamples] = useState<{ id: string; url: string; label: string }[]>([]);
  const [selectedLogo, setSelectedLogo] = useState("");

  const [stores, setStores] = useState<any[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);

  useEffect(() => {
    void getInfo().then((info) => setMaskedEmail(info.maskedOwnerEmail));
    
    setLoadingStores(true);
    supabase.from("stores").select("id, slug, name, description, logo_url, favicon_url, features, address, governorate, phone, whatsapp_number, support_number, business_hours, contact_name, owner_name, plan, status, is_master, is_maintenance, maintenance_message, created_at, updated_at").order("created_at", { ascending: false })
      .then(({ data }) => {
        setStores(data || []);
        setLoadingStores(false);
      });
  }, [getInfo]);

  const handleMaintenanceToggle = async (store: any) => {
    const newVal = !store.is_maintenance;
    const { error } = await supabase
      .from("stores")
      .update({ is_maintenance: newVal } as any)
      .eq("id", store.id);
    
    if (!error) {
      setStores(prev => prev.map(s => s.id === store.id ? { ...s, is_maintenance: newVal } : s));
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 py-10" dir="rtl" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">مركز تحكم المطور</h1>
            <p className="text-muted-foreground font-bold mt-1">إدارة منصة تِكّة سوبرماركت</p>
          </div>
          <Link to="/admin/login">
            <Button variant="outline" className="font-bold">لوحة إدارة المتجر</Button>
          </Link>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Create Store Section */}
          <div className="space-y-6">
            <div className="rounded-[2.5rem] border border-border bg-surface p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Store className="size-6 text-primary" />
                </div>
                <h2 className="text-2xl font-black">إنشاء سوبرماركت جديد</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <Label className="font-bold text-base mb-2 block">كلمة السر الرئيسية (للمطور)</Label>
                  <Input 
                    type="password" 
                    value={passphrase} 
                    onChange={e => setPassphrase(e.target.value)} 
                    placeholder="zizo2024"
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="font-bold">اسم السوبرماركت</Label>
                    <Input 
                      value={storeName} 
                      onChange={e => {
                        setStoreName(e.target.value);
                        setStoreSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
                      }} 
                      className="mt-2 h-11 rounded-xl" 
                    />
                  </div>
                  <div>
                    <Label className="font-bold">الرابط الفريد (slug)</Label>
                    <Input value={storeSlug} onChange={e => setStoreSlug(e.target.value)} dir="ltr" className="mt-2 h-11 rounded-xl" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="font-bold">المحافظة</Label>
                    <Select value={storeGov} onValueChange={(val) => {
                      setStoreGov(val);
                      setStoreRegion(GOVERNORATES.find(g => g.name === val)?.regions[0] || "");
                    }}>
                      <SelectTrigger className="mt-2 h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOVERNORATES.map(g => <SelectItem key={g.name} value={g.name}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-bold">منطقة التوصيل</Label>
                    <Select value={storeRegion} onValueChange={setStoreRegion}>
                      <SelectTrigger className="mt-2 h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOVERNORATES.find(g => g.name === storeGov)?.regions.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="font-bold">اسم مستخدم صاحب المتجر</Label>
                    <Input
                      value={storeAdminUsername}
                      onChange={e => setStoreAdminUsername(e.target.value.toLowerCase())}
                      dir="ltr"
                      className="mt-2 h-11 rounded-xl"
                      placeholder="owner"
                      pattern="[a-z0-9][a-z0-9_-]{2,31}"
                    />
                  </div>
                  <div>
                  <Label className="font-bold">كلمة مرور صاحب المتجر</Label>
                  <Input 
                    type="password" 
                    value={storeAdminPass} 
                    onChange={e => setStoreAdminPass(e.target.value)} 
                    dir="ltr" 
                    className="mt-2 h-11 rounded-xl" 
                    placeholder="8 حروف على الأقل"
                  />
                  </div>
                </div>

                <div>
                  <Label className="font-bold text-base mb-4 block">اختر مستوى المتجر (Plans)</Label>
                  <div className="grid gap-3">
                    {PLANS.map(plan => (
                      <div 
                        key={plan.id}
                        onClick={() => setPlanId(plan.id)}
                        className={`cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                          planId === plan.id ? "border-primary bg-primary/5 shadow-lg" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-lg">{plan.label}</span>
                          <span className="font-bold text-primary">{plan.price}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {plan.features.map(f => (
                            <span key={f} className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-full">{f}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-dashed border-border p-6 bg-muted/10">
                  <div className="flex items-center gap-2 mb-4">
                    <ImagePlus className="size-5 text-primary" />
                    <Label className="text-lg font-black">توليد الهوية بالـ AI</Label>
                  </div>
                  
                  <div className="flex flex-col gap-5">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="اوصف شكل السوبرماركت... (مثلاً: ريفي فريش)" 
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        className="h-12 rounded-xl"
                      />
                      <Button 
                        type="button"
                        variant="secondary"
                        className="h-12 px-8 font-black rounded-xl"
                        onClick={async () => {
                          if (!aiPrompt) return;
                          setIsGenerating(true);
                          try {
                            const res = await generateAI({ data: { prompt: aiPrompt } });
                            setAiSamples(res.samples);
                          } finally {
                            setIsGenerating(false);
                          }
                        }}
                        disabled={isGenerating}
                      >
                        {isGenerating ? <RefreshCw className="size-5 animate-spin" /> : "توليد"}
                      </Button>
                    </div>

                    {aiSamples.length > 0 && (
                      <div className="grid grid-cols-4 gap-3">
                        {aiSamples.map(sample => (
                          <div 
                            key={sample.id}
                            onClick={() => setSelectedLogo(sample.url)}
                            className={`relative cursor-pointer aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                              selectedLogo === sample.url ? "border-primary ring-4 ring-primary/20 scale-95" : "border-transparent hover:border-primary/30"
                            }`}
                          >
                            <img src={sample.url} className="size-full object-cover" alt={sample.label} />
                            {selectedLogo === sample.url && (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <div className="size-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                                  ✓
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  className="h-16 w-full text-xl font-black rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  disabled={busy || !storeName || storeAdminUsername.length < 3 || storeAdminPass.length < 8 || !passphrase}
                  onClick={async () => {
                    setBusy(true);
                    setCreateStoreMsg("");
                    try {
                      const res = await createStoreFn({
                        data: {
                          passphrase,
                          name: storeName,
                          slug: storeSlug,
                          ownerName: storeOwner || storeName,
                          governorate: storeGov,
                          region: storeRegion,
                          adminUsername: storeAdminUsername,
                          adminPassword: storeAdminPass,
                          logoUrl: selectedLogo
                        }
                      });
                      if (res.ok) {
                        setCreateStoreMsg("مبروك! السوبرماركت جاهز دلوقتي 🚀");
                        setStoreName("");
                        setStoreSlug("");
                        setSelectedLogo("");
                        setAiSamples([]);
                        const { data } = await supabase.from("stores").select("id, slug, name, description, logo_url, favicon_url, features, address, governorate, phone, whatsapp_number, support_number, business_hours, contact_name, owner_name, plan, status, is_master, is_maintenance, maintenance_message, created_at, updated_at").order("created_at", { ascending: false });
                        setStores(data || []);
                      } else {
                        setCreateStoreMsg("خطأ: " + res.error);
                      }
                    } catch (err) {
                      setCreateStoreMsg("فشل الاتصال بالسيرفر.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "جاري الإطلاق..." : "إطلاق السوبرماركت 🚀"}
                </Button>
                {createStoreMsg && <p className="text-center text-base font-black text-primary">{createStoreMsg}</p>}
              </div>
            </div>
          </div>

          {/* Manage Stores & Security Section */}
          <div className="space-y-8">
            <div className="rounded-[2.5rem] border border-border bg-surface p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="size-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                  <ShieldCheck className="size-6 text-orange-500" />
                </div>
                <h2 className="text-2xl font-black">إدارة المتاجر الحالية</h2>
              </div>

              <div className="space-y-4">
                {loadingStores ? (
                  <div className="flex flex-col items-center py-10 gap-3">
                    <RefreshCw className="size-8 animate-spin text-muted-foreground" />
                    <p className="text-sm font-bold text-muted-foreground">جاري تحميل المتاجر...</p>
                  </div>
                ) : stores.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground font-bold">لا توجد متاجر حالياً.</p>
                ) : (
                  stores.map(s => (
                    <div key={s.id} className="group flex items-center justify-between rounded-3xl border border-border p-5 bg-muted/5 transition-all hover:bg-surface hover:shadow-xl">
                      <div className="flex items-center gap-4">
                        {s.logo_url ? (
                          <img src={s.logo_url} className="size-14 rounded-2xl object-cover" alt="" />
                        ) : (
                          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-black text-primary">
                            {s.name.slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <p className="font-black text-lg leading-none">{s.name}</p>
                          <p className="text-xs text-muted-foreground font-bold mt-1.5">slug: {s.slug}</p>
                          <div className="mt-2 flex items-center gap-2">
                            {s.is_maintenance ? (
                              <span className="text-[10px] font-black bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full">في الصيانة</span>
                            ) : (
                              <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">نشط</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <Button 
                          variant={s.is_maintenance ? "default" : "outline"} 
                          size="sm"
                          className="rounded-xl font-black"
                          onClick={() => handleMaintenanceToggle(s)}
                        >
                          {s.is_maintenance ? "تشغيل" : "صيانة"}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-border bg-surface p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="size-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Settings className="size-6 text-blue-500" />
                </div>
                <h2 className="text-2xl font-black">أمان المنصة</h2>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-bold text-muted-foreground mb-4">إرسال رابط تحقق لبريد المالك ({maskedEmail}) لتغيير كلمة السر الرئيسية.</p>
                <Button 
                  variant="outline" 
                  className="w-full h-12 rounded-xl font-black"
                  onClick={async () => {
                    const res = await requestLink({ data: undefined });
                    alert(res.ok ? "تم إرسال الرابط بنجاح" : "فشل الإرسال");
                  }}
                >
                  إرسال رابط التحقق
                </Button>
                
                <div className="pt-6 border-t border-border">
                  <Label className="font-bold block mb-2">كلمة سر رئيسية جديدة</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="password"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                    <Button 
                      className="rounded-xl font-black"
                      onClick={async () => {
                        const res = await changePassphrase({ data: { newPassphrase: message } });
                        alert(res.ok ? "تم التغيير" : "فشل التغيير (تأكد من الرابط)");
                      }}
                    >
                      حفظ
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
