import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAdminAuth } from "@/lib/auth/admin-auth";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "دخول فريق المنصّة" },
      { name: "description", content: "دخول داخلي لفريق إدارة المنصّة فقط." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "دخول فريق المنصّة" },
      { property: "og:description", content: "دخول داخلي لفريق إدارة المنصّة فقط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const { refresh, user, ready } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) {
      navigate({ to: "/admin" });
    }
  }, [ready, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setError("الإيميل أو كلمة المرور غلط");
      setBusy(false);
      return;
    }

    if (typeof refresh === "function") await refresh();
    navigate({ to: "/admin" });
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-soft text-center">
        <div className="mx-auto"><Logo /></div>
        <h1 className="mt-6 text-2xl font-bold">دخول الإدارة</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          سجّل بحساب الفريق المسجّل في النظام
        </p>

        <form className="mt-8 space-y-4 text-right" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="email">الإيميل</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2"
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2"
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive font-medium">{error}</p> : null}
          <Button type="submit" className="w-full h-12 text-lg" disabled={busy}>
            {busy ? "بنتأكد..." : "دخول"}
          </Button>
        </form>

        <p className="mt-6 text-[11px] text-muted-foreground opacity-50">
          نظام إدارة محمي
        </p>
      </div>
    </div>
  );
}
