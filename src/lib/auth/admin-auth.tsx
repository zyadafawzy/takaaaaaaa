import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AdminRole, AdminUser } from "@/domain/types";
import { can, type Permission } from "./permissions";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapFirstSuperAdmin, getMyAdminProfile } from "@/lib/admin-profile.functions";

/**
 * مصادقة الإدارة الحقيقية: Supabase Auth (بريد + كلمة مرور) + دور من جدول admin_profiles.
 * الدور لا يُخزَّن في المتصفح كمصدر ثقة — بيتقرأ من الخادم في كل جلسة.
 */

type AdminAuthValue = {
  user: AdminUser | null;
  ready: boolean;
  sessionEmail: string | null;
  noProfile: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  bootstrap: (fullName: string) => Promise<{ ok: boolean; error?: string }>;
  allowed: (permission: Permission) => boolean;
  role: AdminRole | null;
  refresh: () => Promise<void>;
};


const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [noProfile, setNoProfile] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      setUser(null);
      setSessionEmail(null);
      setNoProfile(false);
      setReady(true);
      return;
    }
    setSessionEmail(session.user.email ?? null);
    try {
      const profile = await getMyAdminProfile();
      if (profile) {
        setUser({
          id: profile.id,
          name: profile.name,
          role: profile.role as AdminRole,
          source: "live",
        });
        setNoProfile(false);
      } else {
        setUser(null);
        setNoProfile(true);
      }
    } catch {
      setUser(null);
      setNoProfile(true);
    }
    setReady(true);
  }, []);


  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo<AdminAuthValue>(
    () => ({
      user,
      ready,
      sessionEmail,
      noProfile,
      role: user?.role ?? null,
      refresh,
      allowed: (permission) => (user ? can(user.role, permission) : false),

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) return { ok: false, error: "بيانات الدخول مش صحيحة." };
        await refresh();
        return { ok: true };
      },
      signOut: async () => {
        localStorage.removeItem("admin_session");
        document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        await supabase.auth.signOut();
        setUser(null);
        setSessionEmail(null);
        setNoProfile(false);
      },

      bootstrap: async (fullName) => {
        try {
          const result = await bootstrapFirstSuperAdmin({ data: { fullName } });
          if (!result.ok) {
            return { ok: false, error: "فيه مدير نظام موجود بالفعل — اطلب صلاحية من مدير النظام." };
          }
          await refresh();
          return { ok: true };
        } catch {
          return { ok: false, error: "مقدرناش نكمّل التهيئة." };
        }
      },
    }),
    [user, ready, sessionEmail, noProfile, refresh],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth لازم يتستخدم جوه AdminAuthProvider");
  return context;
}
