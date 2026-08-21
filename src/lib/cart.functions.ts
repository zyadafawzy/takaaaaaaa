import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sessionSchema = z.string().min(6).max(80).regex(/^[a-zA-Z0-9_-]+$/);

const lineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(0).max(20),
  note: z.string().max(200).optional(),
});

/** get_or_sync_anonymous_cart — سلة مجهولة بجلسة كوكي/توكن فقط، بدون أي حساب. */
export const getOrSyncAnonymousCart = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionToken: sessionSchema,
        lines: z.array(lineSchema).max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { syncCart } = await import("./cart.server");
    return syncCart(data.sessionToken, data.lines ?? null);
  });

/** mutate_cart — إضافة/تعديل/حذف سطر واحد، السعر والحد الأقصى من الخادم. */
export const mutateCart = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionToken: sessionSchema,
        action: z.enum(["set", "remove", "clear", "note"]),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().min(0).max(20).optional(),
        note: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { mutateCartServer } = await import("./cart.server");
    return mutateCartServer(data);
  });
