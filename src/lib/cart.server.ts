import type { CartLine, SellUnit } from "@/domain/types";
import { itemsSubtotal } from "./pricing";

export type ServerCart = {
  sessionToken: string;
  lines: CartLine[];
  subtotal: number;
  removed: string[];
  updatedAt: string;
};

type IncomingLine = { variantId: string; quantity: number; note?: string | undefined };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getOrCreateCart(sessionToken: string) {
  const supabase = await admin();
  const existing = await supabase
    .from("anonymous_carts")
    .select("id")
    .eq("session_token", sessionToken)
    .maybeSingle();
  if (existing.data) return existing.data.id;

  const created = await supabase
    .from("anonymous_carts")
    .insert({ session_token: sessionToken })
    .select("id")
    .single();
  if (created.error) throw new Error("CART_CREATE_FAILED");
  return created.data.id;
}

/** يقرأ أسعار وحدود الكمية من الـvariants الفعّالة — لا يثق في المتصفح. */
export async function priceLines(lines: IncomingLine[]): Promise<{ lines: CartLine[]; removed: string[] }> {
  const supabase = await admin();
  const ids = Array.from(new Set(lines.map((l) => l.variantId)));
  if (ids.length === 0) return { lines: [], removed: [] };

  const { data } = await supabase
    .from("product_variants")
    .select(
      `id, size_label, price, compare_at_price, stock_quantity, allow_backorder, active,
       products!inner ( id, slug, name, unit, status, available, is_complete )`,
    )
    .in("id", ids)
    .eq("active", true);

  const priced: CartLine[] = [];
  const removed: string[] = [];

  for (const incoming of lines) {
    const row = (data ?? []).find((v) => v.id === incoming.variantId);
    const product = row?.products;
    const sellable =
      row && product && product.status === "published" && product.available && product.is_complete;
    if (!sellable || incoming.quantity <= 0) {
      if (incoming.quantity > 0) removed.push(incoming.variantId);
      continue;
    }
    const max = row.allow_backorder ? 20 : Math.max(0, Math.min(row.stock_quantity ?? 0, 20));
    if (max === 0) {
      removed.push(incoming.variantId);
      continue;
    }
    priced.push({
      productId: row.id,
      slug: product.slug,
      name: product.name,
      size: row.size_label,
      unit: product.unit as SellUnit,
      unitPrice: Number(row.price),
      compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
      quantity: Math.min(incoming.quantity, max),
      note: incoming.note ?? "",
      maxQuantity: max,
    });
  }

  return { lines: priced, removed };
}

async function readCart(sessionToken: string): Promise<ServerCart> {
  const supabase = await admin();
  const cartId = await getOrCreateCart(sessionToken);
  const { data } = await supabase
    .from("cart_items")
    .select("variant_id, quantity, note")
    .eq("cart_id", cartId);

  const { lines, removed } = await priceLines(
    (data ?? []).map((row) => ({
      variantId: row.variant_id,
      quantity: row.quantity,
      note: row.note,
    })),
  );

  if (removed.length > 0) {
    await supabase.from("cart_items").delete().eq("cart_id", cartId).in("variant_id", removed);
  }

  return {
    sessionToken,
    lines,
    subtotal: itemsSubtotal(lines),
    removed,
    updatedAt: new Date().toISOString(),
  };
}

export async function syncCart(
  sessionToken: string,
  incoming: IncomingLine[] | null,
): Promise<ServerCart> {
  const supabase = await admin();
  const cartId = await getOrCreateCart(sessionToken);

  if (incoming && incoming.length > 0) {
    const { lines } = await priceLines(incoming);
    if (lines.length > 0) {
      await supabase.from("cart_items").upsert(
        lines.map((line) => ({
          cart_id: cartId,
          variant_id: line.productId,
          quantity: line.quantity,
          note: line.note ?? "",
        })),
        { onConflict: "cart_id,variant_id" },
      );
    }
  }

  return readCart(sessionToken);
}

export async function mutateCartServer(input: {
  sessionToken: string;
  action: "set" | "remove" | "clear" | "note";
  variantId?: string | undefined;
  quantity?: number | undefined;
  note?: string | undefined;
}): Promise<ServerCart> {
  const supabase = await admin();
  const cartId = await getOrCreateCart(input.sessionToken);

  if (input.action === "clear") {
    await supabase.from("cart_items").delete().eq("cart_id", cartId);
    return readCart(input.sessionToken);
  }

  if (!input.variantId) throw new Error("VARIANT_REQUIRED");

  if (input.action === "remove" || (input.action === "set" && (input.quantity ?? 0) <= 0)) {
    await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cartId)
      .eq("variant_id", input.variantId);
    return readCart(input.sessionToken);
  }

  if (input.action === "note") {
    await supabase
      .from("cart_items")
      .update({ note: input.note ?? "" })
      .eq("cart_id", cartId)
      .eq("variant_id", input.variantId);
    return readCart(input.sessionToken);
  }

  const { lines } = await priceLines([
    { variantId: input.variantId, quantity: input.quantity ?? 1, note: input.note },
  ]);
  const line = lines[0];
  if (!line) throw new Error("NOT_SELLABLE");

  await supabase.from("cart_items").upsert(
    {
      cart_id: cartId,
      variant_id: line.productId,
      quantity: line.quantity,
      note: line.note ?? "",
    },
    { onConflict: "cart_id,variant_id" },
  );

  return readCart(input.sessionToken);
}
