import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Announcement = {
  id: string;
  content: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
};

export type Bundle = {
  id: string;
  name: string;
  description: string;
  discount_amount: number;
  active: boolean;
  bundle_items: Array<{
    product_id: string;
    quantity: number;
    products: {
      id: string;
      name: string;
      price: number;
      unit: string;
      slug: string;
      is_fresh: boolean;
      images: string[];


      sku: string;
      description: string;
    } | null;
  }>;
};

export const getAnnouncements = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("announcements" as never)
      .select("*")
      .eq("active" as never, true as never);
    return (data || []) as unknown as Announcement[];
  });

export const getBundles = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("product_bundles" as never)
      .select("*, bundle_items(*, products(*))")
      .eq("active" as never, true as never);
    return (data || []) as unknown as Bundle[];
  });
