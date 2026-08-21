import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** عميل Supabase بمفتاح النشر للقراءة العامة من الخادم — RLS مطبّقة كزائر مجهول. */
export function createPublicServerClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY");

  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
