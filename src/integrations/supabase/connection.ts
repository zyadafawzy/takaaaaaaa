/**
 * إعدادات الاتصال بـ Supabase — ثابتة داخل الكود.
 *
 * الهدف: المشروع يفضل واصل بالداتابيز في أي مكان (Lovable، remix، localhost،
 * أي استضافة تانية) من غير ما يعتمد على وجود ملف .env. لو فيه متغيرات بيئة
 * موجودة بتاخد الأولوية (مفيد لو نقلت المشروع لداتابيز تانية)، وإلا بنرجع
 * للقيم الثابتة دي.
 *
 * ملاحظة أمان: القيم دي مفاتيح نشر عامة (publishable/anon) وآمن وجودها في
 * الكود. مفتاح service_role مش موجود هنا ولا لازم يبقى — بيتقرا من البيئة فقط.
 */

const FALLBACK_URL = "https://ulavzqvuzjnscgpvvsmq.supabase.co";
const FALLBACK_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYXZ6cXZ1empuc2NncHZ2c21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1OTM3OTIsImV4cCI6MjEwMjE2OTc5Mn0.JuZL1Xs2U2OBDs8RLd0ioHU2xC2wAOdLRi2xMsCM29Y";
const FALLBACK_PROJECT_ID = "ulavzqvuzjnscgpvvsmq";

function fromProcess(name: string): string | undefined {
  try {
    const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
    return value && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function fromVite(name: string): string | undefined {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    const value = env?.[name];
    return value && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export const SUPABASE_URL =
  fromVite("VITE_SUPABASE_URL") ?? fromProcess("SUPABASE_URL") ?? FALLBACK_URL;

export const SUPABASE_PUBLISHABLE_KEY =
  fromVite("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  fromVite("VITE_SUPABASE_ANON_KEY") ??
  fromProcess("SUPABASE_PUBLISHABLE_KEY") ??
  fromProcess("SUPABASE_ANON_KEY") ??
  FALLBACK_PUBLISHABLE_KEY;

export const SUPABASE_PROJECT_ID =
  fromVite("VITE_SUPABASE_PROJECT_ID") ?? fromProcess("SUPABASE_PROJECT_ID") ?? FALLBACK_PROJECT_ID;

/** مفتاح الخدمة (اختياري) — بيتقرا من البيئة على الخادم فقط. */
export function serviceRoleKey(): string | undefined {
  return fromProcess("SUPABASE_SERVICE_ROLE_KEY");
}
