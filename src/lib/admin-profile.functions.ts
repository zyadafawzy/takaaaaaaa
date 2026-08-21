import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** بروفايل الموظف الحالي — الدور بيتقرأ من قاعدة البيانات فقط بعد التحقق من الجلسة. */
export const getMyAdminProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("admin_profiles")
      .select("user_id, email, full_name, role, active")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!data || !data.active) return null;
    return {
      id: data.user_id,
      email: data.email,
      name: data.full_name,
      role: data.role,
    };
  });

/** تهيئة أول مدير نظام — مسموحة مرة واحدة فقط عبر دالة قاعدة بيانات محصّنة. */
export const bootstrapFirstSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ fullName: z.string().trim().max(80).default("") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | null)?.email;
    if (!email) throw new Error("EMAIL_REQUIRED");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("bootstrap_first_super_admin", {
      _user_id: context.userId,
      _email: email,
      _full_name: data.fullName,
    });

    if (error) throw new Error("BOOTSTRAP_FAILED");
    return result as { ok: boolean; reason?: string };
  });
