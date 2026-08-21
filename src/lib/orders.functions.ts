import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const draftSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  phone: z.string().trim().regex(/^[0-9+]{8,20}$/),
  whatsapp: z.string().trim().max(20).default(""),
  sameWhatsapp: z.boolean(),
  zoneId: z.string().uuid().or(z.literal("")),
  street: z.string().trim().max(160).default(""),
  building: z.string().trim().max(80).default(""),
  landmark: z.string().trim().max(160).default(""),
  notes: z.string().trim().max(400).default(""),
  fulfillment: z.enum(["delivery", "pickup"]),
  substitution: z.enum(["substitute", "call_me", "remove"]),
  privacyAccepted: z.literal(true),
});

/** create_pending_order — الأسعار والكميات تُحسب على الخادم. */
export const createPendingOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionToken: z.string().min(6).max(80),
        storeSlug: z.string().trim().max(80).optional(),
        draft: draftSchema,
        lines: z
          .array(
            z.object({
              variantId: z.string().uuid(),
              quantity: z.number().int().min(1).max(20),
              note: z.string().max(200).optional(),
            }),
          )
          .min(1)
          .max(60),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { createPendingOrderServer } = await import("./orders.server");
    const origin = getRequestHeader("origin") ?? getRequestHeader("referer") ?? "";
    const { privacyAccepted, ...draft } = data.draft;
    void privacyAccepted;
    return createPendingOrderServer({
      sessionToken: data.sessionToken,
      ...(data.storeSlug ? { storeSlug: data.storeSlug } : {}),
      origin,
      draft,
      lines: data.lines,
    });
  });

/** mark_whatsapp_link_opened */
export const markWhatsappLinkOpened = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(6).max(40) }).parse(input))
  .handler(async ({ data }) => {
    const { markWhatsappOpenedServer } = await import("./orders.server");
    return markWhatsappOpenedServer(data.token);
  });

/** get_order_tracking */
export const getOrderTracking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(6).max(40) }).parse(input))
  .handler(async ({ data }) => {
    const { getOrderTrackingServer } = await import("./orders.server");
    return getOrderTrackingServer(data.token);
  });

/** get_order_whatsapp — رسالة واتساب كاملة بكل بيانات الطلب بالتوكن. */
export const getOrderWhatsapp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(6).max(40) }).parse(input))
  .handler(async ({ data }) => {
    const { getOrderWhatsappServer } = await import("./orders.server");
    const origin = getRequestHeader("origin") ?? getRequestHeader("referer") ?? "";
    return getOrderWhatsappServer(data.token, origin);
  });
